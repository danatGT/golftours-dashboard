export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.WINDSOR_API_KEY;
    if (!apiKey) throw new Error("WINDSOR_API_KEY environment variable is not set");

    // Parse body — Vercel may or may not auto-parse JSON
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    // Add the API key into the request body (Windsor.ai accepts it this way)
    const payload = { ...body, api_key: apiKey };

    const upstream = await fetch("https://connectors.windsor.ai/facebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      throw new Error(`Windsor.ai error ${upstream.status}: ${text}`);
    }

    const data = await upstream.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("API route error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
