import React, { useEffect, useMemo, useState } from 'react';
import { ensureAnon, logActivity, getLeaderboardSince } from './firebase';
const todayISO = () => new Date().toISOString().slice(0,10);
const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const uid = () => Math.random().toString(36).slice(2,9);
const xpForLevel = (level) => 100 + (level - 1) * 75;

const defaultQuests = [
  { id: uid(), title: "Prospecting call", points: 5, category: "Sales", emoji: "📞" },
  { id: uid(), title: "Book a meeting", points: 15, category: "Sales", emoji: "📅" },
  { id: uid(), title: "Send proposal/quote", points: 20, category: "Sales", emoji: "📨" },
  { id: uid(), title: "Close a deal", points: 75, category: "Sales", emoji: "🏁" },
  { id: uid(), title: "LinkedIn post", points: 10, category: "Marketing", emoji: "📝" },
  { id: uid(), title: "5 meaningful comments", points: 5, category: "Marketing", emoji: "💬" },
  { id: uid(), title: "Email newsletter", points: 20, category: "Marketing", emoji: "📧" },
  { id: uid(), title: "Source 5 candidates", points: 10, category: "Recruitment", emoji: "🧲" },
  { id: uid(), title: "Screen candidate", points: 10, category: "Recruitment", emoji: "🗣️" },
  { id: uid(), title: "Client intake call", points: 15, category: "Recruitment", emoji: "🎧" },
  { id: uid(), title: "Candidate submitted to client", points: 15, category: "Recruitment", emoji: "📤" },
  { id: uid(), title: "Offer accepted", points: 100, category: "Recruitment", emoji: "🤝" },
  { id: uid(), title: "Add 10 leads to CRM", points: 10, category: "Ops", emoji: "🗂️" },
  { id: uid(), title: "Update pipeline", points: 5, category: "Ops", emoji: "♻️" },
];
const defaultState = { settings:{dailyGoal:120,pomodoroMinutes:25,shortBreakMinutes:5,longBreakMinutes:15}, quests:defaultQuests, history:[], xp:0, level:1, streak:0, lastGoalDate:null, name:'' };
const STORAGE='taphr-no-login-firebase-v1';

export default function App(){
  const [state,setState]=useState(()=>{ try{return {...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE))||{})};}catch{return defaultState;} });
  useEffect(()=>{ localStorage.setItem(STORAGE, JSON.stringify(state)); },[state]);
  useEffect(()=>{ ensureAnon(); },[]); // try anonymous sign-in if Firebase is configured

  const dateToday=todayISO();
  const historyToday = useMemo(()=>state.history.filter(h=>h.date===dateToday),[state.history,dateToday]);

  async function completeQuest(q){
    const entry={id:uid(),date:dateToday,questId:q.id,title:q.title,points:q.points,emoji:q.emoji,category:q.category,timestamp:Date.now()};
    const newHistory=[entry, ...state.history]; const newXP=state.xp+q.points;
    let lvl=state.level, rem=newXP, need=100+(lvl-1)*75; while(rem>=need){ rem-=need; lvl+=1; need=100+(lvl-1)*75; }
    const totalToday=newHistory.filter(h=>h.date===dateToday).reduce((s,h)=>s+h.points,0);
    let streak=state.streak, last=state.lastGoalDate;
    if (totalToday>=state.settings.dailyGoal && last!==dateToday){ const y=new Date(dateToday); y.setDate(y.getDate()-1); streak=(last===y.toISOString().slice(0,10))?streak+1:1; last=dateToday; }
    setState({...state, history:newHistory, xp:newXP, level:lvl, streak, lastGoalDate:last});
    await logActivity({ title:q.title, points:q.points, category:q.category, dateISO:dateToday, name: state.name });
  }
  function exportCSV(){
    const rows=[['date','time','title','category','points']].concat(state.history.map(h=>[h.date,new Date(h.timestamp).toLocaleTimeString(),h.title,h.category||'',h.points]));
    const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`taphr-activity-${dateToday}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  const [tab,setTab]=useState('Play'); const cats=['All',...Array.from(new Set(state.quests.map(q=>q.category)))]; const [cat,setCat]=useState('All'); const filtered=state.quests.filter(q=>cat==='All'||q.category===cat);

  return (<div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900">
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">TAP‑HR • Sales & Marketing Game</h1>
        <div className="flex items-center gap-2"><input value={state.name} onChange={e=>setState({...state,name:e.target.value})} placeholder="Your name" className="px-3 py-2 border rounded-xl"/><button onClick={exportCSV} className="px-3 py-2 rounded-xl border shadow-sm hover:shadow">Export CSV</button></div>
      </header>
      <div className="flex gap-2 mt-6"><button onClick={()=>setTab('Play')} className={`px-3 py-2 rounded-xl border shadow-sm ${tab==='Play'?'bg-black text-white':''}`}>Play</button><button onClick={()=>setTab('Leaderboard')} className={`px-3 py-2 rounded-xl border shadow-sm ${tab==='Leaderboard'?'bg-black text-white':''}`}>Leaderboard</button></div>
      {tab==='Leaderboard'? (<Leader/>) : (
      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-2 space-y-6">
          <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
            <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-semibold">Today's Progress</h2><div className="flex items-center gap-2 text-sm"><span>Goal:</span><input type="number" value={state.settings.dailyGoal} onChange={e=>setState({...state, settings:{...state.settings, dailyGoal:clamp(parseInt(e.target.value||0),10,10000)}})} className="w-24 px-2 py-1 border rounded-lg"/><span>pts</span></div></div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width:`${Math.max(0,Math.min(100,Math.round(state.history.filter(h=>h.date===dateToday).reduce((s,h)=>s+h.points,0)/state.settings.dailyGoal*100)))}%`}}/></div>
            <div className="mt-2 text-sm opacity-80">{state.history.filter(h=>h.date===dateToday).reduce((s,h)=>s+h.points,0)} / {state.settings.dailyGoal} pts</div>
          </div>
          <div className="flex flex-wrap gap-2">{cats.map(c=>(<button key={c} onClick={()=>setCat(c)} className={`px-3 py-2 rounded-xl border shadow-sm text-sm ${cat===c?'bg-black text-white':''}`}>{c}</button>))}</div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(q=>(<div key={q.id} className="p-4 rounded-2xl border shadow-sm bg-white/70 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><span className="text-2xl">{q.emoji||'🎯'}</span><div><div className="font-semibold">{q.title}</div><div className="text-xs opacity-70">{q.category} • {q.points} pts</div></div></div>
              </div>
              <button onClick={()=>completeQuest(q)} className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90">Complete +{q.points}</button>
            </div>))}
          </div>
          <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
            <h3 className="font-semibold mb-3">Today's Activity</h3>
            {historyToday.length===0 && <div className="text-sm opacity-70">No activity yet. Complete a quest!</div>}
            <ul className="space-y-2">{historyToday.sort((a,b)=>b.timestamp-a.timestamp).map(h=>(<li key={h.id} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><span>{h.emoji||'🎯'}</span><span className="font-medium">{h.title}</span><span className="opacity-60">• {new Date(h.timestamp).toLocaleTimeString()}</span></div><span className="font-semibold">+{h.points}</span></li>))}</ul>
          </div>
        </div>
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border shadow-sm bg-white/60 flex flex-col gap-2">
            <h3 className="font-semibold">Stats</h3>
            <div className="text-sm">Current streak: <span className="font-semibold">{state.streak}</span></div>
            <div className="text-sm">Level: <span className="font-semibold">{state.level}</span></div>
            <div className="text-sm">Last 7 days points: <span className="font-semibold">{(()=>{const byDate={}; state.history.forEach(h=>byDate[h.date]=(byDate[h.date]||0)+h.points); return Object.keys(byDate).sort().slice(-7).reduce((s,d)=>s+byDate[d],0);})()}</span></div>
          </div>
        </div>
      </div>)}
    </div>
  </div>);
}

function Leader(){
  const [rows,setRows]=useState([]);
  useEffect(()=>{ const start=new Date(); start.setDate(start.getDate()-7); getLeaderboardSince(start.toISOString().slice(0,10)).then(setRows); },[]);
  return <div className="p-4 rounded-2xl border shadow-sm bg-white/60 mt-6">
    <h3 className="font-semibold mb-2">Leaderboard (Last 7 days)</h3>
    <table className="w-full text-sm"><thead><tr className="text-left opacity-70"><th>#</th><th>Name</th><th className="text-right">Points</th></tr></thead><tbody>
      {rows.map((r,i)=>(<tr key={i} className="border-t"><td className="py-1">{i+1}</td><td>{r.name||'Anon'}</td><td className="text-right font-semibold">{r.points}</td></tr>))}
      {rows.length===0 && <tr><td colSpan="3" className="py-3 opacity-70">No leaderboard data yet (local-only mode or no activities logged).</td></tr>}</tbody></table>
  </div>;
}
