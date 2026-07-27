const AMFI_NAV_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

export function parseAmfiSchemeByISIN(text, isin) {
  const clean = String(isin || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}[A-Z0-9]{9}$/.test(clean)) return null;

  for (const line of String(text || "").split(/\r?\n/)) {
    const fields = line.split(";");
    if (fields.length < 6) continue;
    const [schemeCode, isinGrowth, isinReinvestment, schemeName, nav] = fields;
    if (isinGrowth !== clean && isinReinvestment !== clean) continue;
    return {
      schemeCode,
      schemeName,
      isin: clean,
      matchedOn: isinGrowth === clean ? "growth" : "reinvestment",
      nav: Number(nav) || 0,
      navDate: fields[7] || "",
    };
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const isin = String(req.query?.isin || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}[A-Z0-9]{9}$/.test(isin)) {
    return res.status(400).json({ ok: false, error: "Invalid ISIN" });
  }

  try {
    const upstream = await fetch(AMFI_NAV_URL, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: "AMFI unavailable" });
    }
    const match = parseAmfiSchemeByISIN(await upstream.text(), isin);
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=21600, stale-while-revalidate=86400",
    );
    return match
      ? res.json({ ok: true, data: match })
      : res.status(404).json({ ok: false, error: "ISIN not found" });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message });
  }
}
