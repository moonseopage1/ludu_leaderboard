import { loadLocalEnv } from "./_env.js";

loadLocalEnv();

const WRITE_PIN = process.env.LUDU_WRITE_PIN || process.env.ADMIN_PIN || "";

function getSubmittedPin(req) {
  return (
    req.headers?.["x-write-pin"] ||
    req.headers?.["X-Write-Pin"] ||
    req.body?.pin ||
    ""
  ).toString();
}

export function requireWritePin(req, res) {
  if (!WRITE_PIN) {
    res.status(500).json({
      error: "Write PIN is not configured",
      details: "Set LUDU_WRITE_PIN in your local .env and Vercel environment variables.",
    });
    return false;
  }

  if (getSubmittedPin(req) !== WRITE_PIN) {
    res.status(401).json({
      error: "Invalid PIN",
      details: "Enter the correct PIN to add players or save games.",
    });
    return false;
  }

  return true;
}
