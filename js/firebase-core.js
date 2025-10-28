import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
// import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app-check.js";

export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyCRvodMEsVaZ0ynCqTTR8quIAAvW445kzE",
  authDomain: "appleo-a0ba4.firebaseapp.com",
  projectId: "appleo-a0ba4",
  storageBucket: "appleo-a0ba4.firebasestorage.app",
  messagingSenderId: "1045704718169",
  appId: "1:1045704718169:web:c422f19c13176efae6be48",
  measurementId: "G-BG54P5T72H"
});

let firebaseCorePromise = null;

export function loadFirebaseCore() {
  if (firebaseCorePromise) {
    return firebaseCorePromise;
  }

  firebaseCorePromise = (async () => {
    const app = initializeApp(firebaseConfig);
    // App Check (reCAPTCHA) está desactivado para el desarrollo.
    const appCheck = null;

    const db = getFirestore(app);
    try {
      await enableIndexedDbPersistence(db);
      console.log("Firebase offline persistence enabled.");
    } catch (error) {
      console.error("Error enabling offline persistence:", error);
    }
    const auth = getAuth(app);
    const storage = getStorage(app);

    return {
      app,
      db,
      auth,
      storage,
      appCheck,
      onAuthStateChanged,
      signInAnonymously,
      storageFns: {
        createRef: (instance, path) => ref(instance, path),
        uploadBytes,
        getDownloadURL
      }
    };
  })();

  return firebaseCorePromise;
}
