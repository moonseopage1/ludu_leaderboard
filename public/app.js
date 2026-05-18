const API = "/api";
const WRITE_PIN_KEY = "luduWritePin";

let players = [];
let games = [];
let lotteryOrder = [];

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
    // Use POST /api/player with an empty name as a safe way to validate the PIN:
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

    // Expected failure when PIN is valid but name is missing.
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
  } catch (err) {
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
      ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700"
      : "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600";
  }

  if (unlockButton) {
    unlockButton.textContent = unlocked ? "" : "Login";
    unlockButton.classList.toggle("hidden", unlocked);
  }

  if (lockButton) {
    lockButton.classList.toggle("hidden", !unlocked);
  }

  document.querySelectorAll(".write-panel").forEach((panel) => {
    if (panel.id === "turnOrderSection" && lotteryOrder.length === 0) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.toggle("hidden", !unlocked);
  });
}

function setData(data) {
  players = data.players || [];
  games = data.games || [];

  renderPlayers();
  renderSelects();
  renderResultInputs();
  renderLeaderboard();
  renderHistory();
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function handleWriteError(res, fallback) {
  const error = await res.json().catch(() => ({}));

  if (res.status === 401) {
    lockWrites();
  }

  await showAlert("error", error.error || fallback, error.details || fallback);
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
    <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-700">
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
      <div class="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-500">
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
        <label class="mb-3 block text-center font-bold">${escapeHtml(player)}</label>
        <select data-player="${escapeHtml(player)}" class="write-control position-select w-full rounded-xl border border-slate-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
          <option value="">Position</option>
          ${[1, 2, 3, 4]
            .map((position) => {
              const value = String(position);
              const disabled =
                selectedPositions.includes(value) && value !== currentPosition;
              const label = `${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"} (${position})`;
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
      <p class="font-bold">${escapeHtml(player)}</p>
    </div>
  `,
    )
    .join("");

  document.getElementById("lotteryInfo").innerHTML = `
    <p class="font-bold">Lottery completed!</p>
    <p class="mt-1 text-sm">${lotteryOrder.map(escapeHtml).join(" -> ")}</p>
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

  if (lotteryOrder.length !== 4) {
    await showAlert(
      "warning",
      "Run lottery first",
      "Please run lottery before saving the game.",
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
      lotteryOrder,
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

  setData(await res.json());
  await showAlert("success", "Saved", "Game result saved successfully.");
}

function getLeaderboard() {
  const board = {};

  players.forEach((player) => {
    board[player] = {
      player,
      games: 0,
      wins: 0,
      points: 0,
    };
  });

  games.forEach((game) => {
    game.results.forEach((result) => {
      if (!board[result.player]) {
        board[result.player] = {
          player: result.player,
          games: 0,
          wins: 0,
          points: 0,
        };
      }

      board[result.player].games += 1;

      if (result.position === 1) {
        board[result.player].wins += 1;
      }

      const points = {
        1: 4,
        2: 3,
        3: 2,
        4: 1,
      };

      board[result.player].points += points[result.position] || 0;
    });
  });

  return Object.values(board).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.player.localeCompare(b.player);
  });
}

function renderLeaderboard() {
  const leaderboard = getLeaderboard();
  const tbody = document.getElementById("leaderboardBody");

  tbody.innerHTML = leaderboard
    .map((row, index) => {
      const medals = ["1", "2", "3"];
      const rank = medals[index] || index + 1;

      return `
      <tr class="border-t border-slate-200">
        <td class="p-3 font-bold">${rank}</td>
        <td class="p-3 font-semibold">${escapeHtml(row.player)}</td>
        <td class="p-3">${row.games}</td>
        <td class="p-3">${row.wins}</td>
        <td class="p-3 font-bold text-green-600">${row.points}</td>
      </tr>
    `;
    })
    .join("");
}

function renderHistory() {
  const history = document.getElementById("gameHistory");

  if (games.length === 0) {
    history.innerHTML = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-500">
        No game history yet.
      </div>
    `;
    return;
  }

  history.innerHTML = [...games]
    .reverse()
    .map((game) => {
      const sortedResults = [...game.results].sort(
        (a, b) => a.position - b.position,
      );

      return `
      <div class="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <p class="mb-3 font-semibold text-slate-700">
          ${new Date(game.date).toLocaleString()}
        </p>

        <p class="text-sm font-bold">Turn Order:</p>
        <p class="mb-3 text-sm">${game.lotteryOrder.map(escapeHtml).join(" -> ")}</p>

        <p class="text-sm font-bold">Result:</p>
        <p class="text-sm">
          ${sortedResults.map((result) => `${result.position}. ${escapeHtml(result.player)}`).join(" | ")}
        </p>
      </div>
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
