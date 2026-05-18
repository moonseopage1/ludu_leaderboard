import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { defaultData, readData, saveData } from "./api/_data.js";

const app = express();
const PORT = 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Server directory:", __dirname);
console.log("Public path:", path.join(__dirname, "public"));

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
  res.json(await readData());
});

app.post("/api/player", async (req, res) => {
  const data = await readData();
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({ message: "Player name is required" });
  }

  const exists = data.players.some(
    (player) => player.toLowerCase() === name.toLowerCase(),
  );

  if (!exists) {
    data.players.push(name);
    await saveData(data);
  }

  res.json(data);
});

app.post("/api/game", async (req, res) => {
  const data = await readData();

  const game = {
    id: Date.now(),
    date: new Date().toISOString(),
    lotteryOrder: req.body.lotteryOrder || [],
    results: req.body.results || [],
  };

  data.games.push(game);
  await saveData(data);

  res.json(data);
});

app.delete("/api/reset", async (req, res) => {
  const data = defaultData();
  await saveData(data);
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Ludu app running at http://localhost:${PORT}`);
});
