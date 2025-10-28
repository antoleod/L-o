import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCRvodMEsVaZ0ynCqTTR8quIAAvW445kzE",
  authDomain: "appleo-a0ba4.firebaseapp.com",
  projectId: "appleo-a0ba4",
  storageBucket: "appleo-a0ba4.firebasestorage.app",
  messagingSenderId: "1045704718169",
  appId: "1:1045704718169:web:c422f19c13176efae6be48",
  measurementId: "G-BG54P5T72H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services you will use in other modules
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { onAuthStateChanged, signInAnonymously };
export { ref, uploadBytes, getDownloadURL };

console.log("Firebase OK", { db, auth, storage });
