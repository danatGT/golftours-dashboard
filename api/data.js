export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WINDSOR_API_KEY is not set in Vercel environment variables" });
  }

  try {
    // Windsor.ai uses GET with query params — not POST with JSON body
    const { fields, date_preset, filters, accounts } = req.method === "POST" ? req.body : req.query;

    const params = new URLSearchParams();
    params.set("api_key", apiKey);
    params.set("fields", Array.isArray(fields) ? fields.join(",") : fields);
    if (date_preset) params.set("date_preset", date_preset);
    if (accounts) params.set("accounts", Array.isArray(accounts) ? accounts.join(",") : accounts);
    if (filters) params.set("filter", typeof filters === "string" ? filters : JSON.stringify(filters));

    const url = `https://connectors.windsor.ai/facebook?${params.toString()}`;

    const upstream = await fetch(url, { method: "GET" });
    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Windsor.ai error ${upstream.status}`, detail: text.slice(0, 300) });
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
