import { readData, saveData, parseJsonBody, addCorsHeaders } from "./_data.js";

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
    const data = await readData();

    const game = {
      id: Date.now(),
      date: new Date().toISOString(),
      lotteryOrder: body.lotteryOrder || [],
      results: body.results || [],
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
