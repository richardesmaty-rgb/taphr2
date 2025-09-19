import React, { useEffect, useMemo, useState } from "react";
import { ensureAnon, logActivity, getLeaderboardSince } from "./firebase";

const todayISO = () => new Date().toISOString().slice(0, 10);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const uid = () => Math.random().toString(36).slice(2, 9);
const xpForLevel = (level) => 100 + (level - 1) * 75;

// ----- Quests (you can tweak freely) -----
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

// ----- Per-person state template -----
const defaultSettings = {
  dailyGoal: 100,
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};
const makeFreshState = (name = "") => ({
  name,
  settings: { ...defaultSettings },
  quests: defaultQuests,
  history: [],
  xp: 0,
  level: 1,
  streak: 0,
  lastGoalDate: null,
});

// ----- Storage helpers (namespaced per person) -----
const STORAGE_PREFIX = "taphr-game-multi-";
const PROFILES_KEY = STORAGE_PREFIX + "profiles"; // list of people

function loadProfiles() {
  try {
    const arr = JSON.parse(localStorage.getItem(PROFILES_KEY)) || [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveProfiles(arr) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(arr));
}
function loadPersonState(person) {
  try {
    return (
      JSON.parse(localStorage.getItem(STORAGE_PREFIX + person)) || makeFreshState(person)
    );
  } catch {
    return makeFreshState(person);
  }
}
function savePersonState(person, state) {
  localStorage.setItem(STORAGE_PREFIX + person, JSON.stringify(state));
}

// ----- Focus Timer -----
function Timer({ settings }) {
  const [mode, setMode] = useState("work");
  const [sec, setSec] = useState(settings.pomodoroMinutes * 60);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [run]);
  useEffect(() => {
    if (sec === 0) setRun(false);
  }, [sec]);

  const resetTo = (m) => {
    setMode(m);
    const mins =
      m === "work"
        ? settings.pomodoroMinutes
        : m === "short"
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;
    setSec(mins * 60);
    setRun(false);
  };
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
      <h3 className="font-semibold mb-2">Focus Timer</h3>
      <div className="flex gap-2 mb-3">
        {["work", "short", "long"].map((m) => (
          <button
            key={m}
            onClick={() => resetTo(m)}
            className={`px-3 py-1 rounded-lg border ${
              mode === m ? "bg-black text-white" : ""
            }`}
          >
            {m === "work" ? "Work" : m === "short" ? "Short" : "Long"}
          </button>
        ))}
      </div>
      <div className="text-4xl font-bold text-center mb-3">
        {mm}:{ss}
      </div>
      <div className="flex gap-2 justify-center">
        <button onClick={() => setRun((r) => !r)} className="px-3 py-2 rounded-xl border">
          {run ? "Pause" : "Start"}
        </button>
        <button onClick={() => resetTo(mode)} className="px-3 py-2 rounded-xl border">
          Reset
        </button>
      </div>
    </div>
  );
}

// ----- Leaderboard (7/30d) -----
function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [range, setRange] = useState("week");
  useEffect(() => {
    const now = new Date();
    const start = new Date(now);
    if (range === "week") start.setDate(now.getDate() - 7);
    else start.setMonth(now.getMonth() - 1);
    getLeaderboardSince(start.toISOString().slice(0, 10)).then(setRows);
  }, [range]);

  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Leaderboard</h3>
        <select
          className="px-2 py-1 border rounded"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>
      <table className="w-full text-sm mt-3">
        <thead>
          <tr className="text-left opacity-70">
            <th>#</th>
            <th>Name</th>
            <th className="text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.uid || r.name || i} className="border-t">
              <td className="py-1">{i + 1}</td>
              <td>{r.name || "—"}</td>
              <td className="text-right font-semibold">{r.points}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan="3" className="py-3 opacity-70">
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ----- Right-hand badges -----
function Badges({ state }) {
  const badges = [
    { id: "starter", label: "Getting Started", earned: state.history.length >= 1, emoji: "🚀" },
    {
      id: "caller10",
      label: "Call Cadet (10 calls)",
      earned: state.history.filter((h) => /call/i.test(h.title)).length >= 10,
      emoji: "📞",
    },
    {
      id: "closer1",
      label: "Closer (1 deal)",
      earned: state.history.filter((h) => /close a deal/i.test(h.title)).length >= 1,
      emoji: "🏆",
    },
    {
      id: "content5",
      label: "Content Creator (5 posts)",
      earned: state.history.filter((h) => /LinkedIn post/i.test(h.title)).length >= 5,
      emoji: "📝",
    },
    { id: "level5", label: "Level 5+", earned: state.level >= 5, emoji: "🥇" },
    { id: "hundred", label: "Hit 100+ day", earned: true, emoji: "💯" },
  ];
  return (
    <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
      <h3 className="font-semibold mb-2">Badges</h3>
      <div className="flex flex-wrap gap-2 text-sm">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`px-3 py-2 rounded-xl border shadow-sm ${
              b.earned ? "bg-amber-100" : "opacity-50"
            }`}
          >
            <span className="mr-1">{b.emoji}</span>
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- People Switcher (multi-user) -----
function PeopleBar({ person, setPerson, profiles, setProfiles, onExportCSV }) {
  const [newName, setNewName] = useState("");

  function addPerson() {
    const name = newName.trim();
    if (!name) return;
    if (!profiles.includes(name)) {
      const next = [...profiles, name].sort((a, b) => a.localeCompare(b));
      setProfiles(next);
      saveProfiles(next);
    }
    // create state if missing
    const existing = localStorage.getItem(STORAGE_PREFIX + name);
    if (!existing) savePersonState(name, makeFreshState(name));
    setPerson(name);
    setNewName("");
  }

  function deletePerson(name) {
    if (!confirm(`Remove ${name}? (Their saved data will remain in localStorage.)`)) return;
    const next = profiles.filter((p) => p !== name);
    setProfiles(next);
    saveProfiles(next);
    if (person === name) setPerson(next[0] || "");
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        value={person}
        onChange={(e) => setPerson(e.target.value)}
        className="px-3 py-2 border rounded-xl"
      >
        {profiles.length === 0 && <option value="">— Select person —</option>}
        {profiles.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <input
        placeholder="Add person..."
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="px-3 py-2 border rounded-xl"
      />
      <button onClick={addPerson} className="px-3 py-2 rounded-xl border shadow-sm">
        Add
      </button>

      {person && (
        <button
          onClick={() => deletePerson(person)}
          className="px-3 py-2 rounded-xl border shadow-sm"
          title="Remove from list"
        >
          Remove
        </button>
      )}

      <button onClick={onExportCSV} className="px-3 py-2 rounded-xl border shadow-sm">
        Export CSV
      </button>
    </div>
  );
}

// ----- MAIN APP -----
export default function App() {
  // Who’s using the app right now?
  const [profiles, setProfiles] = useState(loadProfiles());
  const [person, setPerson] = useState(profiles[0] || "");
  const [state, setState] = useState(() => makeFreshState(person || ""));

  // Load/save per-person state
  useEffect(() => {
    ensureAnon(); // anon auth if Firebase is configured
  }, []);
  useEffect(() => {
    if (!person) return;
    setState(loadPersonState(person));
  }, [person]);
  useEffect(() => {
    if (!person) return;
    savePersonState(person, state);
  }, [person, state]);

  const dateToday = todayISO();
  const historyToday = useMemo(
    () => state.history.filter((h) => h.date === dateToday),
    [state.history, dateToday]
  );

  const categories = ["All", ...Array.from(new Set(state.quests.map((q) => q.category)))];
  const [cat, setCat] = useState("All");
  const filtered = state.quests.filter((q) => cat === "All" || q.category === cat);

  async function completeQuest(q) {
    if (!person) {
      alert("Select or add a person first.");
      return;
    }
    const entry = {
      id: uid(),
      date: dateToday,
      questId: q.id,
      title: q.title,
      points: q.points,
      emoji: q.emoji,
      category: q.category,
      timestamp: Date.now(),
    };
    const newHistory = [entry, ...state.history];
    const newXP = state.xp + q.points;

    // level calc
    let lvl = state.level;
    let rem = newXP;
    let need = xpForLevel(lvl);
    while (rem >= need) {
      rem -= need;
      lvl += 1;
      need = xpForLevel(lvl);
    }

    // streak calc
    const totalToday = newHistory
      .filter((h) => h.date === dateToday)
      .reduce((s, h) => s + h.points, 0);
    let streak = state.streak;
    let last = state.lastGoalDate;
    if (totalToday >= state.settings.dailyGoal && last !== dateToday) {
      const y = new Date(dateToday);
      y.setDate(y.getDate() - 1);
      streak = last === y.toISOString().slice(0, 10) ? streak + 1 : 1;
      last = dateToday;
    }

    const next = { ...state, history: newHistory, xp: newXP, level: lvl, streak, lastGoalDate: last, name: person };
    setState(next);

    // Write to Firestore (optional)
    await logActivity({
      title: q.title,
      points: q.points,
      category: q.category,
      dateISO: dateToday,
      name: person,
    });
  }

  function exportCSV() {
    if (!person) return;
    const rows = [
      ["person", "date", "time", "title", "category", "points"],
      ...state.history.map((h) => [
        person,
        h.date,
        new Date(h.timestamp).toLocaleTimeString(),
        h.title,
        h.category || "",
        h.points,
      ]),
    ];
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `taphr-activity-${person}-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // right column stats
  const total7 = useMemo(() => {
    const byDate = {};
    state.history.forEach((h) => (byDate[h.date] = (byDate[h.date] || 0) + h.points));
    return Object.keys(byDate)
      .sort()
      .slice(-7)
      .reduce((s, d) => s + byDate[d], 0);
  }, [state.history]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Sales & Marketing Game</h1>
          <PeopleBar
            person={person}
            setPerson={setPerson}
            profiles={profiles}
            setProfiles={setProfiles}
            onExportCSV={exportCSV}
          />
        </header>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {/* LEFT: game board */}
          <div className="md:col-span-2 space-y-6">
            {/* Progress */}
            <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Today's Progress</h2>
                <div className="flex items-center gap-2 text-sm">
                  <span>Goal:</span>
                  <input
                    type="number"
                    value={state.settings.dailyGoal}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        settings: {
                          ...s.settings,
                          dailyGoal: clamp(parseInt(e.target.value || 0), 10, 10000),
                        },
                      }))
                    }
                    className="w-24 px-2 py-1 border rounded-lg"
                  />
                  <span>pts</span>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${
                      clamp(
                        Math.round(
                          historyToday.reduce((s, h) => s + h.points, 0) /
                            state.settings.dailyGoal *
                            100
                        ),
                        0,
                        100
                      )
                    }%`,
                  }}
                />
              </div>
              <div className="mt-2 text-sm opacity-80">
                {historyToday.reduce((s, h) => s + h.points, 0)} / {state.settings.dailyGoal} pts
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-3 py-2 rounded-xl border shadow-sm text-sm ${
                    cat === c ? "bg-black text-white" : ""
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Quests grid */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((q) => (
                <div key={q.id} className="p-4 rounded-2xl border shadow-sm bg-white/70 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{q.emoji || "🎯"}</span>
                      <div>
                        <div className="font-semibold">{q.title}</div>
                        <div className="text-xs opacity-70">
                          {q.category} • {q.points} pts
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => completeQuest(q)}
                    className="px-3 py-2 rounded-xl bg-black text-white hover:opacity-90"
                  >
                    Complete +{q.points}
                  </button>
                </div>
              ))}
            </div>

            {/* Today's activity */}
            <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
              <h3 className="font-semibold mb-3">Today's Activity</h3>
              {historyToday.length === 0 && (
                <div className="text-sm opacity-70">No activity yet. Complete a quest!</div>
              )}
              <ul className="space-y-2">
                {historyToday
                  .slice()
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((h) => (
                    <li key={h.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{h.emoji || "🎯"}</span>
                        <span className="font-medium">{h.title}</span>
                        <span className="opacity-60">• {new Date(h.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <span className="font-semibold">+{h.points}</span>
                    </li>
                  ))}
              </ul>
            </div>

            {/* Leaderboard */}
            <Leaderboard />
          </div>

          {/* RIGHT: panel */}
          <div className="space-y-6">
            <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
              <h3 className="font-semibold">Stats</h3>
              <div className="text-sm">Current streak: <span className="font-semibold">{state.streak}</span> day{state.streak === 1 ? "" : "s"}</div>
              <div className="text-sm">Level: <span className="font-semibold">{state.level}</span></div>
              <div className="text-sm">Last 7 days points: <span className="font-semibold">{total7}</span></div>
            </div>

            <Badges state={state} />
            <Timer settings={state.settings} />

            <div className="p-4 rounded-2xl border shadow-sm bg-white/60">
              <h3 className="font-semibold mb-2">Tips</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Weight high-impact actions with higher points.</li>
                <li>Set a realistic daily goal and protect focus time.</li>
                <li>Use “Complete” only for meaningful progress.</li>
                <li>Export CSV on Fridays to review your week.</li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="text-xs opacity-60 mt-10">
          Multi-user (per-person profiles) • Optional Firebase anonymous logging for leaderboard
        </footer>
      </div>
    </div>
  );
}
