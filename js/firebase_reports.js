import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db as sharedDb } from "./firebase.js";

export const FirebaseReports = (() => {
  let db = sharedDb;
  let docId = null;
  let collectionId = 'reports';
  let unsubscribe = null;
  let listeners = [];

  function emit(event, payload) {
    listeners.forEach(listener => {
      try {
        listener(event, payload);
      } catch (e) {
        console.error(`Error in FirebaseReports listener for event "${event}":`, e);
      }
    });
  }

  function on(callback) {
    if (typeof callback === 'function') {
      listeners.push(callback);
    }
    // Return an unsubscribe function
    return () => {
      listeners = listeners.filter(l => l !== callback);
    };
  }

  function teardown() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    db = null;
    docId = null;
  }

  function attachSnapshot() {
    if (!db || !docId) {
      throw new Error("FirebaseReports not initialized. Call init() first.");
    }

    if (unsubscribe) {
      unsubscribe();
    }

    const docRef = doc(db, collectionId, docId);

    unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && !docSnap.metadata.hasPendingWrites) {
          emit('synced', data.snapshot);
        }
      } else {
        console.log("No document found in Firestore, will create on first save.");
      }
      emit('configured');
    }, (error) => {
      console.error("Firebase onSnapshot error:", error);
      emit('error', error);
    });
  }

  function init(firestoreInstanceOrDocId, maybeDocumentId) {
    if (typeof firestoreInstanceOrDocId === 'string' && !maybeDocumentId) {
      docId = firestoreInstanceOrDocId;
      db = sharedDb;
      attachSnapshot();
      return Promise.resolve();
    }

    if (!firestoreInstanceOrDocId || !maybeDocumentId) {
      throw new Error("Firestore instance and document ID are required for init.");
    }

    db = firestoreInstanceOrDocId;
    docId = maybeDocumentId;
    attachSnapshot();
  }

  async function saveAll(snapshot, reason = 'Sync update', options = {}) {
    if (!db || !docId) {
      throw new Error("FirebaseReports not initialized. Call init() first.");
    }
    const docRef = doc(db, collectionId, docId);
    const payload = {
      snapshot,
      metadata: {
        lastReason: reason,
        lastSyncedAt: serverTimestamp(),
      }
    };
    await setDoc(docRef, payload, { merge: options.merge === true });
  }

  return {
    init,
    saveAll,
    on,
    teardown
  };
})();
