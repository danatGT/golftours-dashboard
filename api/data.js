// api/data.js
// Proxies Windsor.ai requests server-side so WINDSOR_API_KEY never reaches the browser.
// NOTE: Windsor's HTTP API ignores filter params for this connector, so we
// apply campaign/account filtering here after the data comes back.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "WINDSOR_API_KEY not set in Vercel environment variables." });
  }

  // Pull params from the request
  const { fields, date_preset, accounts } = req.query;

  // The campaign filter sent by the dashboard e.g. [["campaign","eq","GT - Traffic - 2026"]]
  // Windsor ignores this on the HTTP API, so we parse it here and apply it ourselves
  let campaignFilter = null;
  try {
    const filters = JSON.parse(req.query.filters || "[]");
    // Find the first ["campaign","eq","<value>"] condition anywhere in the filter array
    const findEq = (arr) => {
      for (const item of arr) {
        if (Array.isArray(item) && item[0] === "campaign" && item[1] === "eq") return item[2];
        if (Array.isArray(item)) { const r = findEq(item); if (r) return r; }
      }
      return null;
    };
    campaignFilter = findEq(filters);
  } catch (_) {}

  // Build the Windsor URL — pass fields, date, and accounts only (filter is handled here)
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

    // Apply campaign filter server-side since Windsor ignores it
    if (campaignFilter && data.length > 0) {
      data = data.filter(row => row.campaign === campaignFilter);
    }

    // Also restrict to the requested account ID if provided
    if (accounts && data.length > 0 && data[0].account_id !== undefined) {
      const accountList = accounts.split(",").map(a => a.trim());
      data = data.filter(row => accountList.includes(String(row.account_id)));
    }

    return res.status(200).json({ data });

  } catch (err) {
    console.error("Windsor proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
