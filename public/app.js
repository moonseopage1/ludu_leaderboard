const API = "/api";
const WRITE_PIN_KEY = "luduWritePin";
const POINTS_BY_POSITION = { 1: 4, 2: 3, 3: 2, 4: 1 };

let players = [];
let games = [];
let currentSeason = { number: 1, matchLimit: 10, matches: [] };
let seasonHistory = [];
let leaderboard = [];
let ranking = [];
let allTimeRanking = [];
let lotteryOrder = [];
let historyPage = 1;
let historyPageLimit = 5;

function getWritePin() {
  return sessionStorage.getItem(WRITE_PIN_KEY) || "";
}

function hasWriteAccess() {
  return Boolean(getWritePin());
}

function showAlert(icon, title, text) {
  if (window.Swal) {
    return Swal.fire({
      icon,
      title,
      text,
      confirmButtonColor: "#2563eb",
    });
  }

  alert(text || title);
  return Promise.resolve();
}

async function promptForPin() {
  if (!window.Swal) {
    const pin = prompt("Enter write PIN");
    return pin?.trim() || "";
  }

  const result = await Swal.fire({
    title: "Enter secret PIN",
    input: "password",
    inputPlaceholder: "PIN code",
    inputAttributes: {
      autocapitalize: "off",
      autocomplete: "current-password",
    },
    showCancelButton: true,
    confirmButtonText: "Unlock",
    confirmButtonColor: "#0f172a",
    inputValidator: (value) => {
      if (!value?.trim()) return "PIN code is required.";
      return undefined;
    },
  });

  return result.isConfirmed ? result.value.trim() : "";
}

async function unlockWrites() {
  const pin = await promptForPin();
  if (!pin) return false;

  try {
    const res = await fetch(`${API}/player`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Write-Pin": pin,
      },
      body: JSON.stringify({ name: "" }),
    });

    const error = await res.json().catch(() => ({}));
    const errorMessage = error.error || error.message || "";

    if (res.status === 401) {
      await showAlert("error", "Wrong PIN", error.details || "");
      return false;
    }

    if (res.status === 400 && errorMessage === "Player name is required") {
      sessionStorage.setItem(WRITE_PIN_KEY, pin);
      updateWriteControls();
      await showAlert(
        "success",
        "Unlocked",
        "You can now add players and save games in this tab.",
      );
      return true;
    }

    await showAlert("error", "Could not verify PIN", error.details || "");
    return false;
  } catch {
    await showAlert("error", "Network error", "Could not verify PIN.");
    return false;
  }
}

async function ensureWriteAccess() {
  if (hasWriteAccess()) return true;
  return unlockWrites();
}

function lockWrites() {
  sessionStorage.removeItem(WRITE_PIN_KEY);
  lotteryOrder = [];
  document.getElementById("turnOrderSection")?.classList.add("hidden");
  updateWriteControls();
}

async function switchToReadOnly() {
  lockWrites();
  await showAlert(
    "success",
    "Read-only mode",
    "Write controls are locked in this tab.",
  );
}

function getAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Write-Pin": getWritePin(),
  };
}

function updateWriteControls() {
  const unlocked = hasWriteAccess();
  document.querySelectorAll(".write-control").forEach((control) => {
    control.disabled = !unlocked;
  });

  const status = document.getElementById("writeStatus");
  const unlockButton = document.getElementById("unlockButton");
  const lockButton = document.getElementById("lockButton");

  if (status) {
    status.textContent = unlocked ? "Write mode" : "View mode";
    status.className = unlocked
      ? "w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700 sm:w-auto"
      : "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-600 sm:w-auto";
  }

  unlockButton?.classList.toggle("hidden", unlocked);
  lockButton?.classList.toggle("hidden", !unlocked);

  document.querySelectorAll(".write-panel").forEach((panel) => {
    if (panel.id === "turnOrderSection" && lotteryOrder.length === 0) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.toggle("hidden", !unlocked);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

function getOrdinal(position) {
  if (position === 1) return "1st";
  if (position === 2) return "2nd";
  if (position === 3) return "3rd";
  return "4th";
}

async function handleWriteError(res, fallback) {
  const error = await res.json().catch(() => ({}));

  if (res.status === 401) {
    lockWrites();
  }

  await showAlert("error", error.error || fallback, error.details || fallback);
}

function calculateStats(sourcePlayers, matches) {
  const board = {};

  sourcePlayers.forEach((player) => {
    board[player] = {
      player,
      matchesPlayed: 0,
      wins: 0,
      totalPoints: 0,
      averagePoint: 0,
      rankingScore: 0,
      lostCount: 0,
    };
  });

  matches.forEach((game) => {
    (game.results || []).forEach((result) => {
      if (!board[result.player]) {
        board[result.player] = {
          player: result.player,
          matchesPlayed: 0,
          wins: 0,
          totalPoints: 0,
          averagePoint: 0,
          rankingScore: 0,
          lostCount: 0,
        };
      }

      const position = Number(result.position);
      board[result.player].matchesPlayed += 1;
      board[result.player].totalPoints += POINTS_BY_POSITION[position] || 0;
      if (position === 1) board[result.player].wins += 1;
      if (position === 4) board[result.player].lostCount += 1;
    });
  });

  return Object.values(board).map((row) => {
    const averagePoint =
      row.matchesPlayed > 0 ? row.totalPoints / row.matchesPlayed : 0;
    const lossFactor =
      row.matchesPlayed > 0 ? 1 - row.lostCount / row.matchesPlayed : 0;
    const matchFactor = Math.min(1, row.matchesPlayed / 10);

    return {
      ...row,
      averagePoint,
      rankingScore: averagePoint * lossFactor * matchFactor,
    };
  });
}

function calculateLeaderboard(sourcePlayers, matches) {
  return calculateStats(sourcePlayers, matches).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.lostCount !== b.lostCount) return a.lostCount - b.lostCount;
    return a.player.localeCompare(b.player);
  });
}

function calculateRanking(sourcePlayers, matches) {
  return calculateStats(sourcePlayers, matches).sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.lostCount !== b.lostCount) return a.lostCount - b.lostCount;
    return a.player.localeCompare(b.player);
  });
}

function setData(data) {
  players = data.players || [];
  currentSeason = data.currentSeason || {
    number: 1,
    matchLimit: 10,
    matches: data.games || [],
  };
  games = data.games || currentSeason.matches || [];
  seasonHistory = data.seasonHistory || [];
  leaderboard =
    data.leaderboard || calculateLeaderboard(players, currentSeason.matches || []);
  ranking = data.ranking || calculateRanking(players, currentSeason.matches || []);
  allTimeRanking = data.allTimeRanking || calculateRanking(players, games);

  const totalPages = Math.max(1, Math.ceil(games.length / historyPageLimit));
  historyPage = Math.min(historyPage, totalPages);

  renderPlayers();
  renderSelects();
  renderResultInputs();
  renderSeasonProgress();
  renderLeaderboard();
  renderRanking();
  renderAllTimeRanking();
  renderHistory();
  renderSeasonHistory();
  updateWriteControls();
}

async function loadData() {
  const res = await fetch(`${API}/data`);
  const data = await res.json();
  setData(data);
}

function getSelectedPlayerValues() {
  return [
    document.getElementById("player1").value,
    document.getElementById("player2").value,
    document.getElementById("player3").value,
    document.getElementById("player4").value,
  ];
}

function getSelectedPlayers() {
  return getSelectedPlayerValues().filter(Boolean);
}

function hasDuplicateValues(values) {
  const filled = values.filter(Boolean);
  return new Set(filled).size !== filled.length;
}

async function addPlayer() {
  if (!(await ensureWriteAccess())) return;

  const input = document.getElementById("playerName");
  const name = input.value.trim().replace(/\s+/g, " ");

  if (!name) {
    await showAlert("warning", "Name required", "Please enter player name.");
    return;
  }

  if (name.length > 40) {
    await showAlert(
      "warning",
      "Name too long",
      "Player name must be 40 characters or less.",
    );
    return;
  }

  const exists = players.some(
    (player) => player.toLowerCase() === name.toLowerCase(),
  );
  if (exists) {
    await showAlert(
      "warning",
      "Player already exists",
      `${name} is already in the player list.`,
    );
    return;
  }

  const res = await fetch(`${API}/player`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    await handleWriteError(res, "Failed to add player.");
    return;
  }

  input.value = "";
  setData(await res.json());
  await showAlert("success", "Player added", `${name} was added successfully.`);
}

function renderPlayers() {
  document.getElementById("totalPlayers").textContent = players.length;

  const playerBadges = document.getElementById("playerBadges");
  playerBadges.innerHTML = players
    .map(
      (player) => `
    <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-700 break-words">
      ${escapeHtml(player)}
    </div>
  `,
    )
    .join("");
}

function renderSelects() {
  const selectedValues = getSelectedPlayerValues();

  document.querySelectorAll(".player-select").forEach((select, index) => {
    const currentValue = selectedValues[index];

    select.innerHTML = `
      <option value="">Select Player</option>
      ${players
        .map((player) => {
          const disabled =
            selectedValues.includes(player) && player !== currentValue;
          return `<option value="${escapeHtml(player)}" ${disabled ? "disabled" : ""}>${escapeHtml(player)}</option>`;
        })
        .join("")}
    `;

    if (players.includes(currentValue)) {
      select.value = currentValue;
    }

    select.onchange = async () => {
      if (hasDuplicateValues(getSelectedPlayerValues())) {
        select.value = "";
        lotteryOrder = [];
        document.getElementById("turnOrderSection").classList.add("hidden");
        await showAlert(
          "warning",
          "Duplicate player",
          "Please select each player only once.",
        );
      }

      renderSelects();
      renderResultInputs();
      updateWriteControls();
    };
  });
}

function getSelectedPositions() {
  return [...document.querySelectorAll(".position-select")].map(
    (select) => select.value,
  );
}

function renderResultInputs() {
  const selected = getSelectedPlayers();
  const previousPositions = getSelectedPositions();
  const resultInputs = document.getElementById("resultInputs");

  if (selected.length === 0) {
    resultInputs.innerHTML = `
      <div class="sm:col-span-2 md:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-500 sm:p-5">
        Select 4 players first.
      </div>
    `;
    return;
  }

  resultInputs.innerHTML = selected
    .map((player, index) => {
      const currentPosition = previousPositions[index] || "";
      const selectedPositions = previousPositions.filter(Boolean);

      return `
      <div class="rounded-xl border border-slate-200 p-4">
        <label class="mb-3 block break-words text-center font-bold">${escapeHtml(player)}</label>
        <select data-player="${escapeHtml(player)}" class="write-control position-select w-full rounded-xl border border-slate-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
          <option value="">Position</option>
          ${[1, 2, 3, 4]
            .map((position) => {
              const value = String(position);
              const disabled =
                selectedPositions.includes(value) && value !== currentPosition;
              const label = `${getOrdinal(position)} (${position})`;
              return `<option value="${value}" ${disabled ? "disabled" : ""} ${value === currentPosition ? "selected" : ""}>${label}</option>`;
            })
            .join("")}
        </select>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll(".position-select").forEach((select) => {
    select.onchange = async () => {
      if (hasDuplicateValues(getSelectedPositions())) {
        select.value = "";
        await showAlert(
          "warning",
          "Duplicate position",
          "Please select each result position only once.",
        );
      }

      renderResultInputs();
      updateWriteControls();
    };
  });
}

async function runLottery() {
  if (!(await ensureWriteAccess())) return;

  const selected = getSelectedPlayers();

  if (selected.length !== 4 || new Set(selected).size !== 4) {
    await showAlert(
      "warning",
      "Select 4 players",
      "Please select 4 different players.",
    );
    return;
  }

  lotteryOrder = [...selected].sort(() => Math.random() - 0.5);

  const turnOrderSection = document.getElementById("turnOrderSection");
  const turnOrder = document.getElementById("turnOrder");

  turnOrderSection.classList.remove("hidden");

  turnOrder.innerHTML = lotteryOrder
    .map(
      (player, index) => `
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
      <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl font-bold text-white">
        ${index + 1}
      </div>
      <p class="break-words font-bold">${escapeHtml(player)}</p>
    </div>
  `,
    )
    .join("");

  document.getElementById("lotteryInfo").innerHTML = `
    <p class="font-bold">Lottery completed!</p>
    <p class="mt-1 break-words text-sm">${lotteryOrder.map(escapeHtml).join(" -> ")}</p>
  `;
}

async function saveGame() {
  if (!(await ensureWriteAccess())) return;

  const selected = getSelectedPlayers();

  if (selected.length !== 4 || new Set(selected).size !== 4) {
    await showAlert(
      "warning",
      "Select 4 players",
      "Please select 4 different players.",
    );
    return;
  }

  const positionSelects = document.querySelectorAll(".position-select");
  const results = [...positionSelects].map((select) => ({
    player: select.dataset.player,
    position: Number(select.value),
  }));
  const positions = results.map((result) => result.position);

  if (
    positions.length !== 4 ||
    positions.includes(0) ||
    new Set(positions).size !== 4
  ) {
    await showAlert(
      "warning",
      "Invalid positions",
      "Please select unique positions 1, 2, 3 and 4.",
    );
    return;
  }

  const res = await fetch(`${API}/game`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      lotteryOrder: lotteryOrder.length === 4 ? lotteryOrder : [],
      results,
    }),
  });

  if (!res.ok) {
    await handleWriteError(res, "Failed to save game.");
    return;
  }

  lotteryOrder = [];
  document.getElementById("turnOrderSection").classList.add("hidden");

  document.querySelectorAll(".player-select").forEach((select) => {
    select.value = "";
  });

  const data = await res.json();
  setData(data);

  if (data.completedSeason) {
    await showAlert(
      "success",
      "Season completed",
      `Season ${data.completedSeason.seasonNumber} completed and saved to Season History.`,
    );
    return;
  }

  await showAlert("success", "Saved", "Game result saved successfully.");
}

function renderSeasonProgress() {
  const progress = document.getElementById("seasonProgress");
  if (!progress) return;

  const matchCount = currentSeason.matches?.length || 0;
  const limit = currentSeason.matchLimit || 10;
  progress.textContent = `Season ${currentSeason.number} - Match ${matchCount} of ${limit}`;
}

function getRowClass(index) {
  if (index === 0) {
    return "border-t border-green-700 bg-green-800 text-white";
  }

  if (index === 1) {
    return "border-t border-green-300 bg-green-100 text-green-950";
  }

  return "border-t border-slate-200";
}

function renderLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");

  tbody.innerHTML = leaderboard
    .map((row, index) => `
      <tr class="${getRowClass(index)}">
        <td class="p-2 font-bold sm:p-3">${index + 1}</td>
        <td class="break-words p-2 font-semibold sm:p-3">${escapeHtml(row.player)}</td>
        <td class="p-2 sm:p-3">${row.matchesPlayed || 0}</td>
        <td class="p-2 sm:p-3">${row.wins || 0}</td>
        <td class="p-2 font-bold sm:p-3">${row.totalPoints || 0}</td>
        <td class="p-2 sm:p-3">${formatNumber(row.averagePoint)}</td>
        <td class="p-2 sm:p-3">${row.lostCount || 0}</td>
      </tr>
    `)
    .join("");
}

function renderRanking() {
  const tbody = document.getElementById("rankingBody");

  if (!tbody) return;

  tbody.innerHTML = ranking
    .map((row, index) => `
      <tr class="border-t border-slate-200">
        <td class="p-2 font-bold sm:p-3">${index + 1}</td>
        <td class="break-words p-2 font-semibold sm:p-3">${escapeHtml(row.player)}</td>
        <td class="p-2 sm:p-3">${row.matchesPlayed || 0}</td>
        <td class="p-2 sm:p-3">${row.totalPoints || 0}</td>
        <td class="p-2 sm:p-3">${formatNumber(row.averagePoint)}</td>
        <td class="p-2 font-bold text-indigo-700 sm:p-3">${formatNumber(row.rankingScore)}</td>
        <td class="p-2 sm:p-3">${row.lostCount || 0}</td>
      </tr>
    `)
    .join("");
}

function renderAllTimeRanking() {
  const tbody = document.getElementById("allTimeRankingBody");

  if (!tbody) return;

  tbody.innerHTML = allTimeRanking
    .map((row, index) => `
      <tr class="border-t border-slate-200">
        <td class="p-2 font-bold sm:p-3">${index + 1}</td>
        <td class="break-words p-2 font-semibold sm:p-3">${escapeHtml(row.player)}</td>
        <td class="p-2 sm:p-3">${row.matchesPlayed || 0}</td>
        <td class="p-2 sm:p-3">${row.wins || 0}</td>
        <td class="p-2 sm:p-3">${row.totalPoints || 0}</td>
        <td class="p-2 sm:p-3">${formatNumber(row.averagePoint)}</td>
        <td class="p-2 font-bold text-teal-700 sm:p-3">${formatNumber(row.rankingScore)}</td>
        <td class="p-2 sm:p-3">${row.lostCount || 0}</td>
      </tr>
    `)
    .join("");
}

function renderHistory() {
  const history = document.getElementById("gameHistory");
  const controls = document.getElementById("historyPagination");
  const limitSelect = document.getElementById("historyPageLimit");

  if (limitSelect && String(historyPageLimit) !== limitSelect.value) {
    limitSelect.value = String(historyPageLimit);
  }

  if (games.length === 0) {
    history.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-500 sm:p-5">
        No game history yet.
      </div>
    `;
    if (controls) controls.innerHTML = "";
    return;
  }

  const sortedGames = [...games].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );
  const totalPages = Math.max(1, Math.ceil(sortedGames.length / historyPageLimit));
  historyPage = Math.min(Math.max(historyPage, 1), totalPages);
  const start = (historyPage - 1) * historyPageLimit;
  const visibleGames = sortedGames.slice(start, start + historyPageLimit);

  history.innerHTML = visibleGames
    .map((game) => {
      const sortedResults = [...(game.results || [])].sort(
        (a, b) => a.position - b.position,
      );

      return `
      <div class="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <p class="mb-3 font-semibold text-slate-700">
          Season ${game.seasonNumber || 1}, Match ${game.matchNumber || 1} - ${new Date(game.date).toLocaleString()}
        </p>

        <p class="text-sm font-bold">Turn Order:</p>
        <p class="mb-3 break-words text-sm">${(game.lotteryOrder || []).length ? game.lotteryOrder.map(escapeHtml).join(" -> ") : "Lottery not used"}</p>

        <p class="text-sm font-bold">Result:</p>
        <p class="break-words text-sm">
          ${sortedResults.map((result) => `${result.position}. ${escapeHtml(result.player)}`).join(" | ")}
        </p>
      </div>
    `;
    })
    .join("");

  if (!controls) return;

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const activeClass =
      page === historyPage
        ? "bg-purple-600 text-white"
        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
    return `<button type="button" onclick="setHistoryPage(${page})" class="h-10 min-w-10 rounded-lg px-3 text-sm font-semibold ${activeClass}">${page}</button>`;
  }).join("");

  controls.innerHTML = `
    <button type="button" onclick="setHistoryPage(${historyPage - 1})" ${historyPage === 1 ? "disabled" : ""} class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
    <div class="flex flex-wrap justify-center gap-2">${pageButtons}</div>
    <button type="button" onclick="setHistoryPage(${historyPage + 1})" ${historyPage === totalPages ? "disabled" : ""} class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
  `;
}

function setHistoryPage(page) {
  const totalPages = Math.max(1, Math.ceil(games.length / historyPageLimit));
  historyPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  renderHistory();
}

function setHistoryPageLimit(value) {
  historyPageLimit = Number(value) || 5;
  historyPage = 1;
  renderHistory();
}

function renderSeasonHistory() {
  const container = document.getElementById("seasonHistory");
  if (!container) return;

  if (seasonHistory.length === 0) {
    container.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-500 sm:p-5">
        No completed seasons yet.
      </div>
    `;
    return;
  }

  container.innerHTML = [...seasonHistory]
    .sort((a, b) => b.seasonNumber - a.seasonNumber)
    .map((season) => {
      const rows = (season.leaderboard || [])
        .map((row, index) => `
          <tr class="border-t border-slate-200">
            <td class="p-2 font-bold">${index + 1}</td>
            <td class="break-words p-2 font-semibold">${escapeHtml(row.player)}</td>
            <td class="p-2">${row.matchesPlayed || row.matches || 0}</td>
            <td class="p-2">${row.totalPoints || row.points || 0}</td>
            <td class="p-2">${formatNumber(row.averagePoint)}</td>
            <td class="p-2">${row.lostCount || 0}</td>
          </tr>
        `)
        .join("");

      return `
        <details class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <summary class="cursor-pointer font-bold text-emerald-800">
            Season ${season.seasonNumber} - Completed ${new Date(season.completedAt).toLocaleString()}
          </summary>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full rounded-xl border border-slate-200 bg-white text-left text-sm">
              <thead class="bg-emerald-100 text-emerald-800">
                <tr>
                  <th class="p-2">Rank</th>
                  <th class="p-2">Player</th>
                  <th class="p-2">Total Matches</th>
                  <th class="p-2">Total Points</th>
                  <th class="p-2">Average Point</th>
                  <th class="p-2">Lost Count</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </details>
      `;
    })
    .join("");
}

updateWriteControls();

loadData().catch(() => {
  showAlert(
    "error",
    "Could not load data",
    "Please refresh the page and try again.",
  );
});
