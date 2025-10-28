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

  function uniqueMerge(baseList = [], incomingList = [], key = 'id') {
    const seen = new Map();
    // Prioriza los elementos más nuevos (incoming) sobre los más antiguos (base)
    for (const item of baseList) {
      if (item && item[key]) {
        seen.set(item[key], item);
      }
    }
    for (const item of incomingList) {
      if (item && item[key]) {
        seen.set(item[key], item);
      }
    }
    return Array.from(seen.values())
      .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  }

  const api = {
    /**
     * Inicializa la conexión de Firebase y configura los listeners en tiempo real.
     * @param {object} firebaseApp - La instancia de la app de Firebase inicializada.
     * @param {string} docId - El ID del documento en Firestore para almacenar los reportes (ej. 'leo-reports').
     */
    init(firebaseApp, docId = 'main-reports') {
      db = firebaseApp.firestore();
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
    async saveAll(payload, message = 'Sync reports', { merge = true } = {}) {
      if (!reportDocRef) throw new Error('Firebase not initialized. Call init() first.');
      
      if (merge) {
        return this.mergeAll(payload, message);
      }

      try {
        const dataToSave = {
          ...payload,
          updatedAt: new Date().toISOString()
        };
        await reportDocRef.set(dataToSave);
        console.log(`[Firebase] ${message}`);
      } catch (err) {
        console.error('Error al guardar en Firestore:', err);
        emit('error', err);
        throw err;
      }
    },

    /**
     * Combina los datos locales con los remotos y guarda el resultado.
     * @param {object} localData - El objeto de datos local.
     * @param {string} message - Mensaje para el log.
     */
    async mergeAll(localData, message = 'Merge reports') {
      if (!db) throw new Error('Firebase not initialized.');
      try {
        await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(reportDocRef);
          const remoteData = doc.exists ? doc.data() : {};

          const mergedData = {
            feeds: uniqueMerge(remoteData.feeds, localData.feeds),
            elims: uniqueMerge(remoteData.elims, localData.elims),
            meds: uniqueMerge(remoteData.meds, localData.meds),
            measurements: uniqueMerge(remoteData.measurements, localData.measurements),
            updatedAt: new Date().toISOString(),
          };
          transaction.set(reportDocRef, mergedData);
        });
        console.log(`[Firebase] ${message}`);
      } catch (err) {
        console.error('Error al fusionar datos en Firestore:', err);
        emit('error', err);
        throw err; // Propagar el error
      }
    },

    // ... (el resto de las funciones de la API de Firebase)
  };

  // ¡IMPORTANTE! Asigna la API al objeto global para que sea accesible.
  if (global) {
    global.FirebaseReports = api;
  }
})(typeof window !== 'undefined' ? window : this);