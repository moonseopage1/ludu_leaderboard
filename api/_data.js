import fs from "fs";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";

const DATA_FILE_NAME = "ludu-data.json";
const projectDataPath = path.join(process.cwd(), DATA_FILE_NAME);
let DATA_FILE = projectDataPath;
const BLOB_DATA_PATH = DATA_FILE_NAME;
const hasBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

try {
  fs.accessSync(projectDataPath, fs.constants.W_OK);
} catch {
  DATA_FILE = path.join(os.tmpdir(), DATA_FILE_NAME);
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

function normalizeData(data) {
  return {
    players: Array.isArray(data?.players) ? data.players : defaultData().players,
    games: Array.isArray(data?.games) ? data.games : [],
  };
}

function readLocalData() {
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

function saveLocalData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

async function readBlobData() {
  const result = await get(BLOB_DATA_PATH, { access: "private" });

  if (!result?.stream) {
    const data = defaultData();
    await saveBlobData(data);
    return data;
  }

  try {
    return normalizeData(JSON.parse(await streamToText(result.stream)));
  } catch {
    const data = defaultData();
    await saveBlobData(data);
    return data;
  }
}

async function saveBlobData(data) {
  await put(BLOB_DATA_PATH, JSON.stringify(normalizeData(data), null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function readData() {
  if (hasBlobStorage) {
    return readBlobData();
  }

  return readLocalData();
}

export async function saveData(data) {
  if (hasBlobStorage) {
    await saveBlobData(data);
    return;
  }

  saveLocalData(data);
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
