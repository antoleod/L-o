import { db } from "./js/firebase.js";
import {
  doc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

function getProgressRef(userId, gameId) {
  if (!userId || !gameId) {
    throw new Error("userId and gameId are required");
  }
  return doc(db, "progress", `${userId}_${gameId}`);
}

export async function saveProgress(userId, gameId, data) {
  const ref = getProgressRef(userId, gameId);
  await setDoc(ref, { ...data, updatedAt: Date.now() }, { merge: true });
}

export function listenToProgress(userId, gameId, callback, onError) {
  const ref = getProgressRef(userId, gameId);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (typeof callback === "function") {
        callback(snapshot.exists() ? snapshot.data() : null, snapshot);
      }
    },
    (error) => {
      if (typeof onError === "function") {
        onError(error);
      } else {
        console.error("Progress listener error:", error);
      }
    }
  );
}

export async function loadProgress(userId, gameId) {
  return new Promise((resolve, reject) => {
    const unsubscribe = listenToProgress(
      userId,
      gameId,
      (data, snapshot) => {
        unsubscribe();
        resolve(snapshot && snapshot.exists() ? snapshot.data() : null);
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}
