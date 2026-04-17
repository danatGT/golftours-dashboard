// api/data.js
// Proxies Windsor.ai requests server-side so WINDSOR_API_KEY never reaches the browser.
// Usage: GET /api/data?fields=spend,impressions&date_preset=this_monthT&accounts=532007480578438&filters=[...]

export default async function handler(req, res) {
  // Allow CORS from same origin (Vercel serves everything under one domain)
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WINDSOR_API_KEY not set in Vercel environment variables." });
  }

  // Forward all query params as-is to Windsor, just inject the api_key
  const params = new URLSearchParams(req.query);
  params.set("api_key", apiKey);

  const url = `https://connectors.windsor.ai/facebook?${params.toString()}`;

  try {
    const upstream = await fetch(url);
    const text = await upstream.text();

    // Windsor returns either { data: [...] } or bare [...]
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Windsor returned non-JSON: " + text.slice(0, 200) });
    }

    // Normalise to always return { data: [...] }
    const data = Array.isArray(json) ? json : (json.data || json);
    return res.status(200).json({ data: Array.isArray(data) ? data : [] });

  } catch (err) {
    console.error("Windsor proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
