const API = "/api";
const WRITE_PIN_KEY = "luduWritePin";
const POINTS_BY_POSITION = { 1: 4, 2: 3, 3: 2, 4: 1 };
const PENALTY_TYPES = {
  moved_other_piece: {
    label: "Moved another piece",
    historyLabel: "Intentionally moved another player's piece",
    points: 3,
  },
  influenced_other_move: {
    label: "Influenced move",
    historyLabel: "Influenced another player's move",
    points: 1,
  },
};

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
let isSavingGame = false;

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
  setSaveGameButtonState();

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

function setSaveGameButtonState() {
  const button = document.getElementById("saveGameButton");
  if (!button) return;

  button.disabled = isSavingGame || !hasWriteAccess();
  button.textContent = isSavingGame ? "Saving..." : "Save Game Result";
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

function formatPenaltyCell(points) {
  const value = Number(points) || 0;
  const className = value > 0 ? "text-red-600" : "text-green-700";

  return `<span class="${className}">${value > 0 ? `-${value}` : "0"}</span>`;
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
      gamePoints: 0,
      penaltyPoints: 0,
      penaltyCount: 0,
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
          gamePoints: 0,
          penaltyPoints: 0,
          penaltyCount: 0,
          averagePoint: 0,
          rankingScore: 0,
          lostCount: 0,
        };
      }

      const position = Number(result.position);
      const points = POINTS_BY_POSITION[position] || 0;
      board[result.player].matchesPlayed += 1;
      board[result.player].gamePoints += points;
      board[result.player].totalPoints += points;
      if (position === 1) board[result.player].wins += 1;
      if (position === 4) board[result.player].lostCount += 1;
    });

    (game.penalties || []).forEach((penalty) => {
      const player = String(penalty?.player || "").trim();
      if (!player) return;

      if (!board[player]) {
        board[player] = {
          player,
          matchesPlayed: 0,
          wins: 0,
          totalPoints: 0,
          gamePoints: 0,
          penaltyPoints: 0,
          penaltyCount: 0,
          averagePoint: 0,
          rankingScore: 0,
          lostCount: 0,
        };
      }

      const points = Math.max(0, Number(penalty?.points) || 0);
      board[player].penaltyPoints += points;
      board[player].penaltyCount += 1;
      board[player].totalPoints -= points;
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
    data.leaderboard ||
    calculateLeaderboard(players, currentSeason.matches || []);
  ranking =
    data.ranking || calculateRanking(players, currentSeason.matches || []);
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
    <div class="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 px-4 py-3 text-center text-sm font-bold text-blue-800 break-words shadow-sm hover:shadow-md transition-all">
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

function getPenaltyCountsByPlayer() {
  const counts = {};

  document.querySelectorAll(".penalty-count").forEach((input) => {
    const player = input.dataset.player;
    const type = input.dataset.type;
    if (!player || !type) return;

    counts[player] ||= {};
    counts[player][type] = Number(input.value) || 0;
  });

  return counts;
}

function getPenaltyEntries() {
  const penalties = [];

  document.querySelectorAll(".penalty-count").forEach((input) => {
    const count = Math.max(0, Number(input.value) || 0);
    const player = input.dataset.player;
    const type = input.dataset.type;
    const penaltyType = PENALTY_TYPES[type];

    if (!count || !player || !penaltyType) return;

    for (let index = 0; index < count; index += 1) {
      penalties.push({
        player,
        type,
        points: penaltyType.points,
      });
    }
  });

  return penalties;
}

function updatePenaltyInputColor(input) {
  const hasPenalty = (Number(input.value) || 0) > 0;
  input.classList.toggle("border-red-300", hasPenalty);
  input.classList.toggle("bg-red-50", hasPenalty);
  input.classList.toggle("text-red-700", hasPenalty);
  input.classList.toggle("border-green-300", !hasPenalty);
  input.classList.toggle("bg-green-50", !hasPenalty);
  input.classList.toggle("text-green-700", !hasPenalty);
}

function renderResultInputs() {
  const selected = getSelectedPlayers();
  const previousPositions = getSelectedPositions();
  const previousPenaltyCounts = getPenaltyCountsByPlayer();
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
      <div class="rounded-2xl bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
        <label class="mb-4 block break-words text-center font-extrabold text-lg text-slate-800">${escapeHtml(player)}</label>
        <select data-player="${escapeHtml(player)}" class="write-control position-select w-full rounded-2xl border-2 border-slate-300 px-5 py-4 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 font-semibold transition-all">
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
        <div class="mt-5 space-y-4">
          ${Object.entries(PENALTY_TYPES)
            .map(([type, config]) => {
              const value = previousPenaltyCounts[player]?.[type] || 0;
              return `
                <label class="block text-sm font-semibold text-slate-700">
                  <span class="mb-2 block flex items-center gap-2">
                    <span>⚠️</span>
                    ${escapeHtml(config.label)} <span class="text-red-600 font-bold">(-${config.points})</span>
                  </span>
                  <input type="number" min="0" step="1" value="${value}" data-player="${escapeHtml(player)}" data-type="${escapeHtml(type)}" class="write-control penalty-count w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base font-semibold disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100 transition-all" />
                </label>
              `;
            })
            .join("")}
        </div>
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

  document.querySelectorAll(".penalty-count").forEach((input) => {
    updatePenaltyInputColor(input);
    input.oninput = () => updatePenaltyInputColor(input);
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
    .map((player, index) => {
      const colors = [
        "from-green-400 to-emerald-500",
        "from-blue-400 to-indigo-500",
        "from-yellow-400 to-orange-500",
        "from-purple-400 to-pink-500",
      ];
      return `
    <div class="rounded-2xl bg-white border-2 border-slate-100 p-6 text-center shadow-sm hover:shadow-lg transition-all transform hover:-translate-y-1">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${colors[index]} text-2xl font-extrabold text-white shadow-lg">
        ${index + 1}
      </div>
      <p class="break-words font-bold text-slate-800 text-lg">${escapeHtml(player)}</p>
      <p class="text-xs text-slate-500 mt-2 font-semibold">${getOrdinal(index + 1)}</p>
    </div>
  `;
    })
    .join("");

  document.getElementById("lotteryInfo").innerHTML = `
    <p class="font-bold">Lottery completed!</p>
    <p class="mt-1 break-words text-sm">${lotteryOrder.map(escapeHtml).join(" -> ")}</p>
  `;
}

async function saveGame() {
  if (isSavingGame) return;
  if (!(await ensureWriteAccess())) return;

  isSavingGame = true;
  setSaveGameButtonState();

  try {
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
    const penalties = getPenaltyEntries();

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
        penalties,
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

    if (data.duplicateIgnored) {
      await showAlert(
        "info",
        "Already saved",
        "This game result was already saved.",
      );
      return;
    }

    if (data.completedSeason) {
      await showAlert(
        "success",
        "Season completed",
        `Season ${data.completedSeason.seasonNumber} completed and saved to Season History.`,
      );
      return;
    }

    await showAlert("success", "Saved", "Game result saved successfully.");
  } finally {
    isSavingGame = false;
    setSaveGameButtonState();
  }
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

// function renderLeaderboard() {
//   const tbody = document.getElementById("leaderboardBody");

//   tbody.innerHTML = leaderboard
//     .map((row, index) => {
//       let rowClass =
//         "border-t border-slate-100 hover:bg-slate-50 transition-colors";
//       let rankBadge = "";
//       if (index === 0) {
//         rowClass =
//           "border-t-2 border-green-500 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-500 transition-all";
//         rankBadge = '<span class="text-2xl mr-2">🥇</span>';
//       } else if (index === 1) {
//         rowClass =
//           "border-t-2 border-green-400 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-500 transition-all";
//         rankBadge = '<span class="text-2xl mr-2">🥈</span>';
//       } else if (index === 2) {
//         rowClass =
//           "border-t-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 transition-all";
//         rankBadge = '<span class="text-2xl mr-2">🥉</span>';
//       } else if (index > 2) {
//         rowClass =
//           "border-t-2 border-red-300 bg-gradient-to-r from-red-50 to-amber-50 hover:from-red-100 hover:to-amber-100 transition-all";
//       }

//       return `
//       <tr class="${rowClass}">
//         <td class="p-4 font-extrabold text-lg">${rankBadge}${index + 1}</td>
//         <td class="break-words p-4 font-semibold text-slate-800">${escapeHtml(row.player)}</td>
//         <td class="p-4 text-slate-700">${row.matchesPlayed || 0}</td>
//         <td class="p-4 text-green-600 font-bold">${row.wins || 0}</td>
//         <td class="p-4 text-red-500 font-semibold">${row.lostCount || 0}</td>
//         <td class="p-4 font-semibold text-blue-600">${row.gamePoints ?? row.totalPoints ?? 0}</td>
//         <td class="p-4">${formatPenaltyCell(row.penaltyPoints)}</td>
//         <td class="p-4 font-extrabold text-xl text-indigo-700">${row.totalPoints || 0}</td>
//         <td class="p-4 font-semibold text-slate-700">${formatNumber(row.averagePoint)}</td>
//       </tr>
//     `;
//     })
//     .join("");
// }

function renderLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");

  tbody.innerHTML = leaderboard
    .map((row, index) => {
      let rowClass =
        "border-t border-slate-100 hover:bg-slate-50 transition-colors";

      let rankContent = "";

      if (index === 0) {
        rowClass =
          "border-t-2 border-green-500 bg-gradient-to-r from-green-100 to-green-50 hover:from-green-200 hover:to-green-100 transition-all";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥇</span>
          </div>
        `;
      } else if (index === 1) {
        rowClass =
          "border-t-2 border-blue-500 bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 transition-all";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥈</span>
          </div>
        `;
      } else if (index === 2) {
        rowClass =
          "border-t-2 border-yellow-500 bg-gradient-to-r from-yellow-100 to-yellow-50 hover:from-yellow-200 hover:to-yellow-100 transition-all";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥉</span>
          </div>
        `;
      } else {
        rowClass =
          "border-t-2 border-red-300 bg-gradient-to-r from-red-50 to-red-25 hover:from-red-100 hover:to-red-50 transition-all";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
              ${index + 1}
            </span>
          </div>
        `;
      }

      return `
      <tr class="${rowClass}">
        <td class="w-20 p-4 text-center align-middle">
          ${rankContent}
        </td>

        <td class="break-words p-4 font-semibold text-slate-800">
          ${escapeHtml(row.player)}
        </td>

        <td class="p-4 text-slate-700">
          ${row.matchesPlayed || 0}
        </td>

        <td class="p-4 font-bold text-green-600">
          ${row.wins || 0}
        </td>

        <td class="p-4 font-semibold text-red-500">
          ${row.lostCount || 0}
        </td>

        <td class="p-4 font-semibold text-blue-600">
          ${row.gamePoints ?? row.totalPoints ?? 0}
        </td>

        <td class="p-4">
          ${formatPenaltyCell(row.penaltyPoints)}
        </td>

        <td class="p-4 font-extrabold text-xl text-indigo-700">
          ${row.totalPoints || 0}
        </td>

        <td class="p-4 font-semibold text-slate-700">
          ${formatNumber(row.averagePoint)}
        </td>
      </tr>
    `;
    })
    .join("");
}

// function renderRanking() {
//   const tbody = document.getElementById("rankingBody");

//   if (!tbody) return;

//   tbody.innerHTML = ranking
//     .map(
//       (row, index) => `
//       <tr class="border-t border-slate-100 hover:bg-purple-50 transition-colors">
//         <td class="p-4 font-extrabold text-lg">${index + 1}</td>
//         <td class="break-words p-4 font-semibold text-slate-800">${escapeHtml(row.player)}</td>
//         <td class="p-4 text-slate-700">${row.matchesPlayed || 0}</td>
//         <td class="p-4 font-bold text-purple-700 text-lg">${formatNumber(row.rankingScore)}</td>
//         <td class="p-4">${formatPenaltyCell(row.penaltyPoints)}</td>
//         <td class="p-4 font-extrabold text-xl text-indigo-700">${row.totalPoints || 0}</td>
//       </tr>
//     `,
//     )
//     .join("");
// }

function renderRanking() {
  const tbody = document.getElementById("rankingBody");

  if (!tbody) return;

  tbody.innerHTML = ranking
    .map((row, index) => {
      let rowClass =
        "border-t border-slate-100 hover:bg-purple-50 transition-colors";

      let rankContent = "";

      if (index === 0) {
        rowClass =
          "border-t-2 border-green-500 bg-gradient-to-r from-green-100 to-green-50";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥇</span>
          </div>
        `;
      } else if (index === 1) {
        rowClass =
          "border-t-2 border-blue-500 bg-gradient-to-r from-blue-100 to-blue-50";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥈</span>
          </div>
        `;
      } else if (index === 2) {
        rowClass =
          "border-t-2 border-yellow-500 bg-gradient-to-r from-yellow-100 to-yellow-50";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥉</span>
          </div>
        `;
      } else {
        rowClass =
          "border-t-2 border-red-300 bg-gradient-to-r from-red-50 to-red-25 hover:from-red-100 hover:to-red-50 transition-all";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
              ${index + 1}
            </span>
          </div>
        `;
      }

      return `
      <tr class="${rowClass}">
        <td class="w-20 p-4 text-center align-middle">
          ${rankContent}
        </td>

        <td class="break-words p-4 font-semibold text-slate-800">
          ${escapeHtml(row.player)}
        </td>

        <td class="p-4 text-slate-700">
          ${row.matchesPlayed || 0}
        </td>

        <td class="p-4 font-bold text-purple-700 text-lg">
          ${formatNumber(row.rankingScore)}
        </td>

        <td class="p-4">
          ${formatPenaltyCell(row.penaltyPoints)}
        </td>

        <td class="p-4 font-extrabold text-xl text-indigo-700">
          ${row.totalPoints || 0}
        </td>
      </tr>
    `;
    })
    .join("");
}

// function renderAllTimeRanking() {
//   const tbody = document.getElementById("allTimeRankingBody");

//   if (!tbody) return;

//   tbody.innerHTML = allTimeRanking
//     .map(
//       (row, index) => `
//       <tr class="border-t border-slate-100 hover:bg-teal-50 transition-colors">
//         <td class="p-4 font-extrabold text-lg">${index + 1}</td>
//         <td class="break-words p-4 font-semibold text-slate-800">${escapeHtml(row.player)}</td>
//         <td class="p-4 text-slate-700">${row.matchesPlayed || 0}</td>
//         <td class="p-4 text-green-600 font-bold">${row.wins || 0}</td>
//         <td class="p-4 text-red-500 font-semibold">${row.lostCount || 0}</td>
//         <td class="p-4 font-bold text-teal-700 text-lg">${formatNumber(row.rankingScore)}</td>
//         <td class="p-4">${formatPenaltyCell(row.penaltyPoints)}</td>
//         <td class="p-4 font-extrabold text-xl text-teal-700">${row.totalPoints || 0}</td>
//       </tr>
//     `,
//     )
//     .join("");
// }

function renderAllTimeRanking() {
  const tbody = document.getElementById("allTimeRankingBody");

  if (!tbody) return;

  tbody.innerHTML = allTimeRanking
    .map((row, index) => {
      let rowClass =
        "border-t border-slate-100 hover:bg-teal-50 transition-colors";

      let rankContent = "";

      if (index === 0) {
        rowClass =
          "border-t-2 border-green-500 bg-gradient-to-r from-green-100 to-green-50";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥇</span>
          </div>
        `;
      } else if (index === 1) {
        rowClass =
          "border-t-2 border-blue-500 bg-gradient-to-r from-blue-100 to-blue-50";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥈</span>
          </div>
        `;
      } else if (index === 2) {
        rowClass =
          "border-t-2 border-yellow-500 bg-gradient-to-r from-yellow-100 to-yellow-50";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="text-3xl">🥉</span>
          </div>
        `;
      } else {
        rowClass =
          "border-t-2 border-red-300 bg-gradient-to-r from-red-50 to-red-25 hover:from-red-100 hover:to-red-50 transition-all";

        rankContent = `
          <div class="flex justify-center items-center">
            <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
              ${index + 1}
            </span>
          </div>
        `;
      }

      return `
      <tr class="${rowClass}">
        <td class="w-20 p-4 text-center align-middle">
          ${rankContent}
        </td>

        <td class="break-words p-4 font-semibold text-slate-800">
          ${escapeHtml(row.player)}
        </td>

        <td class="p-4 text-slate-700">
          ${row.matchesPlayed || 0}
        </td>

        <td class="p-4 font-bold text-green-600">
          ${row.wins || 0}
        </td>

        <td class="p-4 font-semibold text-red-500">
          ${row.lostCount || 0}
        </td>

        <td class="p-4 font-bold text-teal-700 text-lg">
          ${formatNumber(row.rankingScore)}
        </td>

        <td class="p-4">
          ${formatPenaltyCell(row.penaltyPoints)}
        </td>

        <td class="p-4 font-extrabold text-xl text-teal-700">
          ${row.totalPoints || 0}
        </td>
      </tr>
    `;
    })
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
  const totalPages = Math.max(
    1,
    Math.ceil(sortedGames.length / historyPageLimit),
  );
  historyPage = Math.min(Math.max(historyPage, 1), totalPages);
  const start = (historyPage - 1) * historyPageLimit;
  const visibleGames = sortedGames.slice(start, start + historyPageLimit);

  history.innerHTML = visibleGames
    .map((game) => {
      const sortedResults = [...(game.results || [])].sort(
        (a, b) => a.position - b.position,
      );

      return `
      <div class="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-6 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-purple-900 flex items-center gap-2">
            <span class="text-purple-500">🎮</span>
            Season ${game.seasonNumber || 1}, Match ${game.matchNumber || 1}
          </h3>
          <p class="text-sm text-slate-600">${new Date(game.date).toLocaleString()}</p>
        </div>

        <div class="mb-4">
          <p class="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span>🔄</span> Turn Order:
          </p>
          <p class="break-words text-slate-700 bg-white px-4 py-2 rounded-xl">
            ${(game.lotteryOrder || []).length ? game.lotteryOrder.map(escapeHtml).join(" → ") : "Lottery not used"}
          </p>
        </div>

        <div class="mb-4">
          <p class="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span>🏅</span> Result:
          </p>
          <p class="break-words text-slate-700 bg-white px-4 py-2 rounded-xl font-semibold">
            ${sortedResults.map((result) => `${result.position}. ${escapeHtml(result.player)}`).join(" | ")}
          </p>
        </div>

        <div>
          <p class="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span>⚠️</span> Penalties:
          </p>
          <p class="break-words text-slate-700 bg-white px-4 py-2 rounded-xl">
            ${formatPenaltySummary(game.penalties || [])}
          </p>
        </div>
      </div>
    `;
    })
    .join("");

  if (!controls) return;

  const pageButtons = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    const activeClass =
      page === historyPage
        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
        : "border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-purple-300";
    return `<button type="button" onclick="setHistoryPage(${page})" class="h-12 min-w-12 rounded-2xl px-4 text-base font-bold transition-all duration-200 ${activeClass}">${page}</button>`;
  }).join("");

  controls.innerHTML = `
    <button type="button" onclick="setHistoryPage(${historyPage - 1})" ${historyPage === 1 ? "disabled" : ""} class="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-all">Previous</button>
    <div class="flex flex-wrap justify-center gap-3">${pageButtons}</div>
    <button type="button" onclick="setHistoryPage(${historyPage + 1})" ${historyPage === totalPages ? "disabled" : ""} class="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-all">Next</button>
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

function formatPenaltySummary(penalties = []) {
  if (!penalties.length) return "No penalties";

  const grouped = new Map();

  penalties.forEach((penalty) => {
    const type = PENALTY_TYPES[penalty.type];
    const player = String(penalty.player || "").trim();
    const label = type?.historyLabel || penalty.type || "Penalty";
    const key = `${player}::${penalty.type}`;
    const points = Number(penalty.points) || type?.points || 1;

    if (!player) return;

    if (!grouped.has(key)) {
      grouped.set(key, {
        player,
        label,
        count: 0,
        points: 0,
      });
    }

    const entry = grouped.get(key);
    entry.count += 1;
    entry.points += points;
  });

  return [...grouped.values()]
    .map(
      (entry) =>
        `${escapeHtml(entry.player)}: ${escapeHtml(entry.label)}(<strong>${entry.count}</strong>) (<span class="text-red-600">-${entry.points}</span>)`,
    )
    .join(" | ");
}

function getPenaltyHistory() {
  return games
    .flatMap((game) =>
      (game.penalties || []).map((penalty) => {
        const type = PENALTY_TYPES[penalty.type];
        return {
          date: game.date,
          seasonNumber: game.seasonNumber || 1,
          matchNumber: game.matchNumber || 1,
          player: penalty.player,
          violation: type?.historyLabel || penalty.type || "Penalty",
          points: Number(penalty.points) || type?.points || 1,
        };
      }),
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderPenaltyRulesHtml() {
  const rows = Object.values(PENALTY_TYPES)
    .map(
      (type) => `
        <tr class="border-t border-slate-200">
          <td class="p-2 text-left">${escapeHtml(type.historyLabel)}</td>
          <td class="p-2 text-right font-bold text-red-600">-${type.points}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div class="text-left">
      <h3 class="mb-3 text-base font-bold text-slate-900">Penalty Rules</h3>
      <div class="overflow-x-auto rounded-xl border border-slate-200">
        <table class="w-full text-sm">
          <thead class="bg-amber-50 text-amber-800">
            <tr>
              <th class="p-2 text-left">Violation</th>
              <th class="p-2 text-right">Penalty</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderPenaltyHistoryHtml() {
  const history = getPenaltyHistory();

  if (history.length === 0) {
    return `
      <div class="mt-5 text-left">
        <h3 class="mb-3 text-base font-bold text-slate-900">Penalty History</h3>
        <div class="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm font-semibold text-green-700">
          No penalties recorded.
        </div>
      </div>
    `;
  }

  const rows = history
    .map(
      (entry) => `
        <tr class="border-t border-slate-200 align-top">
          <td class="p-2 text-left">${new Date(entry.date).toLocaleString()}</td>
          <td class="p-2 text-left">S${entry.seasonNumber}, M${entry.matchNumber}</td>
          <td class="p-2 text-left font-semibold">${escapeHtml(entry.player)}</td>
          <td class="p-2 text-left">${escapeHtml(entry.violation)}</td>
          <td class="p-2 text-right font-bold text-red-600">-${entry.points}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div class="mt-5 text-left">
      <h3 class="mb-3 text-base font-bold text-slate-900">Penalty History</h3>
      <div class="max-h-80 overflow-auto rounded-xl border border-slate-200">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-slate-50 text-slate-700">
            <tr>
              <th class="p-2 text-left">Date</th>
              <th class="p-2 text-left">Match</th>
              <th class="p-2 text-left">Player</th>
              <th class="p-2 text-left">Violation</th>
              <th class="p-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function openPenaltyModal() {
  const html = `
    <div class="space-y-5">
      ${renderPenaltyRulesHtml()}
      ${renderPenaltyHistoryHtml()}
    </div>
  `;

  if (!window.Swal) {
    alert(
      "Penalty rules and history are available after the page scripts load.",
    );
    return;
  }

  Swal.fire({
    title: "Penalties",
    html,
    width: "900px",
    confirmButtonText: "Close",
    confirmButtonColor: "#0f172a",
  });
}

function renderSeasonHistory() {
  const container = document.getElementById("seasonHistory");
  if (!container) return;

  if (seasonHistory.length === 0) {
    container.innerHTML = `
      <div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-gray-100 p-8 text-center text-slate-600">
        <div class="text-5xl mb-4">🏆</div>
        <h3 class="text-xl font-bold text-slate-800 mb-2">No completed seasons yet</h3>
        <p class="text-slate-600">Keep playing to complete seasons and see your progress!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = [...seasonHistory]
    .sort((a, b) => b.seasonNumber - a.seasonNumber)
    .map((season) => {
      const rows = (season.leaderboard || [])
        .map(
          (row, index) => `
          <tr class="border-t border-slate-100 hover:bg-emerald-50 transition-colors">
            <td class="p-4 font-extrabold text-lg">${index + 1}</td>
            <td class="break-words p-4 font-semibold text-slate-800">${escapeHtml(row.player)}</td>
            <td class="p-4 text-slate-700">${row.matchesPlayed || row.matches || 0}</td>
            <td class="p-4 font-semibold text-emerald-700">${row.gamePoints ?? row.totalPoints ?? row.points ?? 0}</td>
            <td class="p-4">${formatPenaltyCell(row.penaltyPoints)}</td>
            <td class="p-4 font-extrabold text-xl text-emerald-700">${row.totalPoints || row.points || 0}</td>
            <td class="p-4 font-semibold text-slate-700">${formatNumber(row.averagePoint)}</td>
            <td class="p-4 text-red-500 font-semibold">${row.lostCount || 0}</td>
          </tr>
        `,
        )
        .join("");

      return `
        <details class="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-6 shadow-sm hover:shadow-md transition-all">
          <summary class="cursor-pointer font-extrabold text-xl text-emerald-900 flex items-center gap-3">
            <span class="text-3xl">🏅</span>
            Season ${season.seasonNumber}
            <span class="text-sm text-emerald-600 font-semibold ml-auto">
              Completed ${new Date(season.completedAt).toLocaleString()}
            </span>
          </summary>
          <div class="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table class="w-full bg-white text-left text-sm sm:text-base">
              <thead class="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-900">
                <tr>
                  <th class="p-4 font-bold">Rank</th>
                  <th class="p-4 font-bold">Player</th>
                  <th class="p-4 font-bold">Total Matches</th>
                  <th class="p-4 font-bold">Game Points</th>
                  <th class="p-4 font-bold">Penalty</th>
                  <th class="p-4 font-bold">Total Points</th>
                  <th class="p-4 font-bold">Average Point</th>
                  <th class="p-4 font-bold">Lost Count</th>
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
