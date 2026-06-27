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

  if (!token) return res.status(500).json({ error: "Server not configured" });

  try {
    let reservation = req.body;
    if (typeof reservation === "string") {
      try { reservation = JSON.parse(reservation); } catch(e) {}
    }

    if (!reservation || typeof reservation !== "object") {
      return res.status(400).json({ error: "Could not parse request body" });
    }

    const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };

    // ── 1. Append to reservations.json ──────────────────────────────────────
    const resFile = await fetch(`https://api.github.com/repos/${repo}/contents/reservations.json?ref=${branch}`, { headers });
    if (!resFile.ok) {
      const err = await resFile.json();
      return res.status(500).json({ error: "GitHub read error: " + (err.message || resFile.status) });
    }
    const resInfo = await resFile.json();
    const reservations = JSON.parse(Buffer.from(resInfo.content, "base64").toString("utf8"));
    reservations.push({ ...reservation, status: "confirmed" });

    const resPut = await fetch(`https://api.github.com/repos/${repo}/contents/reservations.json`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: "New reservation: " + (reservation.name || "unknown"),
        content: Buffer.from(JSON.stringify(reservations, null, 2)).toString("base64"),
        sha: resInfo.sha,
        branch
      })
    });
    if (!resPut.ok) {
      const err = await resPut.json();
      return res.status(500).json({ error: "GitHub write error: " + (err.message || resPut.status) });
    }

    // ── 2. Deduct inventory from products.json ───────────────────────────────
    const prodFile = await fetch(`https://api.github.com/repos/${repo}/contents/products.json?ref=${branch}`, { headers });
    if (prodFile.ok) {
      const prodInfo = await prodFile.json();
      const products = JSON.parse(Buffer.from(prodInfo.content, "base64").toString("utf8"));
      const flavorId = reservation.flavorId;
      const size     = reservation.size;   // "pint" or "quart"
      const qty      = reservation.quantity || 1;
      const flavor   = products.flavors.find(f => f.id === flavorId);
      if (flavor) {
        const key = size === "pint" ? "pints" : "quarts";
        flavor.inventory = flavor.inventory || {};
        flavor.inventory[key] = Math.max(0, (flavor.inventory[key] || 0) - qty);
      }
      await fetch(`https://api.github.com/repos/${repo}/contents/products.json`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: "Deduct inventory: " + (reservation.flavor || flavorId) + " " + size,
          content: Buffer.from(JSON.stringify(products, null, 2)).toString("base64"),
          sha: prodInfo.sha,
          branch
        })
      });
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown error" });
  }
}
