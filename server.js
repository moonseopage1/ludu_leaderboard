import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { defaultData, readData, saveData } from "./api/_data.js";
import { requireWritePin } from "./api/_auth.js";
import { addGameResult, getDerivedData } from "./api/_stats.js";

const app = express();
const PORT = 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Server directory:", __dirname);
console.log("Public path:", path.join(__dirname, "public"));
console.log("ENV LUDU_WRITE_PIN =", process.env.LUDU_WRITE_PIN);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html for root path
app.get("/", (req, res) => {
  const indexPath = path.join(__dirname, "public", "index.html");
  console.log("Serving index.html from:", indexPath);
  res.sendFile(indexPath);
});

app.get("/api/data", async (req, res) => {
  res.json(getDerivedData(await readData()));
});

app.post("/api/player", async (req, res) => {
  console.log("POST /api/player headers:", req.headers);
  if (!requireWritePin(req, res)) return;

  const data = await readData();
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({
      error: "Player name is required",
      details: "Please enter a player name.",
    });
  }

  if (name.length > 40) {
    return res.status(400).json({
      error: "Player name is too long",
      details: "Player name must be 40 characters or less.",
    });
  }

  const exists = data.players.some(
    (player) => player.toLowerCase() === name.toLowerCase(),
  );

  if (exists) {
    return res.status(409).json({
      error: "Player already exists",
      details: `${name} is already in the player list.`,
    });
  }

  data.players.push(name);
  await saveData(data);

  res.json(getDerivedData(data));
});

app.post("/api/game", async (req, res) => {
  if (!requireWritePin(req, res)) return;

  const data = await readData();
  const lotteryOrder = Array.isArray(req.body.lotteryOrder)
    ? req.body.lotteryOrder
    : [];
  const results = Array.isArray(req.body.results) ? req.body.results : [];
  const resultPlayers = results.map((result) => result.player);
  const positions = results.map((result) => Number(result.position));
  const validPositions = [1, 2, 3, 4];

  if (
    lotteryOrder.length > 0 &&
    (lotteryOrder.length !== 4 ||
      new Set(lotteryOrder).size !== 4 ||
      lotteryOrder.some((player) => !data.players.includes(player)))
  ) {
    return res.status(400).json({
      error: "Invalid players",
      details: "Lottery order must contain 4 different saved players.",
    });
  }

  if (
    results.length !== 4 ||
    new Set(resultPlayers).size !== 4 ||
    resultPlayers.some((player) => !data.players.includes(player)) ||
    (lotteryOrder.length === 4 &&
      resultPlayers.some((player) => !lotteryOrder.includes(player)))
  ) {
    return res.status(400).json({
      error: "Invalid result players",
      details: "Each selected saved player needs exactly one result.",
    });
  }

  if (
    positions.some((position) => !validPositions.includes(position)) ||
    new Set(positions).size !== 4
  ) {
    return res.status(400).json({
      error: "Invalid positions",
      details: "Please select unique positions 1, 2, 3 and 4.",
    });
  }

  const saved = addGameResult(data, {
    lotteryOrder,
    results,
  });

  await saveData(saved.data);

  res.json({
    ...getDerivedData(saved.data),
    completedSeason: saved.completedSeason,
  });
});

app.delete("/api/reset", async (req, res) => {
  if (!requireWritePin(req, res)) return;

  const data = defaultData();
  await saveData(data);
  res.json(getDerivedData(data));
});

app.listen(PORT, () => {
  console.log(`Ludu app running at http://localhost:${PORT}`);
});
