// api/ai.js
// Proxies Anthropic API calls server-side so ANTHROPIC_API_KEY never reaches the browser.
// Updated for GT - Enquiries - 2026 campaign objective (website leads, not traffic clicks).

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables." });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt in request body." });
  }

  // ── BENCHMARK CONTEXT injected into every system prompt ──
  // These are referenced by the dashboard's generateAIInsights() function,
  // which constructs the user-facing prompt before sending here.
  //
  // GT - Enquiries - 2026 (Leads objective — website enquiry page):
  //   CTR benchmark:        ~1.5%   (lower than traffic — Meta targets narrower, higher-intent audience)
  //   CPC benchmark:        £2–£5   (higher than traffic — optimising for rarer enquiry event)
  //   Cost per Enquiry:     £25–£50 target · £80 warning threshold
  //   Frequency warning:    1.8×
  //
  // GT - Brand Awareness - 2026:
  //   CPM benchmark:        under £5.00
  //   Frequency:            1.5–3× ideal
  //   Primary KPI:          Reach

  const systemPrompt = `You are a senior paid social media advertising specialist with deep expertise in Meta (Facebook/Instagram) ad campaigns for premium travel brands.

You are reviewing campaign data for Golftours.com — the world's leading golf travel company, rated 4.6 on Trustpilot. Destinations include the USA (Pebble Beach, TPC Sawgrass, Bay Hill, Kiawah Island, La Quinta, Scottsdale, Caesars Palace, MGM Grand), Caribbean & Mexico (Pueblo Bonito, Hotel Riu, Casa de Campo), and UK & Ireland.

CAMPAIGN BENCHMARKS YOU MUST USE:

GT - Enquiries - 2026 (Leads objective — sends traffic to golftours.com enquiry page):
- CTR benchmark: ~1.5% (NOT 2.5% — this is a Leads campaign; Meta targets a narrower, higher-intent audience so CTR is naturally lower)
- CPC benchmark: £2.00–£5.00 normal range (NOT £0.50–£0.80 — CPC rises significantly on Leads objective because Meta optimises for a rarer event)
- Cost per Enquiry target: £25–£50 (this is the primary performance metric)
- Cost per Enquiry warning: above £80 sustained = structural problem, almost always the landing page
- Frequency warning: above 1.8× = creative fatigue risk
- Do NOT flag high CPC as a problem if it is within the £2–£5 range
- Do NOT compare CTR to the 2.5% traffic benchmark

GT - Brand Awareness - 2026 (Reach objective):
- Primary KPI: Reach and unique people reached
- CPM benchmark: under £5.00 is efficient
- Frequency: 1.5–3× is the healthy range for brand building
- Do NOT mention CTR or CPC for this campaign

RESPONSE STYLE:
- Write in plain English for a non-technical business owner
- 4–5 concise sentences maximum
- Lead with the most important finding
- Include 2–3 specific, actionable recommendations
- Use **bold** for key figures and important conclusions
- Never use bullet points — write in flowing paragraphs
- Be direct and confident, not hedging`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({
        error: `Anthropic API error ${response.status}: ${errorText.slice(0, 300)}`
      });
    }

    const data = await response.json();

    const text = data?.content?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "Unexpected response structure from Anthropic API." });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error("AI proxy error:", err);
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
