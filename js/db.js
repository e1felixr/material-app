// js/db.js
// IndexedDB-Wrapper fuer den Nachbestell-Korb (DB e1material, Store korb).
// Promise-basiert, Muster gespiegelt aus 260225_Datenaufnahme/js/db.js.
// Siehe Plan-Datei docs/superpowers/plans/2026-07-09-e1-material.md, Task C1.

const DB = (() => {
  const DB_NAME = 'e1material';
  const DB_VERSION = 1;
  const STORE = 'korb';

  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function tx(mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Posten = {id, quelle, kategorie, position, material, type,
  //           bemerkung_katalog, nachbestell_menge, notiz, foto_blob?, erfasst_am}

  async function addPosten(posten) {
    await open();
    return reqToPromise(tx('readwrite').add(posten));
  }

  async function updatePosten(posten) {
    await open();
    await reqToPromise(tx('readwrite').put(posten));
  }

  async function deletePosten(id) {
    await open();
    await reqToPromise(tx('readwrite').delete(id));
  }

  async function allPosten() {
    await open();
    return reqToPromise(tx('readonly').getAll());
  }

  async function clearKorb() {
    await open();
    await reqToPromise(tx('readwrite').clear());
  }

  return { open, addPosten, updatePosten, deletePosten, allPosten, clearKorb };
})();
