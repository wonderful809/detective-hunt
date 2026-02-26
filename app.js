const MAX_TEAMS = 20;
const POINTS_PER_CLUE = 2;
const TOTAL_CLUES = 10;

const validClues = [
  "CLUE-ALPHA",
  "CLUE-BRAVO",
  "CLUE-CHARLIE",
  "CLUE-DELTA",
  "CLUE-ECHO",
  "CLUE-FOXTROT",
  "CLUE-GOLF",
  "CLUE-HOTEL",
  "CLUE-INDIA",
  "CLUE-JULIET",
];

const state = {
  teams: [],
  elapsedSeconds: 0,
  timerId: null,
};

const gameTimer = document.getElementById("gameTimer");
const leaderboardBody = document.getElementById("leaderboardBody");
const teamSelect = document.getElementById("teamSelect");
const clueList = document.getElementById("clueList");
const toast = document.getElementById("toast");
const userLinkInput = document.getElementById("userLink");
const congratsDialog = document.getElementById("congratsDialog");

function formatTime(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderClues() {
  clueList.innerHTML = "";
  validClues.forEach((clue, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${clue}`;
    clueList.appendChild(li);
  });
}

function updateTeamSelect() {
  teamSelect.innerHTML = "";
  if (state.teams.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Create team first";
    opt.value = "";
    teamSelect.appendChild(opt);
    return;
  }

  state.teams.forEach((team) => {
    const opt = document.createElement("option");
    opt.value = team.id;
    opt.textContent = team.name;
    teamSelect.appendChild(opt);
  });
}

function sortTeams(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  return a.finishTime - b.finishTime;
}

function renderLeaderboard() {
  leaderboardBody.innerHTML = "";
  const sorted = [...state.teams].sort(sortTeams);

  sorted.forEach((team, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${team.name}</td>
      <td>${team.members}</td>
      <td class="points">${team.points}</td>
      <td>${team.clues.size}/${TOTAL_CLUES}</td>
      <td>${formatTime(team.finishTime)}</td>
    `;
    leaderboardBody.appendChild(tr);
  });
}

function resetGame() {
  state.elapsedSeconds = 0;
  gameTimer.textContent = "00:00";
  state.teams.forEach((team) => {
    team.points = 0;
    team.clues.clear();
    team.finishTime = 0;
  });
  renderLeaderboard();
}

document.getElementById("startTimer").addEventListener("click", () => {
  if (state.timerId) return;
  state.timerId = setInterval(() => {
    state.elapsedSeconds += 1;
    gameTimer.textContent = formatTime(state.elapsedSeconds);
  }, 1000);
  showToast("Timer started by admin");
});

document.getElementById("stopTimer").addEventListener("click", () => {
  clearInterval(state.timerId);
  state.timerId = null;
  showToast("Timer stopped");
});

document.getElementById("resetTimer").addEventListener("click", () => {
  clearInterval(state.timerId);
  state.timerId = null;
  resetGame();
  showToast("Game refreshed");
});

document.getElementById("teamForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("teamName").value.trim();
  const members = Number(document.getElementById("teamMembers").value);

  if (!name) return showToast("Team name required");
  if (members < 3 || members > 4) return showToast("Members must be between 3 and 4");
  if (state.teams.length >= MAX_TEAMS) return showToast("Maximum 20 teams reached");
  if (state.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    return showToast("Team name already exists");
  }

  state.teams.push({
    id: crypto.randomUUID(),
    name,
    members,
    points: 0,
    clues: new Set(),
    finishTime: 0,
  });

  e.target.reset();
  updateTeamSelect();
  renderLeaderboard();
  showToast("Team created");
});

document.getElementById("scanForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const type = document.getElementById("qrType").value;
  const teamId = teamSelect.value;
  const payload = document.getElementById("scanInput").value.trim().toUpperCase();

  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return showToast("Pick a team first");

  if (type !== "text") {
    showToast("Scan another QR (only text clue is valid)");
    return;
  }

  if (!validClues.includes(payload)) {
    showToast("Wrong clue text. Scan another QR.");
    return;
  }

  if (team.clues.has(payload)) {
    showToast("This clue was already counted for this team");
    return;
  }

  team.clues.add(payload);
  team.points += POINTS_PER_CLUE;
  team.finishTime = state.elapsedSeconds;
  renderLeaderboard();

  if (typeof congratsDialog.showModal === "function") congratsDialog.showModal();

  document.getElementById("scanInput").value = "";
});

document.getElementById("closeDialog").addEventListener("click", () => congratsDialog.close());

document.getElementById("copyLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(userLinkInput.value);
    showToast("User link copied");
  } catch {
    showToast("Copy failed");
  }
});

userLinkInput.value = `${window.location.origin}${window.location.pathname}?role=user`;
renderClues();
updateTeamSelect();
renderLeaderboard();
