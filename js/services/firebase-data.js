import { db } from '../firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';

export function processStreamsData(data) {
  const possibleHistory = data.history || data.streams || data.list || data;
  let streams = [];
  if (Array.isArray(possibleHistory)) {
    streams = possibleHistory;
  } else if (typeof possibleHistory === 'object') {
    streams = Object.keys(possibleHistory).map(key => ({ _docId: key, ...possibleHistory[key] }));
  }

  if (streams.length > 0) {
    console.log('[ENGINE] Campos disponibles en el primer stream:', Object.keys(streams[0]));
    console.log('[ENGINE] Primer stream completo:', JSON.stringify(streams[0]));
  }

  const isTitleValid = (str) => {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (s === '') return false;
    if (/sqlstate/i.test(s)) return false;
    if (/^[0-9a-f\-]{12,}$/i.test(s)) return false;
    if (/(error|exception|failed|invalid|undefined|null)/i.test(s) && s.length > 40) return false;
    if (s.length > 150) return false;
    return true;
  };

  const resolveStreamTitle = (obj) => {
    const candidates = [
      obj.title, obj.name, obj.nombre, obj.titulo, obj.streamTitle,
      obj.stream_title, obj.gameName, obj.game_name, obj.label, obj.descripcion
    ];
    for (const c of candidates) {
      if (isTitleValid(c)) return c.trim();
    }
    return null;
  };

  const getTimestamp = (obj) => {
    const d = obj.date || obj.timestamp || obj.createdAt || obj.fecha;
    if (d?.seconds) return d.seconds * 1000;
    if (d) { const t = new Date(d).getTime(); if (!isNaN(t)) return t; }
    if (obj._docId) { const t = new Date(obj._docId).getTime(); if (!isNaN(t)) return t; }
    return 0;
  };

  const uniqueMap = new Map();
  streams.forEach(s => {
    const rawTitle = resolveStreamTitle(s) || 'SIN TITULO';
    if (rawTitle.toLowerCase().includes('test')) return;
    const normalizedName = rawTitle.toUpperCase().trim().replace(/\s+/g, ' ');
    const t = getTimestamp(s);
    if (!uniqueMap.has(normalizedName) || (t > 0 && t < uniqueMap.get(normalizedName)._t)) {
      uniqueMap.set(normalizedName, { ...s, _docId: s._docId, _t: t, _resolvedTitle: rawTitle });
    }
  });

  const result = Array.from(uniqueMap.values())
    .sort((a, b) => b._t - a._t)
    .slice(0, 5);

  console.log('[ENGINE] Streams procesados (sin duplicados, fecha apertura):', result.length);
  return result;
}

export async function fetchFromFirestore() {
  console.log('[FIREBASE] Descargando datos frescos de Firestore...');
  const userSnapshot = await getDocs(collection(db, 'users'));
  const users = [];
  userSnapshot.forEach(d => { const data = d.data(); data._id = d.id; users.push(data); });
  console.log(`[FIREBASE] ${users.length} usuarios descargados`);

  const docRef = doc(db, 'system', 'stream_history');
  const docSnap = await getDoc(docRef);
  let streams = [];
  if (docSnap.exists()) {
    streams = processStreamsData(docSnap.data());
  } else {
    console.warn('[FIREBASE] stream_history no existe');
  }
  console.log(`[FIREBASE] ${streams.length} streams descargados`);
  return { users, streams };
}
