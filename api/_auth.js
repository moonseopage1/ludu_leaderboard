import { loadLocalEnv } from "./_env.js";

function getWritePin() {
  loadLocalEnv();
  return (process.env.LUDU_WRITE_PIN || process.env.ADMIN_PIN || "").trim();
}

function getSubmittedPin(req) {
  return (
    req.headers?.["x-write-pin"] ||
    req.headers?.["X-Write-Pin"] ||
    req.body?.pin ||
    ""
  ).toString();
}

export function requireWritePin(req, res) {
  const writePin = getWritePin();

  if (!writePin) {
    res.status(500).json({
      error: "Write PIN is not configured",
      details: "Set LUDU_WRITE_PIN in your local .env and Vercel environment variables.",
    });
    return false;
  }

  if (getSubmittedPin(req).trim() !== writePin) {
    res.status(401).json({
      error: "Invalid PIN",
      details: "Enter the correct PIN to add players or save games.",
    });
    return false;
  }

  return true;
}
