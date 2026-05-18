import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const DATA_FILE_NAME = "ludu-data.json";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "..", DATA_FILE_NAME);

export function defaultData() {
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

function normalizeData(data) {
  return {
    players: Array.isArray(data?.players) ? data.players : defaultData().players,
    games: Array.isArray(data?.games) ? data.games : [],
  };
}

export async function readData() {
  try {
    return normalizeData(JSON.parse(await readFile(DATA_FILE, "utf-8")));
  } catch {
    const data = defaultData();
    await saveData(data);
    return data;
  }
}

export async function saveData(data) {
  await writeFile(DATA_FILE, JSON.stringify(normalizeData(data), null, 2), "utf-8");
}

export function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}
