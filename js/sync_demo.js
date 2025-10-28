import { db } from "./firebase.js";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const outputNode = document.querySelector("#output");
const statusNode = document.querySelector("#status");
const buttonNode = document.querySelector("#sync-button");

const demoDocRef = doc(db, "sync_demo", "shared");

function setStatus(message) {
  if (statusNode) {
    statusNode.textContent = message;
  }
}

function renderSnapshot(data, metadata) {
  if (outputNode) {
    const formatted = data ? JSON.stringify(data, null, 2) : "Document is empty.";
    outputNode.textContent = formatted;
  }
  if (metadata?.hasPendingWrites) {
    setStatus("Pending local write…");
  } else {
    setStatus("Snapshot updated.");
  }
}

buttonNode?.addEventListener("click", async () => {
  setStatus("Writing update…");
  try {
    await setDoc(
      demoDocRef,
      {
        updatedAt: serverTimestamp(),
        randomValue: Math.random(),
        note: "Hello from sync demo",
      },
      { merge: true }
    );
    setStatus("Write acknowledged.");
  } catch (error) {
    console.error("Failed to write demo document:", error);
    setStatus(`Write failed: ${error.message}`);
  }
});

onSnapshot(
  demoDocRef,
  (snapshot) => {
    renderSnapshot(snapshot.data(), snapshot.metadata);
  },
  (error) => {
    console.error("Demo listener error:", error);
    setStatus(`Listener error: ${error.message}`);
  }
);
