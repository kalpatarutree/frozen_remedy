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
    let payload = req.body;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch(e) {}
    }

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    };

    // Get current SHA
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/products.json?ref=${branch}`,
      { headers }
    );
    if (!getRes.ok) {
      const err = await getRes.json();
      return res.status(500).json({ error: "GitHub read error: " + (err.message || getRes.status) });
    }
    const { sha } = await getRes.json();

    // Write updated products.json
    const body = JSON.stringify(payload, null, 2);
    const encoded = Buffer.from(body).toString("base64");

    const putRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/products.json`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: "Update products.json from admin",
          content: encoded,
          sha,
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
