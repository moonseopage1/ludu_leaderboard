import { readData, addCorsHeaders } from "./_data.js";

export default async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    res.status(200).json(await readData());
  } catch (error) {
    console.error("Error reading data:", error);
    res.status(500).json({ error: "Failed to read data" });
  }
}
