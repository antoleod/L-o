// No necesitas importar desde firebase-init.js si lo configuras aquí.
// Este archivo se convierte en el punto central de la inicialización de Firebase.

const firebaseConfig = {
  apiKey: "AIzaSyCRvodMEsVaZ0ynCqTTR8quIAAvW445kzE",
  authDomain: "appleo-a0ba4.firebaseapp.com",
  projectId: "appleo-a0ba4",
  storageBucket: "appleo-a0ba4.firebasestorage.app",
  messagingSenderId: "1045704718169",
  appId: "1:1045704718169:web:c422f19c13176efae6be48",
  measurementId: "G-BG54P5T72H"
};

// Inicializa Firebase
const app = firebase.initializeApp(firebaseConfig);

// Exporta los servicios que usarás en otros módulos
export const db = firebase.firestore(app);
export const auth = firebase.auth(app);
export const storage = firebase.storage(app);

console.log("Firebase OK", { db, auth, storage });
