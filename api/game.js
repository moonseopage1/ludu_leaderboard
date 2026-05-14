import { readData, saveData, parseJsonBody } from "./_data.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const body = req.body || (await parseJsonBody(req));
  const data = readData();

  const game = {
    id: Date.now(),
    date: new Date().toISOString(),
    lotteryOrder: body.lotteryOrder || [],
    results: body.results || [],
  };

  data.games.push(game);
  saveData(data);

  res.status(200).json(data);
}
