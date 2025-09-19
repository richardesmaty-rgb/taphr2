import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';

let app, auth, db;
let usable = false;
try {
  const cfg = window.__FIREBASE_CONFIG__;
  if (cfg && cfg.apiKey) {
    app = initializeApp(cfg);
    auth = getAuth(app);
    db = getFirestore(app);
    usable = true;
  }
} catch (e) { console.warn("Firebase init failed, running local-only:", e); }

export async function ensureAnon() {
  if (!usable) return;
  try { await signInAnonymously(auth); } catch (e) { console.warn("Anon sign-in failed:", e); }
}

export async function logActivity({ title, points, category, dateISO, name }) {
  if (!usable) return; // local-only mode
  try {
    await addDoc(collection(db,'activities'), {
      name: name || 'Anonymous',
      title, points, category, date: dateISO,
      createdAt: serverTimestamp()
    });
  } catch(e){ console.warn("logActivity failed:", e); }
}

export async function getLeaderboardSince(startISO) {
  if (!usable) return []; // local-only mode
  try {
    const q = query(collection(db,'activities'), where('date','>=',startISO), orderBy('date'));
    const snap = await getDocs(q);
    const totals = new Map();
    snap.forEach(doc => {
      const d = doc.data();
      const key = d.name || "Anon";
      totals.set(key, (totals.get(key)||0) + (d.points||0));
    });
    return Array.from(totals.entries()).map(([name,points])=>({name,points})).sort((a,b)=>b.points-a.points);
  } catch(e){ console.warn("leaderboard failed:", e); return []; }
}
