export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "WINDSOR_API_KEY not set" });

  const { fields, date_preset, accounts, filters } = req.query;

  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  if (fields)      params.set("fields",      fields);
  if (date_preset) params.set("date_preset", date_preset);
  if (accounts)    params.set("accounts",    accounts);
  if (filters)     params.set("filter",      filters);

  try {
    const r = await fetch(`https://connectors.windsor.ai/facebook?${params}`);
    const data = await r.json();
    return res.status(200).json(data);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
