export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token  = process.env.GITHUB_TOKEN;
  const repo   = "kalpatarutree/frozen_remedy";
  const branch = "main";
  const path   = "reservations.json";

  if (!token) return res.status(500).json({ error: "Server not configured" });

  try {
    let reservation = req.body;
    if (typeof reservation === "string") reservation = JSON.parse(reservation);

    if (!reservation || !reservation.name) {
      return res.status(400).json({ error: "Invalid reservation data" });
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

    // Write updated file
    const putRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "New reservation: " + reservation.name,
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
