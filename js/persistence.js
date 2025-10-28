import {
  runTransaction,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc
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
let authInstance = null;
const listeners = new Set();

const clone = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const SAVE_MESSAGES = {
  idle: 'Prêt',
  saving: 'Synchronisation…',
  offline: 'Enregistré localement',
  error: 'Erreur de synchronisation',
  synced: 'Sauvegardé dans le cloud'
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
    // Include owner if we have an authenticated user available
    const ownerUid = authInstance && authInstance.currentUser ? authInstance.currentUser.uid : null;
    const docPayload = {
      snapshot: baseSnapshot(),
      metadata: {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastReason: "Initialise"
      }
    };
    if (ownerUid) {
      docPayload.owner = ownerUid;
    }
    await setDoc(reference, docPayload);
  }
}

async function withMutation(mutator, reason = "Update") {
  if (!firestoreInstance || !reference) {
    throw new Error("Persistence not initialized");
  }

  emit("sync-status", { status: "saving", message: SAVE_MESSAGES.saving });

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
    emit("sync-status", { status: "synced", message: SAVE_MESSAGES.synced });
  } catch (error) {
    console.error("Persistence mutation failed:", error);
    emit("sync-status", { status: "error", message: SAVE_MESSAGES.error });
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
  init(dbInstance, docId, auth) {
    if (!dbInstance) {
      throw new Error("Firestore instance is required");
    }
    if (!docId) {
      throw new Error("Document ID is required");
    }
    firestoreInstance = dbInstance;
    documentId = docId;
    reference = doc(firestoreInstance, COLLECTION, documentId);
    // store optional auth instance so we can set owner on initial document
    authInstance = auth || null;
  },

  connect() {
    return new Promise(async (resolve, reject) => {
      if (!firestoreInstance || !reference) {
        return reject(new Error("Persistence not initialized"));
      }
      // Ensure the document exists locally (creates if missing)
      try {
        await ensureDocument();
      } catch (err) {
        console.warn('ensureDocument failed in connect():', err);
        // continue, onSnapshot may still surface permission errors
      }

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      let initialDataResolved = false;
      let serverSnapshotSeen = false;
      const SERVER_WAIT_MS = 4000; // wait up to 4s for a server snapshot
      let serverWaitTimer = null;

      const clearServerTimer = () => {
        if (serverWaitTimer) {
          clearTimeout(serverWaitTimer);
          serverWaitTimer = null;
        }
      };

      const validateSnapshot = (snapshot) => {
        // Check that all expected keys exist (may be empty arrays)
        const missing = [];
        Object.values(TYPE_KEYS).forEach((key) => {
          if (!snapshot || !Object.prototype.hasOwnProperty.call(snapshot, key)) {
            missing.push(key);
          }
        });
        return missing;
      };

      const handleSnapshot = (snap) => {
        // fromCache === true means snapshot is served from local cache, not server
        const fromCache = !!(snap.metadata && snap.metadata.fromCache);
        const hasPending = !!(snap.metadata && snap.metadata.hasPendingWrites);
        const source = hasPending ? 'local' : (fromCache ? 'cache' : 'server');
        const raw = snap.exists() ? snap.data() : null;
        const data = raw ? normalizeSnapshot(raw) : baseSnapshot();

        // If we got a server-origin snapshot, mark that and clear the timer
        if (!fromCache && !hasPending) {
          serverSnapshotSeen = true;
          clearServerTimer();
        }

        // Emit status and data accordingly
        if (hasPending) {
          emit('sync-status', { status: 'saving', message: SAVE_MESSAGES.saving });
          emit('data-changed', { snapshot: data, source: 'local' });
        } else if (fromCache && !hasPending) {
          // Cached server state
          emit('sync-status', { status: 'idle', message: SAVE_MESSAGES.idle });
          emit('data-changed', { snapshot: data, source: 'cache' });
        } else {
          emit('sync-status', { status: 'synced', message: SAVE_MESSAGES.synced });
          emit('data-changed', { snapshot: data, source: 'server' });
        }

        // Validate shape when we receive server data
        if (!initialDataResolved && (!fromCache || serverSnapshotSeen)) {
          const missing = validateSnapshot(data);
          if (missing.length) {
            console.warn(`Persistence: server snapshot missing keys: ${missing.join(', ')}`, raw);
            emit('sync-status', { status: 'error', message: 'Données incomplètes (vérifier docId ou règles Firestore)' });
            // Still resolve with what we have to allow the app to run, but it's a warning.
          }
          initialDataResolved = true;
          clearServerTimer();
          resolve(data);
        }
      };

      // If we don't get a true server snapshot within SERVER_WAIT_MS, resolve with whatever we have
      serverWaitTimer = setTimeout(() => {
        if (!initialDataResolved) {
          console.warn('Persistence: server snapshot not received within timeout, falling back to available data (may be cached).');
          emit('sync-status', { status: 'error', message: 'Pas de réponse du serveur — affichage des données locales' });
          // attempt a one-off getDoc to fetch server state
          getDoc(reference).then((snap) => {
            const raw = snap.exists() ? snap.data() : null;
            const data = raw ? normalizeSnapshot(raw) : baseSnapshot();
            const missing = validateSnapshot(data);
            if (missing.length) {
              console.warn(`Persistence: fallback getDoc missing keys: ${missing.join(', ')}`, raw);
            }
            initialDataResolved = true;
            resolve(data);
          }).catch(err => {
            console.error('Persistence fallback getDoc failed:', err);
            initialDataResolved = true;
            resolve(baseSnapshot());
          });
        }
      }, SERVER_WAIT_MS);

      unsubscribeSnapshot = onSnapshot(reference, handleSnapshot, (error) => {
        console.error('Persistence snapshot error:', error);
        clearServerTimer();
        const perm = error && (error.code === 'permission-denied' || /permission/i.test(error.message || ''));
        emit('sync-status', { status: 'error', message: perm ? 'Accès Firestore refusé (vérifier règles/auth)' : SAVE_MESSAGES.error });
        if (!initialDataResolved) {
          reject(error);
        }
      });
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
      // Usamos un Map para fusionar de forma segura, preservando las entradas existentes.
      const entryMap = new Map(
        snapshot[key].map(item => [item.id, item])
      );
      entryMap.set(entry.id, clone(entry));
      snapshot[key] = sortEntries(Array.from(entryMap.values()));
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
      // Filtramos las entradas existentes para eliminar solo las especificadas.
      const initialCount = snapshot[key].length;
      snapshot[key] = snapshot[key].filter(
        (item) => !item || !idSet.has(String(item.id))
      );
      // Solo devolvemos el snapshot si algo ha cambiado para evitar escrituras innecesarias.
      if (snapshot[key].length < initialCount) {
        return snapshot;
      }
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
