import { loadFirebaseCore } from "./js/firebase-core.js";

let firebaseApiPromise = null;

async function getFirebaseApi() {
  if (!firebaseApiPromise) {
    firebaseApiPromise = loadFirebaseCore();
  }
  return firebaseApiPromise;
}

export async function saveProgress(userId, gameId, data) {
  const { db, firestoreFns } = await getFirebaseApi();
  const { doc, setDoc } = firestoreFns;
  const ref = doc(db, "progress", `${userId}_${gameId}`);
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true });
}

export async function loadProgress(userId, gameId) {
  const { db, firestoreFns } = await getFirebaseApi();
  const { doc, getDoc } = firestoreFns;
  const ref = doc(db, "progress", `${userId}_${gameId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
