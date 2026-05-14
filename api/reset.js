import { defaultData, saveData } from "./_data.js";

export default function handler(req, res) {
  if (req.method !== "DELETE") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const data = defaultData();
  saveData(data);
  res.status(200).json(data);
}
