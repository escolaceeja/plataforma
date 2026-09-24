/*
 * CEEJA Linhares - ponte entre o sistema existente e o Firestore.
 * Mantém a estrutura/nomes das telas e preserva a API de localStorage usada
 * pelo código atual, mas sincroniza os dados principais com o Firebase.
 */
(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAYa8tTEJ4raHcdBdDnFIZlF7y2LjTX8",
    authDomain: "ceeja-linhares-sistema.firebaseapp.com",
    projectId: "ceeja-linhares-sistema",
    storageBucket: "ceeja-linhares-sistema.firebasestorage.app",
    messagingSenderId: "791087995006",
    appId: "1:791087995006:web:14c93bc02b36c73aa8602f"
  };

  const COLLECTIONS = new Set([
    'cadastroAlunos',
    'funcionariosCadastrados',
    'registrosPresenca',
    'registrosNotas',
    'registrosConclusaoCurso'
  ]);
  const GLOBAL_OBJECTS = new Set(['historicoBuscaAtiva', 'controleMatriculas']);
  const SETTINGS = new Set(['senhaPedagogo', 'nomePedagogo']);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function docIdFor(collectionName, item, index) {
    const raw = collectionName === 'cadastroAlunos'
      ? (item.cpf || item.matricula || String(index))
      : collectionName === 'funcionariosCadastrados'
        ? (item.cpf || item.usuario || String(index))
        : (item.id || `${item.cpfAluno || 'registro'}_${item.data || ''}_${item.hora || ''}_${index}`);
    return String(raw).replace(/[\\/#?\[\]]/g, '_').slice(0, 140) || String(index);
  }

  async function hydrate(db) {
    const { collection, getDocs } = firebase.firestore;
    const originalSet = Storage.prototype.setItem;

    // Firestore -> cache local. Isso permite que o código original continue
    // usando localStorage sem alterar a estrutura das telas.
    for (const name of COLLECTIONS) {
      const snap = await getDocs(collection(db, name));
      const values = [];
      snap.forEach(d => values.push({ ...d.data(), _firestoreId: d.id }));
      originalSet.call(localStorage, name, JSON.stringify(values));
    }

    for (const name of GLOBAL_OBJECTS) {
      const snap = await getDocs(collection(db, name));
      const d = snap.docs.find(x => x.id === '_global');
      if (d) originalSet.call(localStorage, name, JSON.stringify(d.data().value ?? {}));
    }

    for (const name of SETTINGS) {
      const snap = await getDocs(collection(db, '_config'));
      const d = snap.docs.find(x => x.id === name);
      if (d && d.data().value !== undefined) originalSet.call(localStorage, name, String(d.data().value));
    }
  }

  async function syncCollection(db, name, rawValue) {
    const { collection, getDocs, doc, setDoc, deleteDoc } = firebase.firestore;
    let values;
    try { values = JSON.parse(rawValue); } catch (_) { return; }
    if (!Array.isArray(values)) return;

    const col = collection(db, name);
    const existing = await getDocs(col);
    const wanted = new Set();
    const writes = [];

    values.forEach((item, index) => {
      const id = String(item._firestoreId || docIdFor(name, item, index));
      wanted.add(id);
      const copy = { ...item };
      delete copy._firestoreId;
      writes.push(setDoc(doc(db, name, id), copy));
    });

    existing.forEach(d => {
      if (!wanted.has(d.id)) writes.push(deleteDoc(doc(db, name, d.id)));
    });
    await Promise.all(writes);
  }

  async function syncGlobal(db, name, rawValue) {
    const { doc, setDoc } = firebase.firestore;
    let value;
    try { value = JSON.parse(rawValue); } catch (_) { value = rawValue; }
    await setDoc(doc(db, name, '_global'), { value });
  }

  async function syncSetting(db, name, value) {
    const { doc, setDoc } = firebase.firestore;
    await setDoc(doc(db, '_config', name), { value: String(value) });
  }

  async function start() {
    try {
      if (!window.firebase) await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');
      const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
      const db = app.firestore();
      window.CEEJAFirebase = { app, db, firebaseConfig };

      await hydrate(db);

      const originalSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        originalSet.call(this, key, value);
        if (this !== localStorage) return;
        if (!COLLECTIONS.has(key) && !GLOBAL_OBJECTS.has(key) && !SETTINGS.has(key)) return;
        const job = COLLECTIONS.has(key) ? syncCollection(db, key, value)
          : GLOBAL_OBJECTS.has(key) ? syncGlobal(db, key, value)
          : syncSetting(db, key, value);
        job.catch(err => console.error('Firebase: erro ao sincronizar', key, err));
      };

      // Executa o código original somente depois que a nuvem foi carregada.
      const holder = document.getElementById('ceeja-app-script');
      if (holder) {
        const s = document.createElement('script');
        s.textContent = holder.textContent;
        holder.replaceWith(s);
      }
    } catch (err) {
      console.error('Firebase: não foi possível inicializar. O sistema continuará no armazenamento local.', err);
      const holder = document.getElementById('ceeja-app-script');
      if (holder) {
        const s = document.createElement('script');
        s.textContent = holder.textContent;
        holder.replaceWith(s);
      }
    }
  }

  start();
})();
