import { db } from "./firebase-init.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

export async function saveProgress(userId, gameId, data) {
  const ref = doc(db, "progress", `${userId}_${gameId}`);
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true });
}

export async function loadProgress(userId, gameId) {
  const ref = doc(db, "progress", `${userId}_${gameId}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
