import { defaultData, saveData, addCorsHeaders } from "./_data.js";
import { requireWritePin } from "./_auth.js";

export default async function handler(req, res) {
  addCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "DELETE") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    if (!requireWritePin(req, res)) return;

    const data = defaultData();
    await saveData(data);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error resetting data:", error);
    res.status(500).json({
      error: "Failed to reset data",
      details: error.message,
    });
  }
}
