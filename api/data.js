export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const body = req.body;
    const apiKey = process.env.WINDSOR_API_KEY;
    if (!apiKey) throw new Error("WINDSOR_API_KEY environment variable is not set");

    const upstream = await fetch(`https://connectors.windsor.ai/facebook?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      throw new Error(`Windsor.ai responded with ${upstream.status}: ${text}`);
    }

    const data = await upstream.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("API route error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
