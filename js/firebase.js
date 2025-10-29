import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const FIREBASE_CONFIG = Object.freeze({
  apiKey: "AIzaSyCRvodMEsVaZ0ynCqTTR8quIAAvW445kzE",
  authDomain: "appleo-a0ba4.firebaseapp.com",
  projectId: "appleo-a0ba4",
  storageBucket: "appleo-a0ba4.firebasestorage.app",
  messagingSenderId: "1045704718169",
  appId: "1:1045704718169:web:c422f19c13176efae6be48",
  measurementId: "G-BG54P5T72H",
});

const app = initializeApp(FIREBASE_CONFIG);

// App Check enforcement is disabled in console while we finish the migration without auth.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);

// Authentication: attempt anonymous sign-in so rules that require auth pass for clients
export const auth = getAuth(app);

let _authReadyPromise = null;
export function ensureAuth() {
  if (_authReadyPromise) return _authReadyPromise;
  _authReadyPromise = new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Authenticated anonymously with UID:", user.uid);
        resolve(user);
      } else {
        console.log("No user is signed in.");
        resolve(null);
      }
    });
  });
  // Try to sign in anonymously; if it fails we still resolve when auth state changes
  signInAnonymously(auth).catch((err) => {
    console.warn("Anonymous sign-in failed:", err);
  });
  return _authReadyPromise;
}

export const storageFns = Object.freeze({
  createRef: (instance, path) => storageRef(instance, path),
  uploadBytes,
  getDownloadURL,
});

export { app };

export default {
  app,
  db,
  storage,
  storageFns,
  auth,
  ensureAuth
};
