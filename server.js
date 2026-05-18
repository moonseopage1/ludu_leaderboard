import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 4000;
const DATA_FILE = "./ludu-data.json";

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

function defaultData() {
  return {
    players: [
      "Aman",
      "Vikas",
      "Rahul",
      "Suresh",
      "Rohit",
      "Neha",
      "Karan",
      "Pooja",
    ],
    games: [],
  };
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2));
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    const data = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return data;
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get("/api/data", (req, res) => {
  res.json(readData());
});

app.post("/api/player", (req, res) => {
  const data = readData();
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({ message: "Player name is required" });
  }

  const exists = data.players.some(
    (player) => player.toLowerCase() === name.toLowerCase(),
  );

  if (!exists) {
    data.players.push(name);
    saveData(data);
  }

  res.json(data);
});

app.post("/api/game", (req, res) => {
  const data = readData();

  const game = {
    id: Date.now(),
    date: new Date().toISOString(),
    lotteryOrder: req.body.lotteryOrder || [],
    results: req.body.results || [],
  };

  data.games.push(game);
  saveData(data);

  res.json(data);
});

app.delete("/api/reset", (req, res) => {
  const data = defaultData();
  saveData(data);
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Ludu app running at http://localhost:${PORT}`);
});
