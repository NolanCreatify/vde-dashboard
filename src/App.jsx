import { useState, useEffect, useCallback } from "react";

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxBXdrbzWWIXpV1ZuY4pwCdXNUYcej5Sag7s90K7uyoKiSXH9cqL9kC6o1YMOg9z_X6g/exec";

const TEAMS = {
  "Team Rog":   ["Jarhem", "Kyle", "Giane", "Fred", "Marc", "Gladys", "Carlo", "Rog"],
  "Team Joma":  ["Stephen", "Quinn", "Feb", "Vaughn", "Paul", "Kat", "Lhizel", "Joma"],
  "Team Emil":  ["Vermil", "Raphael", "Arjel", "Nino", "Emil"],
  "Team Emman": ["Ryand", "Darell", "Jaycee", "Jayve", "Emman"],
};

const TEAM_LEADS = ["Rog", "Joma", "Emil", "Emman"];
const ALL_MEMBERS = Object.values(TEAMS).flat();

const BLOCKERS_OPTIONS = [
  "Script issues / late script",
  "Slow asset loading",
  "Platform / tool lag",
  "Unclear creative brief",
  "Revision requests",
  "Personal focus issues",
  "Technical errors / crashes",
  "Waiting on feedback",
  "Other",
];

const today = () => new Date().toISOString().split("T")[0];

const last7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

// ── DATA LAYER ─────────────────────────────────────────────────────────────────
async function fetchLogs() {
  if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") {
    const raw = localStorage.getItem("vde-logs-v1");
    return raw ? JSON.parse(raw) : [];
  }
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=get`);
    const data = await res.json();
    return data.logs || [];
  } catch {
    const raw = localStorage.getItem("vde-logs-v1");
    return raw ? JSON.parse(raw) : [];
  }
}

async function submitLog(entry) {
  const existing = JSON.parse(localStorage.getItem("vde-logs-v1") || "[]");
  localStorage.setItem("vde-logs-v1", JSON.stringify([...existing, entry]));
  if (APPS_SCRIPT_URL === "YOUR_APPS_SCRIPT_URL_HERE") return;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ action: "add", entry }),
    });
  } catch (e) {
    console.error("Remote save failed, kept local copy", e);
  }
}

// ── UI PRIMITIVES ──────────────────────────────────────────────────────────────
const Tag = ({ children, color = "green" }) => {
  const p = {
    green:  "bg-emerald-900/60 text-emerald-300 border-emerald-700",
    yellow: "bg-amber-900/60 text-amber-300 border-amber-700",
    red:    "bg-red-900/60 text-red-300 border-red-700",
    blue:   "bg-sky-900/60 text-sky-300 border-sky-700",
    gray:   "bg-zinc-800 text-zinc-400 border-zinc-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded border font-mono ${p[color]}`}>{children}</span>;
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${className}`}>{children}</div>
);

const Stat = ({ label, value, sub, accent = false }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-zinc-500 uppercase tracking-widest">{label}</span>
    <span className={`text-2xl font-black font-mono ${accent ? "text-emerald-400" : "text-white"}`}>{value}</span>
    {sub && <span className="text-xs text-zinc-500">{sub}</span>}
  </div>
);

// ── LOG FORM ───────────────────────────────────────────────────────────────────
function LogForm({ onSubmit }) {
  const [form, setForm] = useState({
    team: "", vde: "", date: today(),
    totalVideos: "", onTime: "", overtime: "",
    beforeNoon: "", afterNoon: "",
    blockers: [], otherBlocker: "", wins: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleBlocker = (b) =>
    set("blockers", form.blockers.includes(b)
      ? form.blockers.filter((x) => x !== b)
      : [...form.blockers, b]);

  const validate = () => {
    if (!form.team) return "Please select your team.";
    if (!form.vde) return "Please select your name.";
    if (!form.totalVideos) return "Total videos is required.";
    const t = parseInt(form.totalVideos);
    if ((parseInt(form.beforeNoon || 0) + parseInt(form.afterNoon || 0)) > t)
      return "Before + after noon can't exceed total videos.";
    if ((parseInt(form.onTime || 0) + parseInt(form.overtime || 0)) > t)
      return "On-time + OT can't exceed total videos.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setSaving(true);
    const entry = {
      id: Date.now(), ...form,
      totalVideos: parseInt(form.totalVideos) || 0,
      onTime: parseInt(form.onTime) || 0,
      overtime: parseInt(form.overtime) || 0,
      beforeNoon: parseInt(form.beforeNoon) || 0,
      afterNoon: parseInt(form.afterNoon) || 0,
      submittedAt: new Date().toISOString(),
    };
    await onSubmit(entry);
    setSaving(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <div className="text-5xl">✅</div>
        <p className="text-xl font-bold text-white">Log submitted!</p>
        <p className="text-zinc-400 text-sm">Great work today. See you tomorrow.</p>
        <button onClick={() => { setSubmitted(false); setForm({ team: "", vde: "", date: today(), totalVideos: "", onTime: "", overtime: "", beforeNoon: "", afterNoon: "", blockers: [], otherBlocker: "", wins: "" }); }}
          className="mt-2 text-xs text-zinc-500 underline">Submit another entry</button>
      </div>
    );
  }

  const inp = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors";
  const lbl = "block text-xs text-zinc-400 uppercase tracking-widest mb-1.5";
  const teamMembers = form.team ? TEAMS[form.team] : [];

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6 pb-10">
      <div>
        <label className={lbl}>Your Team</label>
        <select className={inp} value={form.team} onChange={(e) => set("team", e.target.value) || set("vde", "")}>
          <option value="">— Select Team —</option>
          {Object.keys(TEAMS).map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={lbl}>Your Name</label>
        <select className={inp} value={form.vde} onChange={(e) => set("vde", e.target.value)} disabled={!form.team}>
          <option value="">— Select Name —</option>
          {teamMembers.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>

      <div>
        <label className={lbl}>Date</label>
        <input type="date" className={inp} value={form.date} onChange={(e) => set("date", e.target.value)} />
      </div>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">Video Count</p>
        <div className="grid grid-cols-3 gap-3">
          {[["Total", "totalVideos"], ["On-Time", "onTime"], ["OT", "overtime"]].map(([label, key]) => (
            <div key={key}>
              <label className={lbl}>{label}</label>
              <input type="number" min="0" max="20" placeholder="0" className={inp}
                value={form[key]} onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">Time of Day</p>
        <div className="grid grid-cols-2 gap-3">
          {[["Before Noon", "beforeNoon"], ["After Noon", "afterNoon"]].map(([label, key]) => (
            <div key={key}>
              <label className={lbl}>{label}</label>
              <input type="number" min="0" max="20" placeholder="0" className={inp}
                value={form[key]} onChange={(e) => set(key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">Blockers Today</p>
        <div className="flex flex-wrap gap-2">
          {BLOCKERS_OPTIONS.map((b) => (
            <button key={b} onClick={() => toggleBlocker(b)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${form.blockers.includes(b)
                ? "bg-red-900/70 border-red-600 text-red-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {b}
            </button>
          ))}
        </div>
        {form.blockers.includes("Other") && (
          <textarea className={`${inp} mt-3 h-16 resize-none`}
            placeholder="Describe the blocker..."
            value={form.otherBlocker} onChange={(e) => set("otherBlocker", e.target.value)} />
        )}
      </Card>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">What Worked / Wins / Learnings</p>
        <textarea className={`${inp} h-24 resize-none`}
          placeholder="Share something that worked today, a tip, or a win..."
          value={form.wins} onChange={(e) => set("wins", e.target.value)} />
      </Card>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button onClick={handleSubmit} disabled={saving}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-sm tracking-wide">
        {saving ? "Saving..." : "Submit Daily Log →"}
      </button>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard({ logs, onRefresh, loading }) {
  const [tab, setTab] = useState("today");
  const [teamFilter, setTeamFilter] = useState("All Teams");
  const todayStr = today();
  const days = last7Days();

  const teamOptions = ["All Teams", ...Object.keys(TEAMS)];

  const filtered = (set) => teamFilter === "All Teams"
    ? set
    : set.filter((l) => l.team === teamFilter);

  const todayLogs = filtered(logs.filter((l) => l.date === todayStr));
  const weekLogs = filtered(logs.filter((l) => days.includes(l.date)));

  const teamStats = (set) => {
    const total = set.reduce((s, l) => s + l.totalVideos, 0);
    const onTime = set.reduce((s, l) => s + l.onTime, 0);
    const ot = set.reduce((s, l) => s + l.overtime, 0);
    const bn = set.reduce((s, l) => s + l.beforeNoon, 0);
    const an = set.reduce((s, l) => s + l.afterNoon, 0);
    const uniqueVDEs = new Set(set.map((l) => l.vde)).size;
    const avgPerVDE = uniqueVDEs ? (total / uniqueVDEs).toFixed(1) : "0.0";
    return { total, onTime, ot, bn, an, avgPerVDE };
  };

  const byMember = (set) => {
    const map = {};
    for (const l of set) {
      if (!map[l.vde]) map[l.vde] = { total: 0, onTime: 0, overtime: 0, beforeNoon: 0, afterNoon: 0, days: 0, blockers: [], team: l.team };
      map[l.vde].total += l.totalVideos;
      map[l.vde].onTime += l.onTime;
      map[l.vde].overtime += l.overtime;
      map[l.vde].beforeNoon += l.beforeNoon;
      map[l.vde].afterNoon += l.afterNoon;
      map[l.vde].days += 1;
      map[l.vde].blockers.push(...l.blockers);
    }
    return map;
  };

  const blockerFreq = (set) => {
    const freq = {};
    for (const l of set) for (const b of l.blockers) freq[b] = (freq[b] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  };

  const visibleMembers = teamFilter === "All Teams"
    ? ALL_MEMBERS
    : TEAMS[teamFilter];

  const tabs = [
    { id: "today", label: "Today" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "weekly", label: "Weekly" },
    { id: "blockers", label: "Blockers" },
    { id: "wins", label: "Wins" },
  ];

  const TeamFilter = () => (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {teamOptions.map((t) => (
        <button key={t} onClick={() => setTeamFilter(t)}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${teamFilter === t
            ? "bg-emerald-700 text-white"
            : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
          {t}
        </button>
      ))}
    </div>
  );

  const renderToday = () => {
    const stats = teamStats(todayLogs);
    const memberData = byMember(todayLogs);
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><Stat label="Total Videos" value={stats.total} accent /></Card>
          <Card><Stat label="Avg / VDE" value={stats.avgPerVDE} sub="target: 4.0" accent={parseFloat(stats.avgPerVDE) >= 4} /></Card>
          <Card><Stat label="On-Time" value={stats.onTime} sub={stats.total ? `${Math.round(stats.onTime / stats.total * 100)}%` : "—"} /></Card>
          <Card><Stat label="OT Videos" value={stats.ot} /></Card>
        </div>

        {/* Per-team breakdown */}
        {(teamFilter === "All Teams" ? Object.keys(TEAMS) : [teamFilter]).map((teamName) => {
          const members = TEAMS[teamName];
          return (
            <Card key={teamName}>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">{teamName}</p>
              {members.map((name) => {
                const d = memberData[name];
                const isLead = TEAM_LEADS.includes(name);
                if (!d) return (
                  <div key={name} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${isLead ? "text-emerald-400 font-bold" : "text-zinc-500"}`}>{name}</span>
                      {isLead && <Tag color="blue">Lead</Tag>}
                    </div>
                    <Tag color="gray">No log yet</Tag>
                  </div>
                );
                return (
                  <div key={name} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${isLead ? "text-emerald-400" : "text-white"}`}>{name}</span>
                      {isLead && <Tag color="blue">Lead</Tag>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 font-mono">{d.beforeNoon}↑ {d.afterNoon}↓</span>
                      <Tag color={d.total >= 4 ? "green" : d.total >= 3 ? "yellow" : "red"}>{d.total} videos</Tag>
                      {d.overtime > 0 && <Tag color="yellow">{d.overtime} OT</Tag>}
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })}

        <div className="grid grid-cols-2 gap-4">
          <Card><Stat label="Before Noon" value={stats.bn} sub="videos" /></Card>
          <Card><Stat label="After Noon" value={stats.an} sub="videos" /></Card>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    const memberData = byMember(weekLogs);
    const sorted = Object.entries(memberData).sort((a, b) => b[1].total - a[1].total);
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500">Last 7 days</p>
        {sorted.length === 0 && <p className="text-zinc-500 text-sm">No data yet.</p>}
        {sorted.map(([name, d], i) => (
          <Card key={name} className="flex items-center gap-4">
            <span className="text-2xl">{medals[i] || `#${i + 1}`}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white">{name}</p>
                {TEAM_LEADS.includes(name) && <Tag color="blue">Lead</Tag>}
              </div>
              <p className="text-xs text-zinc-500">{d.team} · {d.days} day{d.days !== 1 ? "s" : ""} logged</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Tag color={d.total / d.days >= 4 ? "green" : "yellow"}>{d.total} total</Tag>
              <span className="text-xs text-zinc-500">{(d.total / d.days).toFixed(1)}/day avg</span>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderWeekly = () => (
    <div className="flex flex-col gap-4">
      {days.map((date) => {
        const dayLogs = filtered(logs.filter((l) => l.date === date));
        const stats = teamStats(dayLogs);
        const pct = Math.min(100, (parseFloat(stats.avgPerVDE) / 4) * 100);
        const isToday = date === todayStr;
        return (
          <Card key={date}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {isToday && <span className="ml-2 text-xs text-emerald-400">today</span>}
              </span>
              <span className="text-sm font-mono text-zinc-300">{stats.avgPerVDE} <span className="text-zinc-600">/ 4.0</span></span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-red-600"}`}
                style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-3 mt-2 text-xs text-zinc-500">
              <span>{stats.total} videos</span>
              <span>{dayLogs.length} logs</span>
              {stats.ot > 0 && <span className="text-amber-500">{stats.ot} OT</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );

  const renderBlockers = () => {
    const freq = blockerFreq(weekLogs);
    const max = freq[0]?.[1] || 1;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500">Last 7 days — {weekLogs.length} entries</p>
        {freq.length === 0 && <p className="text-zinc-500 text-sm">No blockers reported yet.</p>}
        {freq.map(([blocker, count]) => (
          <Card key={blocker}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white">{blocker}</span>
              <Tag color={count >= 4 ? "red" : count >= 2 ? "yellow" : "gray"}>{count}×</Tag>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderWins = () => {
    const wins = [...filtered(logs)].filter((l) => l.wins?.trim()).reverse().slice(0, 30);
    return (
      <div className="flex flex-col gap-3">
        {wins.length === 0 && <p className="text-zinc-500 text-sm">No wins shared yet.</p>}
        {wins.map((l) => (
          <Card key={l.id}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-400">{l.vde}</span>
                <span className="text-xs text-zinc-600">{l.team}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {new Date(l.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{l.wins}</p>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <TeamFilter />
      <div className="flex items-center justify-between">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`whitespace-nowrap text-xs px-3.5 py-2 rounded-lg font-medium transition-all ${tab === t.id ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} disabled={loading}
          className="text-xs text-zinc-500 hover:text-white transition-colors ml-2 shrink-0">
          {loading ? "..." : "↻"}
        </button>
      </div>
      {tab === "today" && renderToday()}
      {tab === "leaderboard" && renderLeaderboard()}
      {tab === "weekly" && renderWeekly()}
      {tab === "blockers" && renderBlockers()}
      {tab === "wins" && renderWins()}
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("form");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await fetchLogs();
    setLogs(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (entry) => {
    await submitLog(entry);
    setLogs((prev) => [...prev, entry]);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <div className="border-b border-zinc-800 sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-black text-lg tracking-tight">VDE DASHBOARD</span>
            <span className="text-zinc-600 text-xs">daily log</span>
          </div>
          <div className="flex gap-1">
            {["form", "dashboard"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${view === v ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"}`}>
                {v === "form" ? "Log Day" : "Dashboard"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading && view === "dashboard" ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-zinc-500 text-sm animate-pulse">Loading...</span>
          </div>
        ) : view === "form" ? (
          <LogForm onSubmit={handleSubmit} />
        ) : (
          <Dashboard logs={logs} onRefresh={loadData} loading={loading} />
        )}
      </div>
    </div>
  );
}
