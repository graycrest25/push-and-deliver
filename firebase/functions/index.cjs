const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { calculateAccountSummary } = require("./account-summary.cjs");
if (!getApps().length) initializeApp();
const cache = new Map();

exports.getAdminAccountSummary = onRequest(
  { cors: true, timeoutSeconds: 60 },
  async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    if (req.method !== "GET")
      return res.status(405).json({ error: "Method not allowed" });
    const token = /^Bearer (.+)$/.exec(req.get("Authorization") || "")?.[1];
    if (!token)
      return res
        .status(401)
        .json({ error: "Sign in to view account summaries" });
    let claims;
    try {
      claims = await getAuth().verifyIdToken(token, true);
    } catch {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const type = req.query.type;
    if (type !== "users" && type !== "riders")
      return res.status(400).json({ error: "Invalid account type" });
    const allowed =
      type === "riders"
        ? ["super", "regular", "customercare", "verifier"]
        : ["super", "regular", "customercare"];
    if (claims.isAdmin !== true || !allowed.includes(claims.adminType)) {
      return res
        .status(403)
        .json({ error: "You cannot view this account summary" });
    }
    try {
      const now = Date.now();
      let entry = cache.get(type);
      // Coalesce concurrent requests. Bound staleness and never reuse yesterday's counts.
      const day = Math.floor((now + 3600000) / 86400000);
      if (!entry || entry.expires <= now || entry.day !== day) {
        entry = {
          expires: now + 30000,
          day,
          result: calculateAccountSummary(getFirestore(), type),
        };
        cache.set(type, entry);
        entry.result.catch(() => {
          if (cache.get(type) === entry) cache.delete(type);
        });
      }
      return res.json(await entry.result);
    } catch (error) {
      console.error("Account summary failed", error);
      return res
        .status(500)
        .json({ error: "Unable to calculate account summary" });
    }
  },
);
