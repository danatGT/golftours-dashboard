// api/data.js
// Proxies Windsor.ai requests server-side so WINDSOR_API_KEY never reaches the browser.
// Windsor's HTTP API ignores filter params for this connector, so campaign
// filtering is applied here after the response comes back — but only when
// the response rows actually contain a "campaign" field (they don't for
// ad-level queries, only campaign/adset-level ones).

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WINDSOR_API_KEY not set in Vercel environment variables." });
  }

  const { fields, date_preset, accounts } = req.query;

  // Parse the campaign filter value from the filters param
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

  // Build Windsor URL — pass fields, date, and accounts only
  const params = new URLSearchParams();
  params.set("api_key", apiKey);
  if (fields)      params.set("fields", fields);
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

    // Only filter by campaign if:
    // 1. We have a campaign filter value, AND
    // 2. The first row actually has a "campaign" field
    // (Ad-level queries don't return campaign field — filtering those would wipe all rows)
    if (campaignFilter && data.length > 0 && data[0].campaign !== undefined) {
      data = data.filter(row => row.campaign === campaignFilter);
    }

    return res.status(200).json({ data });

  } catch (err) {
    console.error("Windsor proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
