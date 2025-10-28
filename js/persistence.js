import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const COLLECTION = "babyLogs";
const TYPE_KEYS = {
  feed: "feeds",
  elim: "elims",
  med: "meds",
  measurement: "measurements"
};

let firestoreInstance = null;
let documentId = null;
let reference = null;
let unsubscribeSnapshot = null;
const listeners = new Set();

const clone = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

function baseSnapshot() {
  return {
    feeds: [],
    elims: [],
    meds: [],
    measurements: []
  };
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== "object") {
    return baseSnapshot();
  }
  const source = raw.snapshot && typeof raw.snapshot === "object"
    ? raw.snapshot
    : raw;
  const snapshot = baseSnapshot();
  Object.keys(snapshot).forEach((key) => {
    snapshot[key] = Array.isArray(source[key]) ? clone(source[key]) : [];
  });
  return snapshot;
}

function emit(event, payload) {
  listeners.forEach((callback) => {
    try {
      callback(event, payload);
    } catch (error) {
      console.error("Persistence listener error:", error);
    }
  });
}

async function ensureDocument() {
  if (!reference) {
    throw new Error("Persistence not initialized");
  }
  const snap = await getDoc(reference);
  if (!snap.exists()) {
    await setDoc(reference, {
      snapshot: baseSnapshot(),
      metadata: {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastReason: "Initialise"
      }
    });
  }
}

async function withMutation(mutator, reason = "Update") {
  if (!firestoreInstance || !reference) {
    throw new Error("Persistence not initialized");
  }

  emit("sync-status", "saving");

  try {
    await runTransaction(firestoreInstance, async (transaction) => {
      const snap = await transaction.get(reference);
      const current = snap.exists()
        ? normalizeSnapshot(snap.data())
        : baseSnapshot();
      const draft = normalizeSnapshot(mutator(clone(current)) || current);
      transaction.set(reference, {
        snapshot: draft,
        metadata: {
          updatedAt: serverTimestamp(),
          lastReason: reason
        }
      }, { merge: true });
    });
    emit("sync-status", "synced");
  } catch (error) {
    console.error("Persistence mutation failed:", error);
    emit("sync-status", "error");
    throw error;
  }
}

function sortEntries(list) {
  return [...list].sort((a, b) => {
    const left = a?.dateISO || "";
    const right = b?.dateISO || "";
    if (left === right) {
      const leftId = a?.id || "";
      const rightId = b?.id || "";
      return leftId < rightId ? 1 : -1;
    }
    return left < right ? 1 : -1;
  });
}

export const Persistence = {
  init(dbInstance, docId) {
    if (!dbInstance) {
      throw new Error("Firestore instance is required");
    }
    if (!docId) {
      throw new Error("Document ID is required");
    }
    firestoreInstance = dbInstance;
    documentId = docId;
    reference = doc(firestoreInstance, COLLECTION, documentId);
  },

  async connect() {
    if (!firestoreInstance || !reference) {
      throw new Error("Persistence not initialized");
    }
    await ensureDocument();
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
    unsubscribeSnapshot = onSnapshot(reference, (snap) => {
      if (!snap.exists()) {
        return;
      }
      if (snap.metadata.hasPendingWrites) {
        emit("sync-status", "saving");
        return;
      }
      const data = normalizeSnapshot(snap.data());
      emit("data-changed", data);
      emit("sync-status", "synced");
    }, (error) => {
      console.error("Persistence snapshot error:", error);
      emit("sync-status", "error");
    });
  },

  async saveEntry(type, entry, reason = "Save entry") {
    const key = TYPE_KEYS[type];
    if (!key) {
      throw new Error(`Unknown entry type "${type}"`);
    }
    if (!entry || !entry.id) {
      throw new Error("Entry requires an id");
    }
    await withMutation((snapshot) => {
      const filtered = snapshot[key].filter((item) => item && item.id !== entry.id);
      filtered.push(clone(entry));
      snapshot[key] = sortEntries(filtered);
      return snapshot;
    }, reason);
  },

  async deleteEntries(type, ids, reason = "Delete entries") {
    const key = TYPE_KEYS[type];
    if (!key) {
      throw new Error(`Unknown entry type "${type}"`);
    }
    const idSet = new Set(Array.isArray(ids) ? ids.map(String) : []);
    if (!idSet.size) {
      return;
    }
    await withMutation((snapshot) => {
      snapshot[key] = snapshot[key].filter(
        (item) => item && !idSet.has(String(item.id))
      );
      return snapshot;
    }, reason);
  },

  async merge(snapshot, reason = "Merge snapshot") {
    const normalized = normalizeSnapshot(snapshot);
    await withMutation((current) => {
      Object.keys(TYPE_KEYS).forEach((type) => {
        const key = TYPE_KEYS[type];
        const mergedMap = new Map();
        current[key].forEach((item) => {
          if (item?.id) mergedMap.set(String(item.id), item);
        });
        normalized[key].forEach((item) => {
          if (item?.id) mergedMap.set(String(item.id), item);
        });
        current[key] = sortEntries(Array.from(mergedMap.values()));
      });
      return current;
    }, reason);
  },

  on(callback) {
    if (typeof callback === "function") {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
    return () => {};
  },

  disconnect() {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    listeners.clear();
    firestoreInstance = null;
    documentId = null;
    reference = null;
  }
};
