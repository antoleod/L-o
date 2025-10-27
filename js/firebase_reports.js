/* Firebase report storage.
   Provides helpers to sync reports with Firestore in real-time. */
(function(global) {
  // Las funciones de Firebase SDK estarán en el objeto global `firebase`
  let db;
  let listeners = new Set();
  let reportsCollection;
  let unsubscribe = null; // Para guardar la función de cancelación del listener de Firestore
  let reportDocRef;

  function emit(event, payload) {
    for (const fn of listeners) {
      try {
        fn(event, payload);
      } catch (e) {
        console.error('Error in listener:', e);
      }
    }
  }

  function structuredClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const api = {
    /**
     * Inicializa la conexión de Firebase y configura los listeners en tiempo real.
     * @param {object} firebaseApp - La instancia de la app de Firebase inicializada.
     * @param {string} docId - El ID del documento en Firestore para almacenar los reportes (ej. 'leo-reports').
     */
    init(firebaseApp, docId = 'main-reports') {
      db = firebase.firestore(firebaseApp);
      reportsCollection = db.collection('reports');
      reportDocRef = reportsCollection.doc(docId);

      // Cancelar cualquier listener anterior
      if (unsubscribe) {
        unsubscribe();
      }

      // Escuchar cambios en el documento en tiempo real
      unsubscribe = reportDocRef.onSnapshot(docSnapshot => {
        if (docSnapshot.exists) {
          const data = docSnapshot.data();
          emit('synced', structuredClone(data));
        } else {
          // El documento no existe, podemos crearlo con datos iniciales si es necesario
          console.log('El documento de reportes no existe. Se creará al guardar el primer dato.');
          const emptyData = { feeds: [], elims: [], meds: [], updatedAt: new Date().toISOString() };
          emit('synced', emptyData);
        }
      }, err => {
        console.error('Error al escuchar los cambios de Firestore:', err);
        emit('error', err);
      });

      emit('configured', { docId });
    },

    /**
     * Registra una función para escuchar eventos ('synced', 'error', 'configured').
     */
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Guarda todo el conjunto de datos en Firestore.
     * Esto sobrescribirá los datos existentes en el documento.
     * @param {object} payload - El objeto completo de datos { feeds, elims, meds }.
     * @param {string} message - Mensaje descriptivo (opcional, para consistencia con la API anterior).
     */
    async saveAll(payload, message = 'Sync reports') {
      if (!reportDocRef) throw new Error('Firebase not initialized. Call init() first.');
      try {
        const dataToSave = {
          ...payload,
          updatedAt: new Date().toISOString()
        };
        // `set` con `merge: true` es más seguro que `update` si el documento no existe.
        // O simplemente `set` para sobrescribir completamente.
        await reportDocRef.set(dataToSave);
        console.log(`[Firebase] ${message}`);
      } catch (err) {
        console.error('Error al guardar en Firestore:', err);
        emit('error', err);
        throw err; // Propagar el error
      }
    },

    // ... (el resto de las funciones de la API de Firebase)
  }
})();