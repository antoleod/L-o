import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
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

    const appCheck = null;
    // try {
    //   appCheck = initializeAppCheck(app, {
    //     provider: new ReCaptchaV3Provider("6Ld-sA8qAAAAAK2Yw_pGvGg4-gR_p8E2a-gHjK3L"),
    //     isTokenAutoRefreshEnabled: true
    //   });
    // } catch (error) {
    //   console.warn("App Check initialization skipped:", error);
    // }

    const db = getFirestore(app);
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
