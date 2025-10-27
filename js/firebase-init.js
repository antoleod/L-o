// Firebase (ES Modules desde CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
// (Opcional) Storage, Analytics, etc. cuando los necesites

// ⚠️ Rellena appId real desde la consola Firebase (Project settings → General)
const firebaseConfig = {
  apiKey: "AIzaSyCRvodMEsVaZ0ynCqTTR8quIAAvW445kzE",
  authDomain: "appleo-a0ba4.firebaseapp.com",
  projectId: "appleo-a0ba4",
  storageBucket: "appleo-a0ba4.appspot.com",
  messagingSenderId: "1045704718169",
  appId: "1:1045704718169:web:xxxxxxxxxxxxxxxx" // <- tu appId real
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
