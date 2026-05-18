import { useState, useEffect, useCallback } from "react";

// ── CONFIG ─────────────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxBXdrbzWWIXpV1ZuY4pwCdXNUYcej5Sag7s90K7uyoKiSXH9cqL9kC6o1YMOg9z_X6g/exec";

const TEAMS = {
  "Team Rog":     ["Jarhem", "Kyle", "Giane", "Fred", "Marc", "Gladys", "Carlo", "Rog"],
  "Team Joma":    ["Quinn", "Vaughn", "Paul", "Joshua", "Edmark", "Lemor", "Johnny", "Joma"],
  "Team Kat":     ["Stephen", "Lhizel", "Feb Vincent", "Ronamy", "Vincent C", "Hawkins", "Marcel", "Kat"],
  "Team Emil":    ["Vermil", "Arjel", "Jaycee", "Ryand", "Emil"],
  "Team Emman":   ["Darell", "Nino", "Jayve", "Raphael", "Emman"],
  "Team Patrick": ["Justin", "Drianna", "Karl", "Gelo", "Sir Daniel", "Rob", "Johann", "Adelbert", "Patrick"],
  "Team Kino":    ["Mark Lim", "Ellenor", "Vincent", "Marcus", "Larry", "Ford", "Grant", "Kino"],
};

const TEAM_LEADS = ["Rog", "Joma", "Kat", "Emil", "Emman", "Patrick", "Kino"];
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

// Returns Monday–Sunday dates for a given week offset (0 = this week, -1 = last week)
const getWeekDays = (offset = 0) => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
};

const formatWeekLabel = (offset) => {
  if (offset === 0) return "This Week";
  if (offset === -1) return "Last Week";
  const days = getWeekDays(offset);
  const start = new Date(days[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const end = new Date(days[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${start} – ${end}`;
};

// ── DATA LAYER ─────────────────────────────────────────────────────────────────
async function fetchLogs() {
  try {
    const res = await fetch("/api/logs");
    const data = await res.json();
    if (data.logs) {
      const normalized = data.logs.map(l => ({
        ...l,
        date: l.date ? l.date.split("T")[0] : l.date,
        totalVideos: Number(l.totalVideos) || 0,
        onTime: Number(l.onTime) || 0,
        overtime: Number(l.overtime) || 0,
        revisions: Number(l.revisions) || 0,
        beforeNoon: Number(l.beforeNoon) || 0,
        afterNoon: Number(l.afterNoon) || 0,
        blockers: Array.isArray(l.blockers) ? l.blockers : (l.blockers ? l.blockers.split("|") : []),
      }));
      localStorage.setItem("vde-logs-v1", JSON.stringify(normalized));
      return normalized;
    }
    throw new Error("No logs in response");
  } catch (e) {
    console.warn("Falling back to localStorage:", e);
    const raw = localStorage.getItem("vde-logs-v1");
    return raw ? JSON.parse(raw) : [];
  }
}

async function submitLog(entry) {
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", entry }),
    });
    const raw = localStorage.getItem("vde-logs-v1");
    const existing = raw ? JSON.parse(raw) : [];
    localStorage.setItem("vde-logs-v1", JSON.stringify([...existing, entry]));
  } catch (e) {
    console.error("Remote save failed", e);
    const raw = localStorage.getItem("vde-logs-v1");
    const existing = raw ? JSON.parse(raw) : [];
    localStorage.setItem("vde-logs-v1", JSON.stringify([...existing, entry]));
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
    amber:  "bg-amber-900/60 text-amber-300 border-amber-700",
  };
  return <span className={`text-xs px-2 py-0.5 rounded border font-mono ${p[color]}`}>{children}</span>;
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 ${className}`}>{children}</div>
);

const Stat = ({ label, value, sub, accent = false, color = "emerald" }) => {
  const colors = {
    emerald: "text-emerald-400",
    amber:   "text-amber-400",
    white:   "text-white",
  };
  const valueColor = accent ? colors[color] || colors.emerald : colors.white;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-black font-mono ${valueColor}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
};

// Wraps any element with a small "NEW" badge in the top-right corner.
// Used to flag recently-added features so the team notices them.
const NewBadge = ({ children, className = "" }) => (
  <div className={`relative ${className}`}>
    <span
      className="absolute -top-2 -right-2 z-10 bg-amber-500 text-black text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-md"
      style={{ boxShadow: "0 0 0 3px #09090b" }}
    >
      NEW
    </span>
    {children}
  </div>
);

// Compresses & resizes an image File before base64-encoding it.
// Reduces a 3–5 MB screenshot to ~100–200 KB — dramatically speeds up upload.
const compressImage = (file, maxWidth = 1280, quality = 0.72) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            const r2 = new FileReader();
            r2.onload = () => resolve({
              base64: r2.result.split(",")[1],
              type: "image/jpeg",
              name: file.name.replace(/\.[^.]+$/, ".jpg"),
            });
            r2.readAsDataURL(blob);
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

// ── LOG FORM ───────────────────────────────────────────────────────────────────
function LogForm({ onSubmit }) {
  const [form, setForm] = useState({
    team: "", vde: "", date: today(),
    totalVideos: "", onTime: "", overtime: "",
    revisions: "",
    beforeNoon: "", afterNoon: "",
    blockers: [], otherBlocker: "", wins: "",
  });
  const [screenshots, setScreenshots] = useState([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleBlocker = (b) =>
    set("blockers", form.blockers.includes(b)
      ? form.blockers.filter((x) => x !== b)
      : [...form.blockers, b]);

  const handleScreenshot = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setScreenshots((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshotPreviews((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const removeScreenshot = (idx) => {
    setScreenshots((prev) => prev.filter((_, i) => i !== idx));
    setScreenshotPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = () => {
    if (!form.team) return "Team is required.";
    if (!form.vde) return "Name is required.";
    if (!form.date) return "Date is required.";
    if (form.totalVideos === "") return "Total videos is required.";
    if (form.onTime === "") return "On-time count is required.";
    if (form.overtime === "") return "OT count is required.";
    if (form.revisions === "") return "Revisions count is required (enter 0 if none).";
    if (form.beforeNoon === "") return "Before noon count is required.";
    if (form.afterNoon === "") return "After noon count is required.";
    if (form.blockers.length === 0) return "Please select at least one blocker (or None if no blockers).";
    if (!form.wins.trim()) return "Wins / Learnings is required.";
    if (!screenshots.length) return "At least one CapCut project screenshot is required.";
    const t = parseInt(form.totalVideos);
    const r = parseInt(form.revisions) || 0;
    // Time-of-day counts all work done (new videos + revisions)
    if ((parseInt(form.beforeNoon) + parseInt(form.afterNoon)) > (t + r))
      return "Before + after noon can't exceed total output (new videos + revisions).";
    // On-time / OT still apply only to new videos
    if ((parseInt(form.onTime) + parseInt(form.overtime)) > t)
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
      revisions: parseInt(form.revisions) || 0,
      beforeNoon: parseInt(form.beforeNoon) || 0,
      afterNoon: parseInt(form.afterNoon) || 0,
      screenshotNames: screenshots.map((s) => s.name).join("|"),
      submittedAt: new Date().toISOString(),
    };
    // Compress screenshots to JPEG before encoding — reduces 4 × ~3 MB to ~4 × ~150 KB.
    if (screenshots.length) {
      entry.screenshotsBase64 = await Promise.all(screenshots.map((f) => compressImage(f)));
    }
    await onSubmit(entry);
    setSaving(false);
    setSubmitted(true);
  };

  const resetForm = () => {
    setSubmitted(false);
    setScreenshots([]);
    setScreenshotPreviews([]);
    setForm({ team: "", vde: "", date: today(), totalVideos: "", onTime: "", overtime: "", revisions: "", beforeNoon: "", afterNoon: "", blockers: [], otherBlocker: "", wins: "" });
  };

  if (submitted) {
    const displayDate = form.date
      ? new Date(form.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "";
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <div className="text-5xl">✅</div>
        <p className="text-xl font-bold text-white">Log submitted!</p>
        <p className="text-sm text-emerald-400 font-mono">{new Date(form.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <p className="text-zinc-400 text-sm">Great work today. See you tomorrow.</p>
        <button onClick={resetForm} className="mt-2 text-xs text-zinc-500 underline">Submit another entry</button>
      </div>
    );
  }

  const inp = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors";
  const lbl = "block text-xs text-zinc-400 uppercase tracking-widest mb-1.5";
  const req = <span className="text-red-400 ml-0.5">*</span>;
  const teamMembers = form.team ? TEAMS[form.team] : [];

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6 pb-10">
      <p className="text-xs text-zinc-500">All fields marked <span className="text-red-400">*</span> are required</p>

      <div>
        <label className={lbl}>Your Team {req}</label>
        <select className={inp} value={form.team} onChange={(e) => { set("team", e.target.value); set("vde", ""); }}>
          <option value="">— Select Team —</option>
          {Object.keys(TEAMS).map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label className={lbl}>Your Name {req}</label>
        <select className={inp} value={form.vde} onChange={(e) => set("vde", e.target.value)} disabled={!form.team}>
          <option value="">— Select Name —</option>
          {teamMembers.map((n) => <option key={n}>{n}</option>)}
        </select>
      </div>

      <div>
        <label className={lbl}>Date {req}</label>
        <input type="date" className={inp} value={form.date} onChange={(e) => set("date", e.target.value)} />
      </div>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">New Videos {req}</p>
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

      <NewBadge>
        <div className="bg-zinc-900 border border-amber-700/40 rounded-xl p-5">
          <p className="text-xs text-amber-300 uppercase tracking-widest mb-1">Revisions Today {req}</p>
          <p className="text-xs text-zinc-600 mb-4">Count of revision tasks completed. Tracked separately from new videos. Enter 0 if none.</p>
          <div>
            <label className={lbl}>Revisions</label>
            <input type="number" min="0" max="50" placeholder="0"
              className="w-full bg-zinc-800 border border-amber-700/50 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              value={form.revisions} onChange={(e) => set("revisions", e.target.value)} />
          </div>
        </div>
      </NewBadge>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">Time of Day {req}</p>
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
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Blockers Today {req}</p>
        <p className="text-xs text-zinc-600 mb-4">Select at least one. Choose "None" if no blockers.</p>
        <div className="flex flex-wrap gap-2">
          {["None", ...BLOCKERS_OPTIONS].map((b) => (
            <button key={b} onClick={() => {
              if (b === "None") {
                set("blockers", form.blockers.includes("None") ? [] : ["None"]);
              } else {
                const without = form.blockers.filter(x => x !== "None");
                set("blockers", without.includes(b) ? without.filter(x => x !== b) : [...without, b]);
              }
            }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${form.blockers.includes(b)
                ? b === "None" ? "bg-emerald-900/70 border-emerald-600 text-emerald-300" : "bg-red-900/70 border-red-600 text-red-300"
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
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">What Worked / Wins / Learnings {req}</p>
        <textarea className={`${inp} h-24 resize-none`}
          placeholder="Share something that worked today, a tip, or a win..."
          value={form.wins} onChange={(e) => set("wins", e.target.value)} />
      </Card>

      <Card>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">CapCut Project Screenshots {req}</p>
        <p className="text-xs text-zinc-600 mb-4">Upload one or more screenshots of your uploaded CapCut project file(s).</p>
        {screenshotPreviews.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {screenshotPreviews.map((previewSrc, i) => (
              <div key={i} className="relative group">
                <img src={previewSrc} alt={`Preview ${i + 1}`} className="w-full h-24 object-cover rounded-lg border border-zinc-700" />
                <button type="button" onClick={() => removeScreenshot(i)}
                  className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow">×</button>
              </div>
            ))}
          </div>
        )}
        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${screenshots.length ? "border-emerald-600 bg-emerald-900/20" : "border-zinc-700 hover:border-zinc-500"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" /></svg>
          <span className="text-xs text-zinc-400">{screenshots.length ? `Tap to add more (${screenshots.length} selected)` : "Tap to upload screenshot(s)"}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleScreenshot} />
        </label>
      </Card>

      {error && <p className="text-red-400 text-sm text-center bg-red-900/20 border border-red-800 rounded-lg py-3 px-4">{error}</p>}

      <button onClick={handleSubmit} disabled={saving}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors text-sm tracking-wide">
        {saving ? "Uploading & Saving..." : "Submit Daily Log →"}
      </button>
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard({ logs, onRefresh, loading, weekOffset, setWeekOffset }) {
  const [tab, setTab] = useState("today");
  const [teamFilter, setTeamFilter] = useState("All Teams");
  const todayStr = today();
  const teamOptions = ["All Teams", ...Object.keys(TEAMS)];
  const weekDays = getWeekDays(weekOffset);
  const todayInWeek = weekDays.includes(todayStr);

  const filtered = (set) => teamFilter === "All Teams" ? set : set.filter((l) => l.team === teamFilter);

  const todayLogs = filtered(logs.filter((l) => l.date === todayStr));
  const weekLogs = filtered(logs.filter((l) => weekDays.includes(l.date)));

  const teamStats = (set) => {
    const total = set.reduce((s, l) => s + l.totalVideos, 0);
    const onTime = set.reduce((s, l) => s + l.onTime, 0);
    const ot = set.reduce((s, l) => s + l.overtime, 0);
    const revisions = set.reduce((s, l) => s + (l.revisions || 0), 0);
    const bn = set.reduce((s, l) => s + l.beforeNoon, 0);
    const an = set.reduce((s, l) => s + l.afterNoon, 0);
    const uniqueVDEs = new Set(set.map((l) => l.vde)).size;
    return { total, onTime, ot, revisions, bn, an, avgPerVDE: uniqueVDEs ? (total / uniqueVDEs).toFixed(1) : "0.0" };
  };

  const byMember = (set) => {
    const map = {};
    for (const l of set) {
      if (!map[l.vde]) map[l.vde] = { total: 0, onTime: 0, overtime: 0, revisions: 0, beforeNoon: 0, afterNoon: 0, days: 0, blockers: [], team: l.team };
      map[l.vde].total += l.totalVideos;
      map[l.vde].onTime += l.onTime;
      map[l.vde].overtime += l.overtime;
      map[l.vde].revisions += (l.revisions || 0);
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

  const tabs = [
    { id: "today", label: "Today" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "weekly", label: "Weekly" },
    { id: "blockers", label: "Blockers" },
    { id: "wins", label: "Wins" },
  ];

  // Week navigator shown on all tabs except Today
  const WeekNav = () => (
    <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
      <button onClick={() => setWeekOffset(w => w - 1)}
        className="text-zinc-400 hover:text-white text-lg px-2 transition-colors">‹</button>
      <span className="text-xs text-zinc-300 font-medium">{formatWeekLabel(weekOffset)}</span>
      <button onClick={() => setWeekOffset(w => Math.min(0, w + 1))}
        disabled={weekOffset === 0}
        className="text-zinc-400 hover:text-white disabled:opacity-30 text-lg px-2 transition-colors">›</button>
    </div>
  );

  const renderToday = () => {
    const stats = teamStats(todayLogs);
    const memberData = byMember(todayLogs);
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card><Stat label="New Videos" value={stats.total} accent /></Card>
          <Card><Stat label="Avg / VDE" value={stats.avgPerVDE} sub="target: 4.0" accent={parseFloat(stats.avgPerVDE) >= 4} /></Card>
          <NewBadge>
            <div className="bg-zinc-900 border border-amber-700/40 rounded-xl p-5">
              <Stat label="Revisions" value={stats.revisions} sub="all teams" accent color="amber" />
            </div>
          </NewBadge>
          <Card><Stat label="On-Time" value={stats.onTime} sub={stats.total ? `${Math.round(stats.onTime / stats.total * 100)}%` : "—"} /></Card>
          <Card><Stat label="OT Videos" value={stats.ot} /></Card>
        </div>

        {(teamFilter === "All Teams" ? Object.keys(TEAMS) : [teamFilter]).map((teamName) => {
          const teamVideoTotal = TEAMS[teamName].reduce((s, n) => s + (memberData[n]?.total || 0), 0);
          const teamRevTotal = TEAMS[teamName].reduce((s, n) => s + (memberData[n]?.revisions || 0), 0);
          return (
            <Card key={teamName}>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">{teamName}</p>
              {TEAMS[teamName].map((name) => {
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
                      {d.revisions > 0 && <Tag color="amber">{d.revisions} rev</Tag>}
                    </div>
                  </div>
                );
              })}
              {(teamVideoTotal > 0 || teamRevTotal > 0) && (
                <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">team total</span>
                  <div className="flex gap-2 items-center">
                    <span className="text-emerald-400 font-mono font-bold">{teamVideoTotal} new</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-amber-400 font-mono font-bold">{teamRevTotal} revisions</span>
                  </div>
                </div>
              )}
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
        <WeekNav />
        {sorted.length === 0 && <p className="text-zinc-500 text-sm">No data for this week yet.</p>}
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
              <div className="flex gap-1.5">
                <Tag color={d.total / d.days >= 4 ? "green" : "yellow"}>{d.total} total</Tag>
                {d.revisions > 0 && <Tag color="amber">{d.revisions} rev</Tag>}
              </div>
              <span className="text-xs text-zinc-500">{(d.total / d.days).toFixed(1)}/day avg</span>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderWeekly = () => (
    <div className="flex flex-col gap-4">
      <WeekNav />
      {weekDays.map((date) => {
        const dayLogs = filtered(logs.filter((l) => l.date === date));
        const stats = teamStats(dayLogs);
        const pct = Math.min(100, (parseFloat(stats.avgPerVDE) / 4) * 100);
        const isToday = date === todayStr;
        const isFuture = date > todayStr;
        return (
          <Card key={date} className={isFuture ? "opacity-30" : ""}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {isToday && <span className="ml-2 text-xs text-emerald-400">today</span>}
              </span>
              <span className="text-sm font-mono text-zinc-300">
                {isFuture ? "—" : `${stats.avgPerVDE}`} <span className="text-zinc-600">/ 4.0</span>
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              {!isFuture && (
                <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-red-600"}`}
                  style={{ width: `${pct}%` }} />
              )}
            </div>
            <div className="flex gap-3 mt-2 text-xs text-zinc-500">
              {isFuture ? <span>—</span> : <>
                <span>{stats.total} videos</span>
                <span>{dayLogs.length} logs</span>
                {stats.ot > 0 && <span className="text-amber-500">{stats.ot} OT</span>}
              </>}
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
        <WeekNav />
        {freq.length === 0 && <p className="text-zinc-500 text-sm">No blockers reported this week.</p>}
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
    const wins = [...filtered(logs)].filter((l) => l.wins?.trim() && weekDays.includes(l.date)).reverse();
    return (
      <div className="flex flex-col gap-3">
        <WeekNav />
        {wins.length === 0 && <p className="text-zinc-500 text-sm">No wins shared this week.</p>}
        {wins.map((l) => (
          <Card key={l.id}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-400">{l.vde}</span>
                <span className="text-xs text-zinc-600">{l.team}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {new Date(l.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
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
      {/* Team filter */}
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

      {/* Tab bar */}
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
  const [weekOffset, setWeekOffset] = useState(0);

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
          <Dashboard logs={logs} onRefresh={loadData} loading={loading} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
        )}
      </div>
    </div>
  );
}
