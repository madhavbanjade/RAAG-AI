/* ============================================
   DocuMind — Backend integration
   Talks to the RAG NestJS API.
   ============================================ */

const SERVER_ORIGIN = window.DOCUMIND_API_ORIGIN || "http://localhost:3001";
const API_BASE = `${SERVER_ORIGIN}/api/v1`;

const TOKEN_KEY = "documind_token";
const USER_KEY = "documind_user";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseErrorMessage(res) {
  try {
    const body = await res.json();
    if (Array.isArray(body.message)) return body.message.join(", ");
    return body.message || "Something went wrong";
  } catch {
    return "Something went wrong";
  }
}

async function register(name, email, password) {
  const res = await fetch(`${API_BASE}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const body = await res.json();
  return body.data; // { token, user }
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const body = await res.json();
  return body.data; // { token, user }
}

async function getDemoStatus() {
  const res = await fetch(`${API_BASE}/demo/status`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  return await res.json(); // { active, fileName?, fileUrl?, chunks? }
}

async function uploadPDF(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/demo/upload`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });

  if (!res.ok) throw new Error(await parseErrorMessage(res));

  // { pages, sizeKB, chunks, fileUrl, strategies: { simpleChunking, semanticChunking, hybridSearch, reranking } }
  return await res.json();
}

async function getOrCreateConversation() {
  const listRes = await fetch(`${API_BASE}/chat/user?page=1&limit=1`, {
    headers: { ...authHeaders() },
  });

  if (listRes.ok) {
    const body = await listRes.json();
    const existing = body?.data?.conversations?.[0];
    if (existing?._id) return existing._id;
  }

  const createRes = await fetch(`${API_BASE}/chat/conversation`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!createRes.ok) throw new Error(await parseErrorMessage(createRes));
  const created = await createRes.json();
  return created.data._id;
}

async function getConversationHistory(conversationId) {
  const res = await fetch(`${API_BASE}/chat/history/${conversationId}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) return []; // e.g. 404 "not found" when history is empty
  const body = await res.json();
  return body.data || [];
}

async function sendChatMessage(conversationId, message) {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/chat/conversation/${conversationId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message }),
  });

  if (!res.ok) throw new Error(await parseErrorMessage(res));

  const body = await res.json();
  const timeMs = Math.round(performance.now() - start);

  // Backend returns { answer, sources: [{documentName, page, score, rerankScore}], verification }
  // Normalize into the shape the UI renders: { answer, sources: [{text, score, page}], confidence, timeMs }
  const confidenceScore = body?.verification?.confidence;
  let confidence = "medium";
  if (typeof confidenceScore === "number") {
    confidence = confidenceScore >= 0.75 ? "high" : confidenceScore >= 0.4 ? "medium" : "low";
  } else if (body?.verification?.grounded === false) {
    confidence = "low";
  }

  const sources = (body.sources || []).map((s) => ({
    text: s.text || (s.documentName ? `From ${s.documentName}` : ""),
    score: s.rerankScore ?? s.score ?? 0,
    page: s.page ?? 1,
  }));

  return {
    answer: body.answer,
    sources,
    confidence,
    timeMs,
  };
}
