export const config = {
  api: { bodyParser: true }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token  = process.env.GITHUB_TOKEN;
  const repo   = "kalpatarutree/frozen_remedy";
  const branch = "main";
  const path   = "reservations.json";

  if (!token) return res.status(500).json({ error: "Server not configured" });

  try {
    let reservation = req.body;
    if (typeof reservation === "string") {
      try { reservation = JSON.parse(reservation); } catch(e) {}
    }

    if (!reservation || typeof reservation !== "object") {
      return res.status(400).json({ error: "Could not parse request body — got: " + JSON.stringify(req.body) });
    }

    // Get current reservations.json
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );

    if (!getRes.ok) {
      const err = await getRes.json();
      return res.status(500).json({ error: "GitHub read error: " + (err.message || getRes.status) });
    }

    const fileInfo = await getRes.json();
    const current  = JSON.parse(Buffer.from(fileInfo.content, "base64").toString("utf8"));
    current.push(reservation);

    const putRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "New reservation: " + (reservation.name || "unknown"),
          content: Buffer.from(JSON.stringify(current, null, 2)).toString("base64"),
          sha: fileInfo.sha,
          branch
        })
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      return res.status(500).json({ error: "GitHub write error: " + (err.message || putRes.status) });
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}
