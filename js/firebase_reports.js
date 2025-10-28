/* Firebase report storage.
   Provides helpers to sync reports with Firestore in real-time. */

import {
  doc,
  onSnapshot,
  runTransaction,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const listeners = new Set();

function emit(event, payload) {
  for (const fn of listeners) {
    try {
      fn(event, payload);
    } catch (error) {
      console.error("Error in listener:", error);
    }
  }
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function createEmptyPayload() {
  return {
    feeds: [],
    elims: [],
    meds: [],
    measurements: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizePayload(data = {}) {
  const empty = createEmptyPayload();
  return {
    feeds: Array.isArray(data.feeds) ? data.feeds : empty.feeds,
    elims: Array.isArray(data.elims) ? data.elims : empty.elims,
    meds: Array.isArray(data.meds) ? data.meds : empty.meds,
    measurements: Array.isArray(data.measurements) ? data.measurements : empty.measurements,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : empty.updatedAt
  };
}

function sortKey(entry) {
  if (!entry || typeof entry !== "object") {
    return "";
  }
  return entry.dateISO || entry.updatedAt || "";
}

function uniqueMerge(baseList = [], incomingList = [], key = "id") {
  const seen = new Map();

  for (const item of Array.isArray(baseList) ? baseList : []) {
    if (item && item[key]) {
      seen.set(item[key], item);
    }
  }

  for (const item of Array.isArray(incomingList) ? incomingList : []) {
    if (item && item[key]) {
      seen.set(item[key], item);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const left = sortKey(a);
    const right = sortKey(b);
    if (left === right) return 0;
    return left < right ? 1 : -1;
  });
}

const api = {
  init(firestoreInstance, docId = "main-reports") {
    if (!firestoreInstance) throw new Error("Firestore instance required for FirebaseReports.init");

    this.db = firestoreInstance;
    this.reportDocRef = doc(this.db, "reports", docId);

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.unsubscribe = onSnapshot(
      this.reportDocRef,
      snapshot => {
        const payload = snapshot.exists() ? normalizePayload(snapshot.data()) : createEmptyPayload();
        emit("synced", deepClone(payload));
      },
      error => {
        console.error("Error al escuchar los cambios de Firestore:", error);
        emit("error", error);
      }
    );

    emit("configured", { docId });
  },

  on(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async saveAll(payload, message = "Sync reports", { merge = true } = {}) {
    if (!this.reportDocRef) throw new Error("Firebase not initialized. Call init() first.");

    if (merge) {
      return this.mergeAll(payload, message);
    }

    try {
      const normalized = normalizePayload(payload);
      const dataToSave = {
        ...normalized,
        updatedAt: new Date().toISOString()
      };
      await setDoc(this.reportDocRef, dataToSave);
      console.log(`[Firebase] ${message}`);
    } catch (error) {
      console.error("Error al guardar en Firestore:", error);
      emit("error", error);
      throw error;
    }
  },

  async mergeAll(localData = {}, message = "Merge reports") {
    if (!this.db) throw new Error("Firebase not initialized.");

    const local = normalizePayload(localData);

    try {
      await runTransaction(this.db, async transaction => {
        const snapshot = await transaction.get(this.reportDocRef);
        const remote = snapshot.exists() ? normalizePayload(snapshot.data()) : createEmptyPayload();

        const mergedData = {
          feeds: uniqueMerge(remote.feeds, local.feeds),
          elims: uniqueMerge(remote.elims, local.elims),
          meds: uniqueMerge(remote.meds, local.meds),
          measurements: uniqueMerge(remote.measurements, local.measurements),
          updatedAt: new Date().toISOString()
        };

        transaction.set(this.reportDocRef, mergedData, { merge: false });
      });
      console.log(`[Firebase] ${message}`);
    } catch (error) {
      console.error("Error al fusionar datos en Firestore:", error);
      emit("error", error);
      throw error;
    }
  }
};

export const FirebaseReports = api;
