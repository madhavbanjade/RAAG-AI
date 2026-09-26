/* ============================================
   DocuMind — App logic
   ============================================ */

const strategyMeta = [
  { key: "simpleChunking", icon: "▦", label: "Simple Chunking", color: "var(--strategy-simple)" },
  { key: "semanticChunking", icon: "◆", label: "Semantic Chunking", color: "var(--strategy-semantic)" },
  { key: "hybridSearch", icon: "▤", label: "Hybrid Search", color: "var(--strategy-hybrid)" },
  { key: "reranking", icon: "▽", label: "Reranking", color: "var(--strategy-rerank)" },
];

const strategiesEl = document.getElementById("strategies");
const improvementChartEl = document.getElementById("improvementChart");

function strategyDetail(key, info) {
  if (!info) return "Waiting for upload…";
  switch (key) {
    case "simpleChunking":
      return `${info.count} chunk(s) — ${info.pct}% end on a clean sentence boundary`;
    case "semanticChunking":
      return `${info.count} chunk(s) — ${info.pct}% topical coherence`;
    case "hybridSearch":
      return `${info.embedded}/${info.total} chunks embedded`;
    case "reranking":
      return info.available ? "Jina reranker active" : "No JINA_API_KEY set — skipped";
    default:
      return "";
  }
}

function renderStrategies(data) {
  strategiesEl.innerHTML = "";
  strategyMeta.forEach((meta) => {
    const info = data ? data[meta.key] : null;
    const pct = info ? info.pct : 0;

    const block = document.createElement("div");
    block.className = "strategy-block";
    block.innerHTML = `
      <div class="strategy-label">
        <span>${meta.icon} ${meta.label}</span>
        <span class="pct">${pct}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%; background:${meta.color};"></div>
      </div>
      <div class="text-11" style="opacity:.6;margin-top:2px;">${strategyDetail(meta.key, info)}</div>
    `;
    strategiesEl.appendChild(block);
  });
}

function smoothLinePath(points) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x},${prev.y} ${midX},${midY}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x},${last.y}`;
  return d;
}

function renderImprovementChart(data) {
  const pcts = strategyMeta.map((meta) => (data && data[meta.key] ? data[meta.key].pct : 0));
  const barColors = ["#d9f0e4", "#9ddbb8", "#4fb87f", "#0f6b45"];

  const width = 170;
  const height = 122;
  const padTop = 32;
  const padBottom = 12;
  const baseline = height - padBottom;
  const maxBarHeight = height - padTop - padBottom;
  const barWidth = 26;
  const gap = 12;
  const startX = (width - (pcts.length * barWidth + (pcts.length - 1) * gap)) / 2;

  const points = pcts.map((pct, i) => {
    const x = startX + i * (barWidth + gap);
    const barHeight = Math.max((pct / 100) * maxBarHeight, 3);
    const y = baseline - barHeight;
    return { x, y, barHeight, pct, cx: x + barWidth / 2 };
  });

  const bars = points
    .map(
      (p, i) => `<rect x="${p.x}" y="${p.y}" width="${barWidth}" height="${p.barHeight}" rx="6" fill="${barColors[i]}"></rect>`
    )
    .join("");

  const linePts = points.map((p) => ({ x: p.cx, y: p.y - 8 }));
  const linePath = smoothLinePath(linePts);
  const first = points[0];
  const last = points[points.length - 1];
  const firstLineY = linePts[0].y;
  const lastLineY = linePts[linePts.length - 1].y;

  improvementChartEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="improveLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#c0453a" />
          <stop offset="100%" stop-color="#0f6b45" />
        </linearGradient>
        <filter id="improveGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <line x1="${startX - 4}" y1="${baseline}" x2="${startX + pcts.length * barWidth + (pcts.length - 1) * gap + 4}" y2="${baseline}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3" />
      <path d="${linePath}" fill="none" stroke="url(#improveLine)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
      ${bars}
      <circle cx="${first.cx}" cy="${firstLineY}" r="4" fill="#fff" stroke="#c0453a" stroke-width="2" />
      <text x="${first.cx}" y="${firstLineY - 9}" font-size="11" fill="#c0453a" text-anchor="middle" font-family="var(--font-mono)">${first.pct}%</text>
      <circle cx="${last.cx}" cy="${lastLineY}" r="5" fill="#0f6b45" stroke="#fff" stroke-width="2" filter="url(#improveGlow)" />
      <text x="${last.cx}" y="${lastLineY - 10}" font-size="13" font-weight="700" fill="#0f6b45" text-anchor="middle" font-family="var(--font-display)">${last.pct}%</text>
    </svg>
  `;
}

renderStrategies(null);
renderImprovementChart(null);

/* ---------- Elements ---------- */
const authOverlay = document.getElementById("authOverlay");
const authTrigger = document.getElementById("authTrigger");
const authClose = document.getElementById("authClose");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authNameField = document.getElementById("authNameField");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const authToggleText = document.getElementById("authToggleText");
const authToggleLink = document.getElementById("authToggleLink");
const userLabel = document.getElementById("userLabel");
const userAvatar = document.getElementById("userAvatar");
const userChip = document.getElementById("userChip");
const logoutBtn = document.getElementById("logoutBtn");
const headerDivider = document.getElementById("headerDivider");
const statChunksPill = document.getElementById("statChunksPill");
const statModelPill = document.getElementById("statModelPill");
const crumbDoc = document.getElementById("crumbDoc");

const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const chatLog = document.getElementById("chatLog");
const chatLocked = document.getElementById("chatLocked");
const queryInput = document.getElementById("queryInput");
const sendBtn = document.getElementById("sendBtn");

const analysisLocked = document.getElementById("analysisLocked");
const analysisContent = document.getElementById("analysisContent");
const sourcesLocked = document.getElementById("sourcesLocked");
const sourcesScroll = document.getElementById("sourcesScroll");
const analysisCountEl = document.getElementById("analysisCount");
const sourcesCountEl = document.getElementById("sourcesCount");
const uploadProgress = document.getElementById("uploadProgress");

let authMode = "login"; // or "register"
let conversationId = null;
let documentActive = false;
let currentFileUrl = null;

const session = {
  queries: 0,
  totalTimeMs: 0,
  confidence: { high: 0, medium: 0, low: 0 },
  sources: [], // { idx, page, score, text }
};

/* ---------- Tabs ---------- */
document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
}

/* ---------- Auth ---------- */
function setComposerEnabled(enabled) {
  queryInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  queryInput.placeholder = enabled
    ? "Ask a question about this document..."
    : "Upload a PDF to start chatting...";
}

function isLoggedIn() {
  return !!getToken();
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

function refreshAuthUI() {
  const loggedIn = isLoggedIn();
  authTrigger.classList.toggle("hidden", loggedIn);
  logoutBtn.classList.toggle("hidden", !loggedIn);
  userChip.classList.toggle("hidden", !loggedIn);
  headerDivider.classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    const user = getUser();
    const label = user?.name || user?.email || "";
    userLabel.textContent = label;
    userAvatar.textContent = getInitials(user?.name || user?.email);
  }
}

function openAuth() {
  authOverlay.classList.remove("hidden");
  authError.textContent = "";
}
function closeAuth() {
  authOverlay.classList.add("hidden");
}

authTrigger.addEventListener("click", openAuth);
authClose.addEventListener("click", closeAuth);
authOverlay.addEventListener("click", (e) => {
  if (e.target === authOverlay) closeAuth();
});

authToggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  authMode = authMode === "login" ? "register" : "login";
  authError.textContent = "";
  if (authMode === "register") {
    authTitle.textContent = "Create an account";
    authNameField.style.display = "";
    authName.required = true;
    authSubmit.textContent = "Register →";
    authToggleText.textContent = "Already have an account?";
    authToggleLink.textContent = "Log in";
  } else {
    authTitle.textContent = "Sign in to DocuMind";
    authNameField.style.display = "none";
    authName.required = false;
    authSubmit.textContent = "Continue →";
    authToggleText.textContent = "Don't have an account?";
    authToggleLink.textContent = "Register";
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  authSubmit.disabled = true;

  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    const result =
      authMode === "register"
        ? await register(authName.value.trim(), email, password)
        : await login(email, password);

    setSession(result.token, result.user);
    closeAuth();
    refreshAuthUI();
    await initApp();
  } catch (err) {
    authError.textContent = err.message || "Something went wrong";
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  clearSession();
  resetToZeroState();
  refreshAuthUI();
});

function resetChatUI() {
  chatLog.innerHTML = "";
  chatLog.appendChild(chatLocked);
  chatLocked.classList.remove("hidden");
}

// Full teardown of everything a logged-in session accumulated: the document
// preview, the strategy/analysis/sources panels, and session stats. Without
// this, logging out left the previous user's PDF and stats visibly on
// screen even though the chat/composer were locked.
function resetToZeroState() {
  conversationId = null;
  documentActive = false;
  currentFileUrl = null;

  resetChatUI();
  setComposerEnabled(false);
  renderStrategies(null);
  renderImprovementChart(null);

  document.getElementById("fileName").textContent = "No document selected";
  document.getElementById("fileSub").textContent = "Upload a PDF to start querying";
  uploadBtn.textContent = "Upload";
  statChunksPill.classList.add("hidden");
  statModelPill.classList.add("hidden");
  crumbDoc.textContent = "no document";
  document.getElementById("pdfFrame").innerHTML = `
    <div class="empty-state">
      <div class="big">No document selected</div>
      <div class="text-13">Drop a PDF or click to browse to preview it here</div>
    </div>`;

  session.queries = 0;
  session.totalTimeMs = 0;
  session.confidence = { high: 0, medium: 0, low: 0 };
  session.sources = [];
  analysisCountEl.textContent = "0";
  sourcesCountEl.textContent = "0";
  renderAnalysis();
  renderSources();
}

// Rebuilds the Analysis/Sources panels from persisted message metadata
// (confidence/timeMs/sources), so they survive a reload or relogin instead
// of always starting back at zero.
function rebuildSessionFromHistory(history) {
  session.queries = 0;
  session.totalTimeMs = 0;
  session.confidence = { high: 0, medium: 0, low: 0 };
  session.sources = [];

  history.forEach((msg) => {
    if (msg.role !== "assistant" || !msg.confidence) return;
    session.queries += 1;
    session.totalTimeMs += msg.timeMs || 0;
    session.confidence[msg.confidence] = (session.confidence[msg.confidence] || 0) + 1;
    (msg.sources || []).forEach((s) => {
      session.sources.push({
        idx: session.sources.length + 1,
        page: s.page ?? 1,
        score: s.rerankScore ?? s.score ?? 0,
        text: s.text || (s.documentName ? `From ${s.documentName}` : ""),
      });
    });
  });

  analysisCountEl.textContent = session.queries;
  sourcesCountEl.textContent = session.sources.length;
  renderAnalysis();
  renderSources();
}

/* ---------- App bootstrap ---------- */
async function initApp() {
  refreshAuthUI();
  if (!isLoggedIn()) return;

  try {
    const status = await getDemoStatus();
    documentActive = !!status.active;

    if (status.active) {
      applyDocumentActive(status.fileName, `${status.chunks} chunks ready`, status.chunks, status.fileUrl, status.strategies);
    } else {
      setComposerEnabled(false);
    }
  } catch {
    setComposerEnabled(false);
  }

  try {
    conversationId = await getOrCreateConversation();

    // Without a document there's nothing to chat about yet — keep the
    // locked state showing instead of rendering the conversation (which,
    // for a brand-new user, is just the auto-generated greeting message).
    if (!documentActive) return;

    const history = await getConversationHistory(conversationId);
    if (history.length) chatLocked.classList.add("hidden");
    history.forEach(renderHistoryMessage);
    // More than the single auto-generated greeting means the user actually
    // exchanged messages before — that's the only case worth a "welcome back".
    if (history.length > 1) {
      addAssistantNote("👋 Welcome back! Here's where we left off.");
    }
    rebuildSessionFromHistory(history);
  } catch (err) {
    if (documentActive) {
      addAssistantNote("Couldn't load your conversation history. You can still ask questions below.");
    }
  }
}

function applyDocumentActive(fileName, subText, chunkCount, fileUrl, strategies) {
  if (strategies) {
    renderStrategies(strategies);
    renderImprovementChart(strategies);
  }
  document.getElementById("fileName").textContent = fileName || "Document";
  document.getElementById("fileSub").textContent = subText;
  document.getElementById("statChunks").textContent = chunkCount ?? 0;
  statChunksPill.classList.remove("hidden");
  statModelPill.classList.remove("hidden");
  crumbDoc.textContent = fileName || "document";
  uploadBtn.textContent = "Replace";
  chatLocked.classList.add("hidden");
  analysisLocked.classList.add("hidden");
  analysisContent.classList.remove("hidden");
  currentFileUrl = fileUrl || null;
  if (fileUrl) {
    document.getElementById("pdfFrame").innerHTML =
      `<iframe id="pdfIframe" src="${SERVER_ORIGIN}${fileUrl}" style="width:100%;height:100%;border:0;" title="${fileName}"></iframe>`;
  }
  renderAnalysis();
  renderSources();
  setComposerEnabled(true);
}

/* ---------- Upload ---------- */
uploadBtn.addEventListener("click", () => {
  if (!isLoggedIn()) { openAuth(); return; }
  fileInput.click();
});

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById("fileName").textContent = file.name;
  document.getElementById("fileSub").textContent = "Uploading and processing your document — this can take a moment…";
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Processing…";
  fileInput.disabled = true;
  uploadProgress.classList.remove("hidden");

  try {
    const meta = await uploadPDF(file);

    documentActive = true;
    applyDocumentActive(file.name, `${meta.pages} pages · ${meta.sizeKB} KB`, meta.chunks, meta.fileUrl, meta.strategies);

    if (!meta.fileUrl) {
      document.getElementById("pdfFrame").innerHTML = `
        <div class="pdf-page">
          <h2>${file.name.replace(".pdf", "")}</h2>
          <p>Preview unavailable for this file.</p>
        </div>
      `;
    }

    // Replacing a PDF wipes the backend conversation and drops in a
    // "new document uploaded" note — reload history instead of appending
    // onto whatever was on screen from the previous document.
    chatLog.innerHTML = "";
    chatLog.appendChild(chatLocked);
    const history = await getConversationHistory(conversationId);
    if (history.length) {
      history.forEach(renderHistoryMessage);
    } else {
      addAssistantNote("Document ready — ask a question below to get started.");
    }
    rebuildSessionFromHistory(history);
  } catch (err) {
    document.getElementById("fileSub").textContent = "Upload failed — try again";
    addAssistantNote(err.message || "Upload failed. Please try again.");
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = documentActive ? "Replace" : "Upload";
    fileInput.disabled = false;
    fileInput.value = "";
    uploadProgress.classList.add("hidden");
  }
});

/* ---------- Composer ---------- */
function autoGrow() {
  queryInput.style.height = "auto";
  queryInput.style.height = Math.min(queryInput.scrollHeight, 120) + "px";
}
queryInput.addEventListener("input", autoGrow);
queryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
queryInput.addEventListener("focus", () => {
  if (!isLoggedIn()) { queryInput.blur(); openAuth(); }
});
sendBtn.addEventListener("click", send);

function addUserMsg(text) {
  chatLocked.classList.add("hidden");
  const div = document.createElement("div");
  div.className = "msg user";
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function addAssistantNote(text) {
  chatLocked.classList.add("hidden");
  const div = document.createElement("div");
  div.className = "msg bot";
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function buildBotMsgEl(res) {
  const div = document.createElement("div");
  div.className = "msg bot";
  const withCites = res.answer.replace(/\[(\d+)\]/g, (m, n) => `<span class="cite">${n}</span>`);
  const answerHtml = marked.parse(withCites);
  const confidence = res.confidence || "medium";
  const confLabel = confidence[0].toUpperCase() + confidence.slice(1) + " confidence";
  const sources = res.sources || [];

  div.innerHTML = `
    <div>${answerHtml}</div>
    <div class="bot-meta">
      <span class="badge ${confidence}">${confLabel}</span>
      <span class="meta-time">${res.timeMs ?? 0}ms</span>
      <span class="sources-toggle">› Sources (${sources.length})</span>
    </div>
    <div class="sources-panel">
      ${sources
        .map(
          (s) => `
        <div class="source-item">
          <div class="row1"><span>Page ${s.page}</span><span class="score">${Math.round((s.score || 0) * 100)}%</span></div>
          <div>${s.text}</div>
        </div>`
        )
        .join("")}
    </div>
  `;
  div.querySelector(".sources-toggle").addEventListener("click", () => {
    div.querySelector(".sources-panel").classList.toggle("open");
  });
  return div;
}

function addBotMsg(res) {
  chatLocked.classList.add("hidden");
  const div = buildBotMsgEl(res);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;

  recordSessionStats(res);
}

// Re-renders a persisted assistant message (confidence/sources/timeMs already
// saved by the backend) the same way a live answer looks — markdown, citation
// chips, confidence badge, sources panel — instead of the plain-text note
// used for system messages. Doesn't touch session stats: rebuildSessionFromHistory
// already accounts for these from the raw history array, so counting here too
// would double them.
function addBotMsgFromHistory(msg) {
  chatLocked.classList.add("hidden");
  const sources = (msg.sources || []).map((s) => ({
    text: s.text || (s.documentName ? `From ${s.documentName}` : ""),
    score: s.rerankScore ?? s.score ?? 0,
    page: s.page ?? 1,
  }));
  const div = buildBotMsgEl({ answer: msg.content, sources, confidence: msg.confidence, timeMs: msg.timeMs });
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderHistoryMessage(msg) {
  if (msg.role === "user") addUserMsg(msg.content);
  else if (msg.confidence) addBotMsgFromHistory(msg);
  else addAssistantNote(msg.content);
}

/* ---------- Analysis + Sources aggregation (UI-only bookkeeping) ---------- */
function recordSessionStats(res) {
  session.queries += 1;
  session.totalTimeMs += res.timeMs;
  session.confidence[res.confidence] = (session.confidence[res.confidence] || 0) + 1;
  res.sources.forEach((s) => {
    session.sources.push({ idx: session.sources.length + 1, page: s.page, score: s.score, text: s.text });
  });

  analysisCountEl.textContent = session.queries;
  sourcesCountEl.textContent = session.sources.length;
  renderAnalysis();
  renderSources();
}

function renderAnalysis() {
  if (session.queries === 0) {
    analysisLocked.classList.remove("hidden");
    analysisContent.classList.add("hidden");
    return;
  }
  analysisLocked.classList.add("hidden");
  analysisContent.classList.remove("hidden");

  document.getElementById("statQueries").textContent = session.queries;
  document.getElementById("statAvgTime").textContent = Math.round(session.totalTimeMs / session.queries) + "ms";
  document.getElementById("statTotalSources").textContent = session.sources.length;

  const dist = document.getElementById("confidenceDist");
  const max = Math.max(session.confidence.high, session.confidence.medium, session.confidence.low, 1);
  const rows = [
    ["High", session.confidence.high, "var(--status-high)"],
    ["Medium", session.confidence.medium, "var(--status-medium)"],
    ["Low", session.confidence.low, "var(--status-low)"],
  ];
  dist.innerHTML = rows
    .map(
      ([label, count, color]) => `
    <div class="confidence-row">
      <span class="conf-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(count / max) * 100}%; background:${color};"></div></div>
      <span class="conf-count">${count}</span>
    </div>`
    )
    .join("");
}

function renderSources() {
  if (session.sources.length === 0) {
    sourcesScroll.innerHTML = "";
    sourcesScroll.appendChild(sourcesLocked);
    sourcesLocked.classList.remove("hidden");
    return;
  }
  sourcesScroll.innerHTML = session.sources
    .slice()
    .reverse()
    .map(
      (s) => `
    <div class="source-card">
      <div class="row1">
        <span class="cite-idx">[${s.idx}]</span>
        <span class="page-num">· page ${s.page}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(s.score * 100)}%; background:var(--accent);"></div></div>
        <span class="score-pct">${Math.round(s.score * 100)}%</span>
        <button class="view-link" data-page="${s.page}">View →</button>
      </div>
      <div class="snippet">${s.text ? s.text.slice(0, 220) : "No preview available"}</div>
    </div>`
    )
    .join("");

  sourcesScroll.querySelectorAll(".view-link").forEach((btn) => {
    btn.addEventListener("click", () => jumpToPage(btn.dataset.page));
  });
}

function jumpToPage(page) {
  const iframe = document.getElementById("pdfIframe");
  if (iframe && currentFileUrl) {
    iframe.src = `${SERVER_ORIGIN}${currentFileUrl}#page=${page}`;
  }
}

async function send() {
  if (!isLoggedIn()) { openAuth(); return; }
  if (!documentActive || !conversationId) return;
  const text = queryInput.value.trim();
  if (!text) return;
  addUserMsg(text);
  queryInput.value = "";
  autoGrow();
  sendBtn.disabled = true;

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.innerHTML = `<span class="spinner"></span> Thinking…`;
  chatLog.appendChild(typing);
  chatLog.scrollTop = chatLog.scrollHeight;

  try {
    const res = await sendChatMessage(conversationId, text);
    typing.remove();
    addBotMsg(res);
  } catch (err) {
    typing.remove();
    addAssistantNote(err.message || "Something went wrong. Please try again.");
  } finally {
    sendBtn.disabled = false;
  }
}

/* ---------- Boot ---------- */
refreshAuthUI();
setComposerEnabled(false);
if (getToken()) {
  initApp();
} else {
  openAuth();
}
