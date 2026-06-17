/* app.js — TestMu AI Sales Assessments (vanilla SPA) */

const AppState = (window.AppState = {
  idToken: null,
  user: null,        // { email, name, domain }
  profile: null,     // { designation, manager }
  doc: null,         // questions.public.json
  attempts: {},      // assessmentId -> { attemptsUsed, attemptsRemaining, passed, locked, bestPercent }
  isAdmin: false,
  quiz: null,        // active quiz session
});

const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ───────────────────────── boot ─────────────────────────
window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const res = await fetch("data/questions.public.json", { cache: "no-cache" });
    AppState.doc = await res.json();
  } catch (e) {
    return mountError("Could not load questions. Run `npm run build` and redeploy.");
  }

  // restore a still-valid session (id tokens last ~1h)
  const saved = sessionStorage.getItem("idToken");
  if (saved) {
    const u = decodeUser(saved);
    if (u && u.exp * 1000 > Date.now()) setUser(saved, u);
  }

  $("#signOutBtn").addEventListener("click", signOut);
  $("#nav").addEventListener("click", (e) => {
    const r = e.target.getAttribute && e.target.getAttribute("data-route");
    if (r) route(r);
  });

  AppState.user ? afterLogin() : renderLogin();
}

// ───────────────────────── auth ─────────────────────────
function decodeUser(jwt) {
  try {
    const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return { email: (p.email || "").toLowerCase(), name: p.name || p.email, exp: p.exp,
             domain: (p.email || "").split("@")[1] || "" };
  } catch { return null; }
}

function renderLogin() {
  $("#nav").hidden = true;
  const cfg = window.APP_CONFIG;
  mount(el(`
    <section class="hero">
      <h1>Sales Product Assessments</h1>
      <p>Sign in with your <strong>${cfg.ALLOWED_DOMAINS.join("</strong> or <strong>")}</strong>
         work email to take your assessment. You get <strong>${cfg.MAX_ATTEMPTS} attempts</strong>;
         the passing score is <strong>${cfg.PASS_THRESHOLD}%</strong>.</p>
      <div class="signin-slot" id="gsiSlot"></div>
      <p class="muted" id="gsiHint" style="margin-top:18px;font-size:13px"></p>
    </section>`));
  initGsi();
}

function initGsi() {
  const cfg = window.APP_CONFIG;
  const slot = $("#gsiSlot");
  if (!cfg.GOOGLE_CLIENT_ID || cfg.GOOGLE_CLIENT_ID.indexOf("REPLACE_") === 0) {
    $("#gsiHint").textContent = "Google sign-in isn't configured yet (GOOGLE_CLIENT_ID in config.js).";
    return;
  }
  let tries = 0;
  const wait = setInterval(() => {
    if (window.google && google.accounts && google.accounts.id) {
      clearInterval(wait);
      google.accounts.id.initialize({ client_id: cfg.GOOGLE_CLIENT_ID, callback: onCredential });
      google.accounts.id.renderButton(slot, { theme: "filled_black", size: "large", shape: "pill", text: "signin_with" });
      google.accounts.id.prompt();
    } else if (++tries > 50) {
      clearInterval(wait);
      $("#gsiHint").textContent = "Couldn't load Google sign-in. Check your connection and refresh.";
    }
  }, 100);
}

function onCredential(response) {
  const jwt = response.credential;
  const u = decodeUser(jwt);
  if (!u) return ($("#gsiHint").textContent = "Sign-in failed. Please try again.");
  if (window.APP_CONFIG.ALLOWED_DOMAINS.indexOf(u.domain) === -1) {
    return ($("#gsiHint").textContent = "Please use your " + window.APP_CONFIG.ALLOWED_DOMAINS.join(" or ") + " work email.");
  }
  setUser(jwt, u);
  afterLogin();
}

function setUser(jwt, u) {
  AppState.idToken = jwt;
  AppState.user = u;
  AppState.isAdmin = window.APP_CONFIG.ADMIN_EMAILS.map((x) => x.toLowerCase()).indexOf(u.email) !== -1;
  sessionStorage.setItem("idToken", jwt);
  const p = localStorage.getItem("profile:" + u.email);
  AppState.profile = p ? JSON.parse(p) : null;
}

function signOut() {
  sessionStorage.removeItem("idToken");
  if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
  Object.assign(AppState, { idToken: null, user: null, profile: null, attempts: {}, isAdmin: false, quiz: null });
  renderLogin();
}

async function afterLogin() {
  $("#nav").hidden = false;
  $("#whoami").textContent = AppState.user.name;
  $("#navDashboard").hidden = !AppState.isAdmin;
  if (!AppState.profile) return renderProfile();
  route("home");
}

// ───────────────────────── profile ─────────────────────────
function renderProfile() {
  setActive(null);
  const cfg = window.APP_CONFIG;
  const opts = (arr) => arr.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  const view = el(`
    <section class="card" style="max-width:480px;margin:6vh auto 0">
      <h2 style="margin-top:0">Welcome, ${esc(AppState.user.name)}</h2>
      <p class="muted">Tell us your role so your manager can see your results.</p>
      <label>Designation (POD)</label>
      <select id="pfDesignation"><option value="" disabled selected>Select…</option>${opts(cfg.DESIGNATIONS)}</select>
      <label>Manager</label>
      <select id="pfManager"><option value="" disabled selected>Select…</option>${opts(cfg.MANAGERS)}</select>
      <div id="pfErr"></div>
      <button class="btn btn-primary" id="pfSave" style="margin-top:20px;width:100%">Continue</button>
    </section>`);
  mount(view);
  $("#pfSave").addEventListener("click", () => {
    const designation = $("#pfDesignation").value, manager = $("#pfManager").value;
    if (!designation || !manager) { $("#pfErr").innerHTML = `<div class="error">Please pick both your designation and manager.</div>`; return; }
    AppState.profile = { designation, manager };
    localStorage.setItem("profile:" + AppState.user.email, JSON.stringify(AppState.profile));
    route("home");
  });
}

// ───────────────────────── routing ─────────────────────────
function route(name) {
  if (name === "home") return renderHome();
  if (name === "dashboard") return AppState.isAdmin ? renderDashboard() : renderHome();
}
function setActive(name) {
  document.querySelectorAll(".nav-link").forEach((b) => b.classList.toggle("active", b.getAttribute("data-route") === name));
}

// ───────────────────────── home / assessment list ─────────────────────────
async function renderHome() {
  setActive("home");
  mount(el(`<div class="loading">Loading your assessments…</div>`));
  try {
    const data = await Api.getAttempts();
    AppState.attempts = data.attempts || {};
  } catch (e) {
    AppState.attempts = {}; // backend may be offline during local preview
  }

  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`
    <div class="card" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>Signed in as <strong>${esc(AppState.user.name)}</strong>
          · <span class="muted">${esc(AppState.profile.designation)} · ${esc(AppState.profile.manager)}</span></div>
        <button class="btn btn-ghost" id="editProfile">Edit role</button>
      </div>
    </div>`));

  AppState.doc.productLines.forEach((pl) => {
    wrap.appendChild(el(`<div class="section-head"><h2>${esc(pl.name)}</h2><span class="muted">${pl.assessments.length} assessments</span></div>`));
    const grid = el(`<div class="grid grid-2"></div>`);
    pl.assessments.forEach((a) => grid.appendChild(assessmentCard(pl, a)));
    wrap.appendChild(grid);
  });

  mount(wrap);
  $("#editProfile").addEventListener("click", renderProfile);
  wrap.querySelectorAll("[data-start]").forEach((b) =>
    b.addEventListener("click", () => startQuiz(b.getAttribute("data-start"))));
}

function assessmentCard(pl, a) {
  const cfg = window.APP_CONFIG;
  const st = AppState.attempts[a.id] || { attemptsUsed: 0, attemptsRemaining: cfg.MAX_ATTEMPTS, passed: false, locked: false, bestPercent: 0 };
  let status = `<span class="pill">${st.attemptsRemaining} of ${cfg.MAX_ATTEMPTS} attempts left</span>`;
  if (st.passed) status = `<span class="pill pass">Passed · ${st.bestPercent}%</span>`;
  else if (st.locked) status = `<span class="pill fail">Not passed · best ${st.bestPercent}%</span>`;
  else if (st.attemptsUsed > 0) status = `<span class="pill locked">Attempt ${st.attemptsUsed} done · best ${st.bestPercent}% · ${st.attemptsRemaining} left</span>`;

  const disabled = st.locked;
  const card = el(`
    <div class="card assess">
      <h3>${esc(a.title)}</h3>
      <div class="meta">${a.questionCount} questions · pass ${cfg.PASS_THRESHOLD}%</div>
      <div class="row">
        ${status}
        <button class="btn btn-primary" data-start="${a.id}" ${disabled ? "disabled" : ""}>
          ${st.attemptsUsed > 0 && !disabled ? "Retake" : "Start"}
        </button>
      </div>
    </div>`);
  return card;
}

// ───────────────────────── quiz ─────────────────────────
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function findAssessment(id) {
  for (const pl of AppState.doc.productLines) { const a = pl.assessments.find((x) => x.id === id); if (a) return { pl, a }; }
  return null;
}

function startQuiz(id) {
  const found = findAssessment(id);
  if (!found) return;
  const questions = shuffle(found.a.questions).map((q) => ({ ...q, options: shuffle(q.options) }));
  AppState.quiz = { pl: found.pl, a: found.a, questions, answers: {}, index: 0 };
  renderQuiz();
}

function renderQuiz() {
  setActive(null);
  const q = AppState.quiz;
  const total = q.questions.length;
  const answered = Object.keys(q.answers).length;
  const cur = q.questions[q.index];
  const sel = q.answers[cur.id];

  const view = el(`
    <section class="card">
      <div class="note">⚠️ This counts as one of your ${window.APP_CONFIG.MAX_ATTEMPTS} attempts. You can't see correct answers afterward — only your score.</div>
      <div class="quiz-head">
        <strong>${esc(q.a.title)}</strong>
        <span class="muted">Question ${q.index + 1} of ${total} · ${answered} answered</span>
      </div>
      <div class="progress"><div style="width:${Math.round(((q.index + 1) / total) * 100)}%"></div></div>
      <div class="q-text">${esc(cur.text)}</div>
      <div class="q-topic">${esc(cur.topic)}${cur.scope ? " · " + esc(cur.scope) : ""}</div>
      <div class="options">
        ${cur.options.map((o) => `
          <label class="option ${sel === o.id ? "selected" : ""}">
            <input type="radio" name="opt" value="${o.id}" ${sel === o.id ? "checked" : ""}/>
            <span>${esc(o.text)}</span>
          </label>`).join("")}
      </div>
      <div class="quiz-nav">
        <button class="btn" id="qPrev" ${q.index === 0 ? "disabled" : ""}>← Previous</button>
        ${q.index === total - 1
          ? `<button class="btn btn-primary" id="qSubmit">Submit assessment</button>`
          : `<button class="btn btn-primary" id="qNext">Next →</button>`}
      </div>
    </section>`);
  mount(view);

  view.querySelectorAll('input[name="opt"]').forEach((inp) =>
    inp.addEventListener("change", () => {
      q.answers[cur.id] = inp.value;
      view.querySelectorAll(".option").forEach((l) => l.classList.toggle("selected", l.querySelector("input").checked));
      $(".quiz-head .muted").textContent = `Question ${q.index + 1} of ${total} · ${Object.keys(q.answers).length} answered`;
    }));
  const prev = $("#qPrev"); if (prev) prev.addEventListener("click", () => { q.index--; renderQuiz(); });
  const next = $("#qNext"); if (next) next.addEventListener("click", () => { q.index++; renderQuiz(); });
  const submit = $("#qSubmit"); if (submit) submit.addEventListener("click", submitQuiz);
}

async function submitQuiz() {
  const q = AppState.quiz;
  const unanswered = q.questions.length - Object.keys(q.answers).length;
  if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question(s) (counted as wrong). Submit anyway?`)) return;

  $("#qSubmit").disabled = true;
  $("#qSubmit").textContent = "Submitting…";
  try {
    const r = await Api.submit({
      assessmentId: q.a.id, assessmentTitle: q.a.title,
      productLineId: q.pl.id, productLineName: q.pl.name,
      designation: AppState.profile.designation, manager: AppState.profile.manager,
      answers: q.answers,
    });
    AppState.quiz = null;
    renderResult(q.a, r);
  } catch (e) {
    $("#qSubmit").disabled = false;
    $("#qSubmit").textContent = "Submit assessment";
    mountError(e.message, true);
  }
}

function renderResult(a, r) {
  setActive(null);
  const pass = r.passed;
  const view = el(`
    <section class="card result">
      <div class="muted">${esc(a.title)}</div>
      <div class="score-ring ${pass ? "pass" : "fail"}">${r.percent}%</div>
      <h2 style="margin:0">${pass ? "✅ Passed" : "❌ Not passed"}</h2>
      <p class="muted">${r.score} of ${r.total} correct · passing score ${r.passThreshold}%</p>
      <p>${pass
        ? "Great work — you're cleared on this assessment."
        : (r.attemptsRemaining > 0
            ? `You have <strong>${r.attemptsRemaining}</strong> attempt(s) remaining.`
            : "You've used all your attempts. Please reach out to your manager.")}</p>
      <button class="btn btn-primary" id="backHome" style="margin-top:14px">Back to assessments</button>
    </section>`);
  mount(view);
  $("#backHome").addEventListener("click", () => route("home"));
}

// ───────────────────────── dashboard ─────────────────────────
async function renderDashboard() {
  setActive("dashboard");
  mount(el(`<div class="loading">Loading results…</div>`));
  let rows;
  try {
    const data = await Api.dashboard();
    rows = data.rows || [];
  } catch (e) { return mountError(e.message); }

  rows.forEach((r) => { r.percent = Number(r.percent) || 0; r.passed = r.passed === true || String(r.passed).toLowerCase() === "true"; });

  const distinct = (key) => Array.from(new Set(rows.map((r) => r[key]).filter(Boolean))).sort();
  const cfg = window.APP_CONFIG;

  const wrap = el(`<div></div>`);
  wrap.appendChild(el(`<div class="section-head"><h2>Manager Dashboard</h2><span class="muted">${rows.length} attempts recorded</span></div>`));
  const sel = (id, label, vals) => `<div><label>${label}</label><select id="${id}"><option value="">All</option>${vals.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></div>`;
  wrap.appendChild(el(`
    <div class="filters">
      ${sel("fProduct", "Product line", distinct("productLineName"))}
      ${sel("fDesignation", "Designation (POD)", cfg.DESIGNATIONS)}
      ${sel("fAssessment", "Assessment", distinct("assessmentTitle"))}
      ${sel("fManager", "Manager", cfg.MANAGERS)}
      ${sel("fResult", "Result", ["Passed", "Failed"])}
    </div>`));
  wrap.appendChild(el(`<div class="stats" id="stats"></div>`));
  wrap.appendChild(el(`<div class="table-wrap"><table id="tbl"></table></div>`));
  mount(wrap);
  $("#app").classList.add("wide"); // widen so the full results table (incl. timestamp) fits without horizontal scroll

  const apply = () => {
    const f = {
      product: $("#fProduct").value, designation: $("#fDesignation").value,
      assessment: $("#fAssessment").value, manager: $("#fManager").value, result: $("#fResult").value,
    };
    let view = rows.filter((r) =>
      (!f.product || r.productLineName === f.product) &&
      (!f.designation || r.designation === f.designation) &&
      (!f.assessment || r.assessmentTitle === f.assessment) &&
      (!f.manager || r.manager === f.manager) &&
      (!f.result || (f.result === "Passed" ? r.passed : !r.passed)));
    renderStats(view);
    renderTable(view);
  };
  wrap.querySelectorAll("select").forEach((s) => s.addEventListener("change", apply));
  apply();
}

function renderStats(rows) {
  const reps = new Set(rows.map((r) => r.email));
  const pairs = {}; // email|assessment -> passedEver
  rows.forEach((r) => { const k = r.email + "|" + r.assessmentId; pairs[k] = pairs[k] || r.passed; if (r.passed) pairs[k] = true; });
  const pairKeys = Object.keys(pairs);
  const passedPairs = pairKeys.filter((k) => pairs[k]).length;
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.percent, 0) / rows.length) : 0;
  const passRate = pairKeys.length ? Math.round((passedPairs / pairKeys.length) * 100) : 0;
  $("#stats").innerHTML = `
    <div class="stat"><div class="n">${reps.size}</div><div class="l">Reps</div></div>
    <div class="stat"><div class="n">${rows.length}</div><div class="l">Attempts</div></div>
    <div class="stat"><div class="n">${passRate}%</div><div class="l">Pass rate (rep × assessment)</div></div>
    <div class="stat"><div class="n">${avg}%</div><div class="l">Avg score</div></div>`;
}

let sortState = { key: "timestamp", dir: -1 };
function renderTable(rows) {
  const cols = [
    ["name", "Name"], ["email", "Email"], ["designation", "POD"], ["manager", "Manager"],
    ["productLineName", "Product line"], ["assessmentTitle", "Assessment"], ["attemptNumber", "Attempt"],
    ["percent", "Score %"], ["passed", "Result"], ["timestamp", "When"],
  ];
  const sorted = rows.slice().sort((a, b) => {
    let x = a[sortState.key], y = b[sortState.key];
    if (sortState.key === "timestamp") { x = new Date(x).getTime(); y = new Date(y).getTime(); }
    if (typeof x === "string") { x = x.toLowerCase(); y = String(y).toLowerCase(); }
    return (x > y ? 1 : x < y ? -1 : 0) * sortState.dir;
  });
  const fmtWhen = (t) => {
    try {
      const d = new Date(t);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
             ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    } catch { return esc(String(t)); }
  };
  const tbl = $("#tbl");
  tbl.innerHTML = `
    <thead><tr>${cols.map(([k, l]) => `<th data-k="${k}">${l}${sortState.key === k ? (sortState.dir === 1 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
    <tbody>${sorted.map((r) => `
      <tr>
        <td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.designation)}</td><td>${esc(r.manager)}</td>
        <td>${esc(r.productLineName)}</td><td>${esc(r.assessmentTitle)}</td><td>${esc(r.attemptNumber)}</td>
        <td>${r.percent}%</td>
        <td><span class="pill ${r.passed ? "pass" : "fail"}">${r.passed ? "Pass" : "Fail"}</span></td>
        <td>${fmtWhen(r.timestamp)}</td>
      </tr>`).join("")}</tbody>`;
  if (!sorted.length) tbl.innerHTML += `<tbody><tr><td colspan="${cols.length}" class="center muted" style="padding:24px">No results match these filters.</td></tr></tbody>`;
  tbl.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
    const k = th.getAttribute("data-k");
    sortState = { key: k, dir: sortState.key === k ? -sortState.dir : 1 };
    renderTable(rows);
  }));
}

// ───────────────────────── helpers ─────────────────────────
function mount(node) { const app = $("#app"); app.classList.remove("wide"); app.innerHTML = ""; app.appendChild(node); }
function mountError(msg, append) {
  const e = el(`<div class="error">${esc(msg)}</div>`);
  if (append) $("#app").appendChild(e); else mount(e);
}
