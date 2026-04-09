export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const apiKey = process.env.WINDSOR_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "WINDSOR_API_KEY not set in environment variables" });
    }

    // Parse body safely
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    // Windsor.ai expects the api_key as a query parameter
    const url = `https://connectors.windsor.ai/facebook?api_key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Windsor.ai error ${upstream.status}: ${text}` });
    }

    // Parse and return
    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch(e) {
      return res.status(500).json({ error: "Invalid JSON from Windsor.ai", raw: text.slice(0, 300) });
    }

  } catch (err) {
    console.error("Handler error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
