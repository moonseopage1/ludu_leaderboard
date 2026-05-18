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

    const name = body.name?.trim();

    if (!name) {
      res.status(400).json({
        error: "Player name is required",
        details: "Please enter a player name.",
      });
      return;
    }

    if (name.length > 40) {
      res.status(400).json({
        error: "Player name is too long",
        details: "Player name must be 40 characters or less.",
      });
      return;
    }

    const data = await readData();
    const exists = data.players.some(
      (player) => player.toLowerCase() === name.toLowerCase(),
    );

    if (exists) {
      res.status(409).json({
        error: "Player already exists",
        details: `${name} is already in the player list.`,
      });
      return;
    }

    data.players.push(name);
    await saveData(data);

    res.status(200).json(data);
  } catch (error) {
    console.error("Error adding player:", error);
    res.status(500).json({
      error: "Failed to add player",
      details: error.message,
    });
  }
}
