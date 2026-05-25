import { readFile } from "fs/promises";
import { put } from "@vercel/blob";
import { loadLocalEnv } from "../api/_env.js";
import { normalizeData } from "../api/_stats.js";

const DATA_FILE_NAME = "ludu-data.json";

loadLocalEnv();

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "Missing BLOB_READ_WRITE_TOKEN. Add it to .env or set it in this shell before running the seed script.",
  );
  process.exit(1);
}

const rawData = JSON.parse(await readFile(DATA_FILE_NAME, "utf-8"));
const normalizedData = normalizeData(rawData);

const blob = await put(
  DATA_FILE_NAME,
  JSON.stringify(normalizedData, null, 2),
  {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  },
);

console.log(`Uploaded ${DATA_FILE_NAME} to Vercel Blob.`);
console.log(`Blob pathname: ${blob.pathname}`);
