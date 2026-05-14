const API = "/api";

let players = [];
let games = [];
let lotteryOrder = [];

async function loadData() {
  const res = await fetch(`${API}/data`);
  const data = await res.json();

  players = data.players || [];
  games = data.games || [];

  renderPlayers();
  renderSelects();
  renderResultInputs();
  renderLeaderboard();
  renderHistory();
}

function getSelectedPlayers() {
  return [
    document.getElementById("player1").value,
    document.getElementById("player2").value,
    document.getElementById("player3").value,
    document.getElementById("player4").value
  ].filter(Boolean);
}

async function addPlayer() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();

  if (!name) {
    alert("Please enter player name.");
    return;
  }

  await fetch(`${API}/player`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  input.value = "";
  await loadData();
}

function renderPlayers() {
  document.getElementById("totalPlayers").textContent = players.length;

  const playerBadges = document.getElementById("playerBadges");
  playerBadges.innerHTML = players.map(player => `
    <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-sm font-semibold text-blue-700">
      ${player}
    </div>
  `).join("");
}

function renderSelects() {
  document.querySelectorAll(".player-select").forEach(select => {
    const currentValue = select.value;

    select.innerHTML = `
      <option value="">Select Player</option>
      ${players.map(player => `<option value="${player}">${player}</option>`).join("")}
    `;

    if (players.includes(currentValue)) {
      select.value = currentValue;
    }

    select.onchange = renderResultInputs;
  });
}

function renderResultInputs() {
  const selected = getSelectedPlayers();
  const resultInputs = document.getElementById("resultInputs");

  if (selected.length === 0) {
    resultInputs.innerHTML = `
      <div class="md:col-span-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-500">
        Select 4 players first.
      </div>
    `;
    return;
  }

  resultInputs.innerHTML = selected.map(player => `
    <div class="rounded-xl border border-slate-200 p-4">
      <label class="mb-3 block text-center font-bold">${player}</label>
      <select data-player="${player}" class="position-select w-full rounded-xl border border-slate-300 px-4 py-3">
        <option value="">Position</option>
        <option value="1">1st (1)</option>
        <option value="2">2nd (2)</option>
        <option value="3">3rd (3)</option>
        <option value="4">4th (4)</option>
      </select>
    </div>
  `).join("");
}

function runLottery() {
  const selected = getSelectedPlayers();

  if (selected.length !== 4 || new Set(selected).size !== 4) {
    alert("Please select 4 different players.");
    return;
  }

  lotteryOrder = [...selected].sort(() => Math.random() - 0.5);

  const turnOrderSection = document.getElementById("turnOrderSection");
  const turnOrder = document.getElementById("turnOrder");

  turnOrderSection.classList.remove("hidden");

  turnOrder.innerHTML = lotteryOrder.map((player, index) => `
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
      <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-xl font-bold text-white">
        ${index + 1}
      </div>
      <p class="font-bold">${player}</p>
    </div>
  `).join("");

  document.getElementById("lotteryInfo").innerHTML = `
    <p class="font-bold">🎲 Lottery completed!</p>
    <p class="mt-1 text-sm">${lotteryOrder.join(" → ")}</p>
  `;
}

async function saveGame() {
  const selected = getSelectedPlayers();

  if (selected.length !== 4 || new Set(selected).size !== 4) {
    alert("Please select 4 different players.");
    return;
  }

  if (lotteryOrder.length !== 4) {
    alert("Please run lottery before saving the game.");
    return;
  }

  const positionSelects = document.querySelectorAll(".position-select");
  const results = [];

  positionSelects.forEach(select => {
    results.push({
      player: select.dataset.player,
      position: Number(select.value)
    });
  });

  const positions = results.map(result => result.position);

  if (
    positions.length !== 4 ||
    positions.includes(0) ||
    new Set(positions).size !== 4
  ) {
    alert("Please select unique positions 1, 2, 3 and 4.");
    return;
  }

  await fetch(`${API}/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lotteryOrder,
      results
    })
  });

  lotteryOrder = [];
  document.getElementById("turnOrderSection").classList.add("hidden");

  document.querySelectorAll(".player-select").forEach(select => {
    select.value = "";
  });

  await loadData();
  alert("Game result saved successfully.");
}

function getLeaderboard() {
  const board = {};

  players.forEach(player => {
    board[player] = {
      player,
      games: 0,
      wins: 0,
      points: 0
    };
  });

  games.forEach(game => {
    game.results.forEach(result => {
      if (!board[result.player]) {
        board[result.player] = {
          player: result.player,
          games: 0,
          wins: 0,
          points: 0
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
        4: 1
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

  tbody.innerHTML = leaderboard.map((row, index) => {
    const medals = ["🥇", "🥈", "🥉"];
    const rank = medals[index] || index + 1;

    return `
      <tr class="border-t border-slate-200">
        <td class="p-3 font-bold">${rank}</td>
        <td class="p-3 font-semibold">${row.player}</td>
        <td class="p-3">${row.games}</td>
        <td class="p-3">${row.wins}</td>
        <td class="p-3 font-bold text-green-600">${row.points}</td>
      </tr>
    `;
  }).join("");
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

  history.innerHTML = [...games].reverse().map(game => {
    const sortedResults = [...game.results].sort((a, b) => a.position - b.position);

    return `
      <div class="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <p class="mb-3 font-semibold text-slate-700">
          📅 ${new Date(game.date).toLocaleString()}
        </p>

        <p class="text-sm font-bold">Turn Order:</p>
        <p class="mb-3 text-sm">${game.lotteryOrder.join(" → ")}</p>

        <p class="text-sm font-bold">Result:</p>
        <p class="text-sm">
          ${sortedResults.map(result => `${result.position}. ${result.player}`).join(" | ")}
        </p>
      </div>
    `;
  }).join("");
}

loadData();
