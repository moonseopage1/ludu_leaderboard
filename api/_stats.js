export const SEASON_MATCH_LIMIT = 10;

export const POINTS_BY_POSITION = {
  1: 4,
  2: 3,
  3: 2,
  4: 1,
};

export const PENALTY_TYPES = {
  moved_other_piece: {
    label: "Intentionally moved another player's piece",
    points: 3,
  },
  influenced_other_move: {
    label: "Influenced another player's move",
    points: 1,
  },
};

const DEFAULT_PLAYERS = ["Babu Vai", "Saidul", "Adif", "Moon"];

function emptyStats(player) {
  return {
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

function cleanPlayers(players) {
  const source = Array.isArray(players) ? players : DEFAULT_PLAYERS;
  const seen = new Set();

  return source
    .map((player) => String(player || "").trim())
    .filter((player) => {
      const key = player.toLowerCase();
      if (!player || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function calculateStats(players = [], matches = []) {
  const stats = {};

  cleanPlayers(players).forEach((player) => {
    stats[player] = emptyStats(player);
  });

  matches.forEach((match) => {
    if (!Array.isArray(match?.results)) return;

    match.results.forEach((result) => {
      const player = String(result?.player || "").trim();
      const position = Number(result?.position);
      if (!player) return;

      if (!stats[player]) {
        stats[player] = emptyStats(player);
      }

      const points = POINTS_BY_POSITION[position] || 0;
      stats[player].matchesPlayed += 1;
      stats[player].gamePoints += points;
      stats[player].totalPoints += points;

      if (position === 1) stats[player].wins += 1;
      if (position === 4) stats[player].lostCount += 1;
    });

    (match.penalties || []).forEach((penalty) => {
      const player = String(penalty?.player || "").trim();
      if (!player) return;

      if (!stats[player]) {
        stats[player] = emptyStats(player);
      }

      const points = Math.max(0, Number(penalty?.points) || 0);
      stats[player].penaltyPoints += points;
      stats[player].penaltyCount += 1;
      stats[player].totalPoints -= points;
    });
  });

  return Object.values(stats).map((row) => {
    const averagePoint =
      row.matchesPlayed > 0 ? row.totalPoints / row.matchesPlayed : 0;
    const lossFactor =
      row.matchesPlayed > 0 ? 1 - row.lostCount / row.matchesPlayed : 0;
    const matchFactor = Math.min(1, row.matchesPlayed / SEASON_MATCH_LIMIT);

    return {
      ...row,
      averagePoint,
      rankingScore: averagePoint * lossFactor * matchFactor,
    };
  });
}

export function getLeaderboard(players = [], matches = []) {
  return calculateStats(players, matches).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.averagePoint !== a.averagePoint) return b.averagePoint - a.averagePoint;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.lostCount !== b.lostCount) return a.lostCount - b.lostCount;
    return a.player.localeCompare(b.player);
  });
}

export function getRanking(players = [], matches = []) {
  return calculateStats(players, matches).sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (a.lostCount !== b.lostCount) return a.lostCount - b.lostCount;
    return a.player.localeCompare(b.player);
  });
}

export function defaultData() {
  return {
    players: [...DEFAULT_PLAYERS],
    currentSeason: {
      number: 1,
      matchLimit: SEASON_MATCH_LIMIT,
      matches: [],
    },
    games: [],
    seasonHistory: [],
  };
}

function normalizeGame(game, fallbackSeasonNumber = 1) {
  const penalties = Array.isArray(game?.penalties)
    ? game.penalties
        .map((penalty) => {
          const type = String(penalty?.type || "").trim();
          return {
            player: String(penalty?.player || "").trim(),
            type,
            points:
              Number(penalty?.points) ||
              Number(PENALTY_TYPES[type]?.points) ||
              1,
          };
        })
        .filter((penalty) => penalty.player && PENALTY_TYPES[penalty.type])
    : [];

  return {
    id: game?.id || Date.now(),
    date: game?.date || new Date().toISOString(),
    seasonNumber: Number(game?.seasonNumber) || fallbackSeasonNumber,
    matchNumber: Number(game?.matchNumber) || 1,
    lotteryOrder: Array.isArray(game?.lotteryOrder) ? game.lotteryOrder : [],
    results: Array.isArray(game?.results)
      ? game.results.map((result) => ({
          player: String(result?.player || "").trim(),
          position: Number(result?.position),
        }))
      : [],
    penalties,
  };
}

function buildSeasonHistoryFromOldGames(players, oldGames) {
  const seasons = [];
  const normalizedGames = oldGames.map((game, index) =>
    normalizeGame(game, Math.floor(index / SEASON_MATCH_LIMIT) + 1),
  );

  for (let i = 0; i + SEASON_MATCH_LIMIT <= normalizedGames.length; i += SEASON_MATCH_LIMIT) {
    const matches = normalizedGames.slice(i, i + SEASON_MATCH_LIMIT).map((game, offset) => ({
      ...game,
      seasonNumber: seasons.length + 1,
      matchNumber: offset + 1,
    }));

    seasons.push({
      seasonNumber: seasons.length + 1,
      completedAt: matches[matches.length - 1]?.date || new Date().toISOString(),
      matchCount: matches.length,
      leaderboard: getLeaderboard(players, matches),
      matches,
    });
  }

  return {
    completedSeasons: seasons,
    remainingMatches: normalizedGames
      .slice(seasons.length * SEASON_MATCH_LIMIT)
      .map((game, index) => ({
        ...game,
        seasonNumber: seasons.length + 1,
        matchNumber: index + 1,
      })),
  };
}

function resultSignature(results = []) {
  return results
    .map((result) => ({
      player: String(result?.player || "").trim(),
      position: Number(result?.position),
    }))
    .sort((a, b) => a.player.localeCompare(b.player));
}

function penaltySignature(penalties = []) {
  return penalties
    .map((penalty) => {
      const type = String(penalty?.type || "").trim();
      return {
        player: String(penalty?.player || "").trim(),
        type,
        points:
          Number(penalty?.points) ||
          Number(PENALTY_TYPES[type]?.points) ||
          1,
      };
    })
    .filter((penalty) => penalty.player && PENALTY_TYPES[penalty.type])
    .sort((a, b) => {
      if (a.player !== b.player) return a.player.localeCompare(b.player);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.points - b.points;
    });
}

function isSameGamePayload(game, payload) {
  const gameLottery = game?.lotteryOrder || [];
  const payloadLottery = payload.lotteryOrder || [];

  // Duplicate detection requires a non-empty lottery order on both sides.
  // Without one, two games can legitimately share the same results, so we
  // can't reliably tell them apart and must allow the save.
  if (gameLottery.length === 0 || payloadLottery.length === 0) return false;
  if (JSON.stringify(gameLottery) !== JSON.stringify(payloadLottery)) return false;

  return (
    JSON.stringify(resultSignature(game?.results)) ===
      JSON.stringify(resultSignature(payload.results)) &&
    JSON.stringify(penaltySignature(game?.penalties)) ===
      JSON.stringify(penaltySignature(payload.penalties))
  );
}

export function normalizeData(data) {
  const players = cleanPlayers(data?.players);
  const seasonHistory = Array.isArray(data?.seasonHistory)
    ? data.seasonHistory
    : [];
  const legacyGames = Array.isArray(data?.games) ? data.games : [];

  let currentSeason;
  let migratedSeasonHistory = seasonHistory;

  if (data?.currentSeason && Array.isArray(data.currentSeason.matches)) {
    const number = Math.max(1, Number(data.currentSeason.number) || 1);
    currentSeason = {
      number,
      matchLimit: SEASON_MATCH_LIMIT,
      matches: data.currentSeason.matches.map((game, index) => ({
        ...normalizeGame(game, number),
        seasonNumber: number,
        matchNumber: index + 1,
      })),
    };
  } else {
    const migrated = buildSeasonHistoryFromOldGames(players, legacyGames);
    migratedSeasonHistory = [...seasonHistory, ...migrated.completedSeasons];
    currentSeason = {
      number: migratedSeasonHistory.length + 1,
      matchLimit: SEASON_MATCH_LIMIT,
      matches: migrated.remainingMatches,
    };
  }

  const historyMatches = [
    ...migratedSeasonHistory.flatMap((season) =>
      Array.isArray(season?.matches) ? season.matches : [],
    ),
    ...currentSeason.matches,
  ];

  const games = (legacyGames.length > historyMatches.length
    ? legacyGames
    : historyMatches
  ).map((game, index) =>
    normalizeGame(game, Math.floor(index / SEASON_MATCH_LIMIT) + 1),
  );

  return {
    players,
    currentSeason,
    games,
    seasonHistory: migratedSeasonHistory.map((season, index) => {
      const matches = Array.isArray(season?.matches) ? season.matches : [];
      return {
        seasonNumber: Number(season?.seasonNumber) || index + 1,
        completedAt: season?.completedAt || new Date().toISOString(),
        matchCount: Number(season?.matchCount) || matches.length || SEASON_MATCH_LIMIT,
        leaderboard: getLeaderboard(players, matches),
        matches,
      };
    }),
  };
}

export function getDerivedData(data) {
  const normalized = normalizeData(data);
  const currentMatches = normalized.currentSeason.matches;

  return {
    ...normalized,
    leaderboard: getLeaderboard(normalized.players, currentMatches),
    ranking: getRanking(normalized.players, currentMatches),
    allTimeRanking: getRanking(normalized.players, normalized.games),
    seasonProgress: {
      seasonNumber: normalized.currentSeason.number,
      currentMatch: currentMatches.length,
      matchLimit: SEASON_MATCH_LIMIT,
    },
  };
}

export function addGameResult(data, payload) {
  const normalized = normalizeData(data);
  const lastGame = normalized.games.at(-1);

  if (lastGame && isSameGamePayload(lastGame, payload)) {
    return {
      data: normalized,
      completedSeason: null,
      duplicateGame: lastGame,
    };
  }

  const currentSeason = normalized.currentSeason;
  const matchNumber = currentSeason.matches.length + 1;
  const game = {
    id: Date.now(),
    date: new Date().toISOString(),
    seasonNumber: currentSeason.number,
    matchNumber,
    lotteryOrder: payload.lotteryOrder,
    results: payload.results.map((result) => ({
      player: result.player,
      position: Number(result.position),
    })),
    penalties: Array.isArray(payload.penalties)
      ? payload.penalties
          .map((penalty) => {
            const type = String(penalty?.type || "").trim();
            return {
              player: String(penalty?.player || "").trim(),
              type,
              points:
                Number(penalty?.points) ||
                Number(PENALTY_TYPES[type]?.points) ||
                1,
            };
          })
          .filter((penalty) => penalty.player && PENALTY_TYPES[penalty.type])
      : [],
  };

  currentSeason.matches.push(game);
  normalized.games.push(game);

  let completedSeason = null;

  if (currentSeason.matches.length >= SEASON_MATCH_LIMIT) {
    completedSeason = {
      seasonNumber: currentSeason.number,
      completedAt: game.date,
      matchCount: currentSeason.matches.length,
      leaderboard: getLeaderboard(normalized.players, currentSeason.matches),
      matches: currentSeason.matches,
    };

    normalized.seasonHistory.push(completedSeason);
    normalized.currentSeason = {
      number: currentSeason.number + 1,
      matchLimit: SEASON_MATCH_LIMIT,
      matches: [],
    };
  }

  return {
    data: normalized,
    completedSeason,
  };
}
