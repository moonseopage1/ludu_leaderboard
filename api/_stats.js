export const SEASON_MATCH_LIMIT = 10;

export const POINTS_BY_POSITION = {
  1: 4,
  2: 3,
  3: 2,
  4: 1,
};

const DEFAULT_PLAYERS = ["Babu Vai", "Saidul", "Adif", "Moon"];

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
    stats[player] = {
      player,
      matchesPlayed: 0,
      wins: 0,
      totalPoints: 0,
      averagePoint: 0,
      rankingScore: 0,
      lostCount: 0,
    };
  });

  matches.forEach((match) => {
    if (!Array.isArray(match?.results)) return;

    match.results.forEach((result) => {
      const player = String(result?.player || "").trim();
      const position = Number(result?.position);
      if (!player) return;

      if (!stats[player]) {
        stats[player] = {
          player,
          matchesPlayed: 0,
          wins: 0,
          totalPoints: 0,
          averagePoint: 0,
          rankingScore: 0,
          lostCount: 0,
        };
      }

      stats[player].matchesPlayed += 1;
      stats[player].totalPoints += POINTS_BY_POSITION[position] || 0;

      if (position === 1) stats[player].wins += 1;
      if (position === 4) stats[player].lostCount += 1;
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
        leaderboard: Array.isArray(season?.leaderboard)
          ? season.leaderboard
          : getLeaderboard(players, matches),
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
