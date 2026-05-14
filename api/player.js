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
    const name = body.name?.trim();

    if (!name) {
      res.status(400).json({ message: "Player name is required" });
      return;
    }

    const data = readData();
    const exists = data.players.some(
      (player) => player.toLowerCase() === name.toLowerCase(),
    );

    if (!exists) {
      data.players.push(name);
      saveData(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error adding player:", error);
    res.status(500).json({ error: "Failed to add player" });
  }
}
