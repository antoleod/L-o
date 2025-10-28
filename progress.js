import { loadFirebaseCore } from "./js/firebase-core.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = loadFirebaseCore().then(core => core.db);
  }
  return dbPromise;
}

export async function saveProgress(userId, gameId, data) {
  const db = await getDb();
  const ref = doc(db, "progress", `${userId}_${gameId}`);
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true });
}

export async function loadProgress(userId, gameId) {
  const db = await getDb();
  const ref = doc(db, "progress", `${userId}_${gameId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
