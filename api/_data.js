import fs from "fs";
import os from "os";
import path from "path";

const projectDataPath = path.join(process.cwd(), "ludu-data.txt");
let DATA_FILE = projectDataPath;

try {
  fs.accessSync(projectDataPath, fs.constants.W_OK);
} catch {
  DATA_FILE = path.join(os.tmpdir(), "ludu-data.txt");
}

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

export function readData() {
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

export function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
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
