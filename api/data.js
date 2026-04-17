// api/data.js
// Proxies Windsor.ai requests server-side.
// Windsor ignores filter params on this connector's HTTP API, so we:
// 1. Always request the "campaign" field alongside whatever fields the dashboard asks for
// 2. Filter rows by campaign name here after the response comes back
// 3. Strip the "campaign" field back out if the dashboard didn't ask for it

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WINDSOR_API_KEY not set in Vercel environment variables." });
  }

  const { date_preset, accounts } = req.query;

  // Parse the campaign name to filter by from the filters param
  // e.g. [["campaign","eq","GT - Traffic - 2026"]] → "GT - Traffic - 2026"
  let campaignFilter = null;
  try {
    const filters = JSON.parse(req.query.filters || "[]");
    const findEq = (arr) => {
      for (const item of arr) {
        if (Array.isArray(item) && item[0] === "campaign" && item[1] === "eq") return item[2];
        if (Array.isArray(item)) { const r = findEq(item); if (r) return r; }
      }
      return null;
    };
    campaignFilter = findEq(filters);
  } catch (_) {}

  // Parse the requested fields and always inject "campaign" so we can filter
  let requestedFields = [];
  try {
    requestedFields = (req.query.fields || "").split(",").map(f => f.trim()).filter(Boolean);
  } catch (_) {}

  const hadCampaignField = requestedFields.includes("campaign");
  const fieldsToRequest = hadCampaignField
    ? requestedFields
    : ["campaign", ...requestedFields];

  // Build Windsor URL
  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  params.set("fields", fieldsToRequest.join(","));
  if (date_preset) params.set("date_preset", date_preset);
  if (accounts)    params.set("accounts", accounts);

  const url = `https://connectors.windsor.ai/facebook?${params.toString()}`;

  try {
    const upstream = await fetch(url);
    const text = await upstream.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Windsor returned non-JSON: " + text.slice(0, 300) });
    }

    // Normalise to array
    let data = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);

    // Filter by campaign — now guaranteed to work because we always fetch the campaign field
    if (campaignFilter) {
      data = data.filter(row => row.campaign === campaignFilter);
    }

    // Strip "campaign" back out if the dashboard didn't originally ask for it
    if (!hadCampaignField && data.length > 0) {
      data = data.map(({ campaign, ...rest }) => rest);
    }

    return res.status(200).json({ data });

  } catch (err) {
    console.error("Windsor proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
