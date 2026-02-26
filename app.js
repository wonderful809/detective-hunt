const STORAGE_KEY = "detectiveHuntState";
const TEAM_KEY = "detectiveHuntCurrentTeam";

const defaultState = {
  timerSeconds: 0,
  timerRunning: false,
  timerStartedAt: null,
  teams: []
};

const validClues = Array.from({ length: 10 }, (_, i) => `CLUE-${String(i + 1).padStart(2, "0")}`);

let stream;

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
    return (a.lastCorrectAt ?? Infinity) - (b.lastCorrectAt ?? Infinity);
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

  const value = rawValue.trim().toUpperCase();
  const state = loadState();
  const mutableTeam = state.teams.find((t) => t.id === team.id);

  if (!validClues.includes(value)) {
    scanMessage.textContent = "Scan another QR. Only valid text clue QR is accepted.";
    return;
  }

  if (mutableTeam.solvedClues.includes(value)) {
    scanMessage.textContent = "You already solved this clue. Find next one!";
    return;
  }

  mutableTeam.solvedClues.push(value);
  mutableTeam.points += 2;
  mutableTeam.lastCorrectAt = getElapsed(state);
  saveState(state);

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

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    scanMessage.textContent = "Camera not supported on this browser.";
    return;
  }
  stream?.getTracks().forEach((t) => t.stop());
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    byId("video").srcObject = stream;
    await byId("video").play();
    scanMessage.textContent = "Back camera is ready. Point to QR and tap Scan Current Frame.";
  } catch {
    scanMessage.textContent = "Unable to access back camera.";
  }
}

byId("cameraBtn").addEventListener("click", startCamera);

byId("scanBtn").addEventListener("click", async () => {
  if (!("BarcodeDetector" in window)) {
    scanMessage.textContent = "BarcodeDetector unavailable. Use Manual QR text input.";
    return;
  }
  const video = byId("video");
  if (!video.videoWidth) {
    scanMessage.textContent = "Start camera first.";
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const detector = new BarcodeDetector({ formats: ["qr_code"] });
  const codes = await detector.detect(canvas);
  if (!codes.length) {
    scanMessage.textContent = "No QR found in frame.";
    return;
  }

  applyScan(codes[0].rawValue || "");
});

if (isAdmin) {
  const userUrl = `${location.origin}${location.pathname}`;
  byId("userLink").value = userUrl;

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

  byId("resetBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TEAM_KEY);
    saveState(structuredClone(defaultState));
    render();
    refreshTeamUI();
  });
}

render();
refreshTeamUI();
