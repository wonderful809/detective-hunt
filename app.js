const STORAGE_KEY = "detectiveHuntState";
const TEAM_KEY = "detectiveHuntCurrentTeam";

const defaultState = {
  timerSeconds: 0,
  timerRunning: false,
  timerStartedAt: null,
  teams: []
};

const defaultClueCodes = Array.from({ length: 8 }, (_, i) => `CLUE-${String(i + 1).padStart(2, "0")}`);
const localClues = [
  { code: "CLUE-01", title: "The Start", clue_text: "I have four legs but cannot walk. I stay outside while others talk. I’m the quietest seat in the greenest space—find the next clue at my resting place." },
  { code: "CLUE-02", title: "Faraday's Block (Room 323)", clue_text: "Leave the grass and seek the spark, head to the block named after the man who tamed the dark. Ascend to the third level of this hive, and find the door where 300 meets 23." },
  { code: "CLUE-03", title: "Vishveswara Seminar Hall", clue_text: "From the classroom to the grand stage. Seek the hall named after the Father of Indian Engineering. Where the mics are live and the speeches are tall, find the entrance to this scholarly hall." },
  { code: "CLUE-04", title: "Canteen Water Filter", clue_text: "Brainpower requires hydration! Head to the hub of snacks and treats. Don't look at the tables or the seats—instead, find the silver flow that quenches every thirst. Your next hint is taped where the water comes first." },
  { code: "CLUE-05", title: "The Coded Scooty (AP39FK7467)", clue_text: "To move forward, find the Master’s two-wheeled steed in the parking rows. Its identity is AP39FK7467. Find this metal horse to move forward." },
  { code: "CLUE-06", title: "College Bus", clue_text: "The scooty is fast, but I carry the crowd. I’m big, I’m yellow, and I’m loud. Find the giant that takes you home every day; the next step is hidden near the Emergency Exit sign." },
  { code: "CLUE-07", title: "Saraswati Stage (APJ Abdul Kalam Block)", clue_text: "Move from the wheels to the Wings of Fire. Seek the block named after the Missile Man. At the feet of the Goddess of Wisdom (Saraswati), on the platform where many have performed, your final trial begins." },
  { code: "CLUE-08", title: "The Finale: Central Library (Luggage Area)", clue_text: "The hunt ends where knowledge is stored. Before entering the library, look at the Luggage Area pigeonholes and search for the locker containing the VLSI manual." }
];
let validClues = [...defaultClueCodes];
const clueTextToCode = new Map();
buildClueLookup(localClues);




function normalizeTextKey(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildClueLookup(clues) {
  clueTextToCode.clear();
  for (const clue of clues) {
    const code = String(clue.code || "").toUpperCase();
    if (!code) continue;

    const titleKey = normalizeTextKey(clue.title);
    const textKey = normalizeTextKey(clue.clue_text);

    if (titleKey) clueTextToCode.set(titleKey, code);
    if (textKey) clueTextToCode.set(textKey, code);
  }
}

function normalizeClueNumber(raw) {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 1 || num > 10) return null;
  return `CLUE-${String(num).padStart(2, "0")}`;
}

function parseClueValue(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();

  const normalizedRaw = normalizeTextKey(raw);
  if (clueTextToCode.has(normalizedRaw)) {
    return clueTextToCode.get(normalizedRaw) || null;
  }

  // Numeric-only format: 1..10
  if (/^\d{1,2}$/.test(upper)) {
    return normalizeClueNumber(upper);
  }

  // Plain formats: CLUE-1 / CLUE-01 / CLUE_01 / CLUE 01
  const plainMatch = upper.match(/^CLUE[-_\s]?(\d{1,2})$/);
  if (plainMatch) return normalizeClueNumber(plainMatch[1]);

  // Any text containing CLUE-xx token
  const tokenMatch = upper.match(/CLUE[-_\s]?(\d{1,2})/);
  if (tokenMatch) return normalizeClueNumber(tokenMatch[1]);

  // URL payload support (e.g., https://.../?clue=1 or ?code=CLUE-01)
  try {
    const url = new URL(raw);
    const params = ["clue", "code", "answer", "id"];
    for (const key of params) {
      const value = url.searchParams.get(key);
      if (!value) continue;
      const parsed = parseClueValue(value);
      if (parsed) return parsed;
    }
    if (url.hash) {
      const parsed = parseClueValue(url.hash.replace(/^#/, ""));
      if (parsed) return parsed;
    }
  } catch {
    // Not a URL payload; continue.
  }

  // JSON payload support (e.g., {"clue":"CLUE-01"})
  try {
    const parsedJson = JSON.parse(raw);
    if (parsedJson && typeof parsedJson === "object") {
      for (const key of ["clue", "code", "answer", "id"]) {
        if (parsedJson[key] == null) continue;
        const parsed = parseClueValue(parsedJson[key]);
        if (parsed) return parsed;
      }
    }
  } catch {
    // Not JSON payload.
  }

  for (const [textKey, code] of clueTextToCode.entries()) {
    if (textKey.length > 20 && normalizedRaw.includes(textKey)) {
      return code;
    }
  }

  return null;
}

let stream;
let detector;
let scanLoopRunning = false;
let scanLoopLastAt = 0;

function canUseBarcodeDetector() {
  return "BarcodeDetector" in window;
}

function canUseJsQr() {
  return typeof window.jsQR === "function";
}

function hasAnyQrDecoder() {
  return canUseBarcodeDetector() || canUseJsQr();
}

function getSupabaseConfig() {
  return {
    url: localStorage.getItem("supabaseUrl") || "",
    key: localStorage.getItem("supabaseKey") || ""
  };
}

function hasSupabaseConfig() {
  const cfg = getSupabaseConfig();
  return Boolean(cfg.url && cfg.key);
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadCluesFromSupabase() {
  if (!hasSupabaseConfig()) return;
  try {
    const data = await supabaseRequest("clues?select=code,title,clue_text&order=code.asc");
    if (Array.isArray(data) && data.length) {
      validClues = data.map((x) => String(x.code).toUpperCase());
      buildClueLookup(data);
    }
  } catch {
    scanMessage.textContent = "Supabase clue sync failed. Using local clues.";
  }
}

async function syncTeamToSupabase(team) {
  if (!hasSupabaseConfig()) return;
  try {
    await supabaseRequest("teams", {
      method: "POST",
      body: JSON.stringify({ id: team.id, team_name: team.name, members: team.members }),
      headers: { Prefer: "resolution=merge-duplicates" }
    });
  } catch {
    // keep game playable even if cloud sync fails
  }
}

async function logScanToSupabase(teamId, clueCode, gameTime, pointsAwarded) {
  if (!hasSupabaseConfig()) return;
  try {
    await supabaseRequest("scan_logs", {
      method: "POST",
      body: JSON.stringify({
        team_id: teamId,
        clue_code: clueCode,
        game_time_seconds: gameTime,
        points_awarded: pointsAwarded
      }),
      headers: { Prefer: "resolution=ignore-duplicates" }
    });
  } catch {
    // keep game playable even if cloud sync fails
  }
}

const byId = (id) => document.getElementById(id);
const timerDisplay = byId("timerDisplay");
const timerState = byId("timerState");
const leaderboardBody = byId("leaderboardBody");
const teamError = byId("teamError");
const teamPanel = byId("teamPanel");
const scannerPanel = byId("scannerPanel");
const teamInfo = byId("teamInfo");
const scanMessage = byId("scanMessage");
const successDialog = byId("successDialog");

const isAdmin = new URLSearchParams(location.search).get("mode") === "admin";
if (isAdmin) {
  byId("adminPanel").classList.remove("hidden");
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(defaultState);
}

function getElapsed(state) {
  if (!state.timerRunning || !state.timerStartedAt) return state.timerSeconds;
  const delta = Math.floor((Date.now() - state.timerStartedAt) / 1000);
  return state.timerSeconds + Math.max(delta, 0);
}

function formatTime(totalSec) {
  const min = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const sec = String(totalSec % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function render() {
  const state = loadState();
  const elapsed = getElapsed(state);
  timerDisplay.textContent = formatTime(elapsed);
  timerState.textContent = state.timerRunning ? "Running" : "Stopped";

  const ordered = [...state.teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const byTime = (a.lastCorrectAt ?? Infinity) - (b.lastCorrectAt ?? Infinity);
    if (byTime !== 0) return byTime;
    return a.name.localeCompare(b.name);
  });

  leaderboardBody.innerHTML = ordered
    .map((team, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${team.name}</td>
        <td>${team.members}</td>
        <td class="points-green">${team.points}</td>
        <td>${team.lastCorrectAt == null ? "-" : formatTime(team.lastCorrectAt)}</td>
      </tr>
    `)
    .join("");
}

setInterval(render, 1000);
window.addEventListener("storage", render);

function createTeam(name, members) {
  const state = loadState();
  if (state.teams.length >= 20) return "Maximum 20 teams reached.";
  if (state.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return "Team name already exists.";

  const cleanMembers = Number(members);
  if (cleanMembers < 3 || cleanMembers > 4) return "Team must have 3 to 4 members.";

  const team = {
    id: crypto.randomUUID(),
    name,
    members: cleanMembers,
    points: 0,
    solvedClues: [],
    lastCorrectAt: null
  };
  state.teams.push(team);
  saveState(state);
  localStorage.setItem(TEAM_KEY, team.id);
  void syncTeamToSupabase(team);
  return null;
}

function currentTeam() {
  const state = loadState();
  const id = localStorage.getItem(TEAM_KEY);
  return state.teams.find((t) => t.id === id);
}

function refreshTeamUI() {
  const team = currentTeam();
  const hasTeam = Boolean(team);
  teamPanel.classList.toggle("hidden", hasTeam);
  scannerPanel.classList.toggle("hidden", !hasTeam);
  if (team) {
    teamInfo.textContent = `Team: ${team.name} • Members: ${team.members} • Points: ${team.points}`;
  }
}

byId("teamForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = byId("teamName").value.trim();
  const members = byId("memberCount").value;
  if (!name) {
    teamError.textContent = "Please enter a team name.";
    return;
  }
  const err = createTeam(name, members);
  teamError.textContent = err ?? "";
  if (!err) {
    refreshTeamUI();
    render();
  }
});

function applyScan(rawValue) {
  const team = currentTeam();
  if (!team) return;

  const value = parseClueValue(rawValue);
  const state = loadState();
  const mutableTeam = state.teams.find((t) => t.id === team.id);

  if (!value || !validClues.includes(value)) {
    scanMessage.textContent = "Invalid QR for this clue. Scan another QR.";
    return;
  }

  if (mutableTeam.solvedClues.includes(value)) {
    scanMessage.textContent = "You already solved this clue. Find next one!";
    return;
  }

  mutableTeam.solvedClues.push(value);
  const awarded = 2;
  mutableTeam.points += awarded;
  mutableTeam.lastCorrectAt = getElapsed(state);
  saveState(state);

  void logScanToSupabase(mutableTeam.id, value, mutableTeam.lastCorrectAt, awarded);

  scanMessage.textContent = `Correct clue ${value}! +2 points.`;
  if (typeof successDialog.showModal === "function") successDialog.showModal();
  refreshTeamUI();
  render();
}

byId("manualBtn").addEventListener("click", () => {
  const value = byId("manualValue").value;
  applyScan(value);
  byId("manualValue").value = "";
});

byId("closeDialog").addEventListener("click", () => successDialog.close());

window.addEventListener("beforeunload", () => {
  scanLoopRunning = false;
  stream?.getTracks().forEach((t) => t.stop());
});

function stopScanLoop() {
  scanLoopRunning = false;
}

async function runScanLoop() {
  if (!scanLoopRunning) return;

  const now = Date.now();
  if (now - scanLoopLastAt >= 700) {
    scanLoopLastAt = now;
    const code = await detectFromVideo();
    if (code) {
      applyScan(code);
    }
  }

  requestAnimationFrame(runScanLoop);
}

function startScanLoop() {
  if (scanLoopRunning) return;
  scanLoopRunning = true;
  scanLoopLastAt = 0;
  requestAnimationFrame(runScanLoop);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    scanMessage.textContent = "Camera not supported on this browser.";
    return;
  }

  if (!window.isSecureContext) {
    scanMessage.textContent = "Camera needs HTTPS (or localhost). Open with a secure link.";
    return;
  }

  stream?.getTracks().forEach((t) => t.stop());

  const cameraAttempts = [
    { video: { facingMode: { exact: "environment" } }, audio: false },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: true, audio: false }
  ];

  let started = false;
  for (const constraints of cameraAttempts) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      started = true;
      break;
    } catch {
      // Try next fallback constraint.
    }
  }

  if (!started) {
    scanMessage.textContent = "Unable to access back camera.";
    return;
  }

  const videoEl = byId("video");
  videoEl.srcObject = stream;
  videoEl.setAttribute("playsinline", "true");
  videoEl.muted = true;

  try {
    await videoEl.play();
  } catch {
    scanMessage.textContent = "Camera opened but preview play failed. Tap camera button again.";
    return;
  }

  scanMessage.textContent = "Camera ready. Keep QR 15-25cm away in good light.";

  if (hasAnyQrDecoder()) {
    if (canUseBarcodeDetector()) {
      detector = detector ?? new BarcodeDetector({ formats: ["qr_code"] });
    }
    startScanLoop();
  } else {
    scanMessage.textContent = "QR decoder unavailable. Use Manual QR text input.";
  }
}

byId("cameraBtn").addEventListener("click", startCamera);

async function detectFromVideo() {
  const video = byId("video");
  if (!video.videoWidth) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);

  if (canUseBarcodeDetector()) {
    const activeDetector = detector ?? new BarcodeDetector({ formats: ["qr_code"] });
    detector = activeDetector;

    try {
      const codes = await activeDetector.detect(canvas);
      if (codes.length && codes[0].rawValue) {
        return codes[0].rawValue;
      }
    } catch {
      // Continue with jsQR fallback.
    }
  }

  if (canUseJsQr()) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let code = window.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth"
    });
    if (code?.data) {
      return code.data;
    }

    const cropW = Math.floor(canvas.width * 0.75);
    const cropH = Math.floor(canvas.height * 0.75);
    const sx = Math.floor((canvas.width - cropW) / 2);
    const sy = Math.floor((canvas.height - cropH) / 2);
    const cropData = ctx.getImageData(sx, sy, cropW, cropH);
    code = window.jsQR(cropData.data, cropData.width, cropData.height, {
      inversionAttempts: "attemptBoth"
    });
    if (code?.data) {
      return code.data;
    }
  }

  return null;
}

byId("scanBtn").addEventListener("click", async () => {
  if (!hasAnyQrDecoder()) {
    scanMessage.textContent = "Auto QR detection unsupported. Use Manual QR text input.";
    return;
  }

  const value = await detectFromVideo();
  if (!value) {
    scanMessage.textContent = "No QR found. Move closer, improve light, and try again.";
    return;
  }

  applyScan(value);
});

if (isAdmin) {
  const userUrl = `${location.origin}${location.pathname}`;
  byId("userLink").value = userUrl;
  byId("supabaseUrl").value = localStorage.getItem("supabaseUrl") || "";
  byId("supabaseKey").value = localStorage.getItem("supabaseKey") || "";

  byId("saveSupabaseBtn").addEventListener("click", async () => {
    localStorage.setItem("supabaseUrl", byId("supabaseUrl").value.trim());
    localStorage.setItem("supabaseKey", byId("supabaseKey").value.trim());
    await loadCluesFromSupabase();
    byId("saveSupabaseBtn").textContent = "Saved";
    setTimeout(() => (byId("saveSupabaseBtn").textContent = "Save Supabase Config"), 1200);
  });

  byId("copyLinkBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(userUrl);
    byId("copyLinkBtn").textContent = "Copied!";
    setTimeout(() => (byId("copyLinkBtn").textContent = "Copy"), 1200);
  });

  byId("startBtn").addEventListener("click", () => {
    const state = loadState();
    if (!state.timerRunning) {
      state.timerRunning = true;
      state.timerStartedAt = Date.now();
      saveState(state);
    }
    render();
  });

  byId("stopBtn").addEventListener("click", () => {
    const state = loadState();
    if (state.timerRunning) {
      state.timerSeconds = getElapsed(state);
      state.timerRunning = false;
      state.timerStartedAt = null;
      saveState(state);
    }
    render();
  });

  byId("restartTimerBtn").addEventListener("click", () => {
    const state = loadState();
    state.timerSeconds = 0;
    state.timerStartedAt = state.timerRunning ? Date.now() : null;
    for (const team of state.teams) {
      team.lastCorrectAt = null;
    }
    saveState(state);
    render();
  });

  byId("resetBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TEAM_KEY);
    stopScanLoop();
    stream?.getTracks().forEach((t) => t.stop());
    saveState(structuredClone(defaultState));
    render();
    refreshTeamUI();
  });
}

void loadCluesFromSupabase();
render();
refreshTeamUI();
