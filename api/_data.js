import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { get, put } from "@vercel/blob";
import { loadLocalEnv } from "./_env.js";

loadLocalEnv();

const DATA_FILE_NAME = "ludu-data.json";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "..", DATA_FILE_NAME);
const isVercel = Boolean(process.env.VERCEL);
const hasBlobStorage = isVercel && Boolean(process.env.BLOB_READ_WRITE_TOKEN);

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

async function readFileData() {
  try {
    return normalizeData(JSON.parse(await readFile(DATA_FILE, "utf-8")));
  } catch {
    const data = defaultData();
    await saveData(data);
    return data;
  }
}

async function saveFileData(data) {
  await writeFile(DATA_FILE, JSON.stringify(normalizeData(data), null, 2), "utf-8");
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
  const result = await get(DATA_FILE_NAME, {
    access: "private",
    useCache: false,
  });

  if (!result?.stream) {
    const data = await readFileData();
    await saveBlobData(data);
    return data;
  }

  try {
    return normalizeData(JSON.parse(await streamToText(result.stream)));
  } catch {
    const data = await readFileData();
    await saveBlobData(data);
    return data;
  }
}

async function saveBlobData(data) {
  await put(DATA_FILE_NAME, JSON.stringify(normalizeData(data), null, 2), {
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

  return readFileData();
}

export async function saveData(data) {
  if (hasBlobStorage) {
    await saveBlobData(data);
    return;
  }

  if (isVercel) {
    throw new Error(
      "Vercel deployments cannot write to ludu-data.json directly. Add Vercel Blob storage so BLOB_READ_WRITE_TOKEN is available.",
    );
  }

  await saveFileData(data);
}

export function addCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Write-Pin");
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
