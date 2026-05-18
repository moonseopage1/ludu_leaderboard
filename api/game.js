import { readData, saveData, parseJsonBody, addCorsHeaders } from "./_data.js";
import { requireWritePin } from "./_auth.js";

export default async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    const body = req.body || (await parseJsonBody(req));
    req.body = body;

    if (!requireWritePin(req, res)) return;

    const data = await readData();
    const lotteryOrder = Array.isArray(body.lotteryOrder) ? body.lotteryOrder : [];
    const results = Array.isArray(body.results) ? body.results : [];
    const resultPlayers = results.map((result) => result.player);
    const positions = results.map((result) => Number(result.position));
    const validPositions = [1, 2, 3, 4];

    if (
      lotteryOrder.length !== 4 ||
      new Set(lotteryOrder).size !== 4 ||
      lotteryOrder.some((player) => !data.players.includes(player))
    ) {
      res.status(400).json({
        error: "Invalid players",
        details: "Please select 4 different saved players before saving the game.",
      });
      return;
    }

    if (
      results.length !== 4 ||
      new Set(resultPlayers).size !== 4 ||
      resultPlayers.some((player) => !lotteryOrder.includes(player))
    ) {
      res.status(400).json({
        error: "Invalid result players",
        details: "Each selected player needs exactly one result.",
      });
      return;
    }

    if (
      positions.some((position) => !validPositions.includes(position)) ||
      new Set(positions).size !== 4
    ) {
      res.status(400).json({
        error: "Invalid positions",
        details: "Please select unique positions 1, 2, 3 and 4.",
      });
      return;
    }

    const game = {
      id: Date.now(),
      date: new Date().toISOString(),
      lotteryOrder,
      results: results.map((result) => ({
        player: result.player,
        position: Number(result.position),
      })),
    };

    data.games.push(game);
    await saveData(data);

    res.status(200).json(data);
  } catch (error) {
    console.error("Error saving game:", error);
    res.status(500).json({
      error: "Failed to save game",
      details: error.message,
    });
  }
}
