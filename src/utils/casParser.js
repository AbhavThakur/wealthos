// ── CAS (Consolidated Account Statement) Mutual Fund & Portfolio Parser ───────
// Supports CAMS, KFintech, CDSL, NSDL exports (CSV, Tabular text, Excel format)

import { nextId } from "./finance";

/**
 * Infer Mutual Fund Category from scheme name
 */
export function inferMFCategory(schemeName = "") {
  const s = schemeName.toLowerCase();
  if (s.includes("flexi cap") || s.includes("flexicap")) return "Flexi Cap";
  if (s.includes("large & mid") || s.includes("large and mid")) return "Large & Mid Cap";
  if (s.includes("large cap") || s.includes("nifty 50") || s.includes("sensex") || s.includes("bluechip")) return "Large Cap";
  if (s.includes("mid cap") || s.includes("midcap") || s.includes("nifty midcap")) return "Mid Cap";
  if (s.includes("small cap") || s.includes("smallcap") || s.includes("nifty smallcap")) return "Small Cap";
  if (s.includes("elss") || s.includes("tax saver") || s.includes("tax advantage")) return "ELSS";
  if (s.includes("liquid") || s.includes("money market") || s.includes("overnight")) return "Liquid / Debt";
  if (s.includes("arbitrage") || s.includes("hybrid") || s.includes("balanced")) return "Hybrid";
  if (s.includes("gold") || s.includes("silver") || s.includes("commodity")) return "Gold & Commodities";
  if (s.includes("nasdaq") || s.includes("us equity") || s.includes("global") || s.includes("international")) return "International Equity";
  return "Mutual Fund";
}

/**
 * Parse raw CAS text or CSV content into structured portfolio holdings
 */
export function parseCASText(rawContent) {
  if (!rawContent || typeof rawContent !== "string") return [];

  const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const holdings = [];

  // Strategy 1: Check for CSV header format (e.g. Scheme Name, Folio, Units, NAV, Cost Value, Current Value)
  const isCsv = lines.some((l) => l.includes(",") && (l.toLowerCase().includes("folio") || l.toLowerCase().includes("scheme")));
  
  if (isCsv) {
    const csvHoldings = parseCsvCAS(lines);
    if (csvHoldings.length > 0) return csvHoldings;
  }

  // Strategy 2: Line-by-line regex pattern matching for CAMS / KFintech CAS text extracts
  let currentFolio = "";
  let currentAmc = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect AMC header
    if (line.includes("Mutual Fund") || line.includes("Asset Management")) {
      currentAmc = line.replace(/^(AMC:|Mutual Fund:)/i, "").trim();
    }

    // Detect Folio Number
    const folioMatch = line.match(/Folio\s*(?:No\.?|Number)?\s*[:-]?\s*([A-Za-z0-9/\-_]+)/i);
    if (folioMatch) {
      currentFolio = folioMatch[1].trim();
    }

    // Detect Scheme Name line with ISIN / Units / NAV
    // Example: Parag Parikh Flexi Cap Fund - Direct Growth | Units: 1450.23 | NAV: 74.20 | Value: 107607.06
    const unitsMatch = line.match(/(?:Units|Closing Balance|Qty|Balance Units)\s*[:-]?\s*([\d,]+(?:\.\d+)?)/i);
    const navMatch = line.match(/(?:NAV|Price|Current NAV)\s*[:-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
    const valMatch = line.match(/(?:Value|Valuation|Current Value|Market Value)\s*[:-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
    const costMatch = line.match(/(?:Cost|Invested|Cost Value|Purchase Value)\s*[:-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);

    if (unitsMatch && navMatch) {
      const units = parseFloat(unitsMatch[1].replace(/,/g, ""));
      const nav = parseFloat(navMatch[1].replace(/,/g, ""));
      const val = valMatch ? parseFloat(valMatch[1].replace(/,/g, "")) : units * nav;
      const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, "")) : 0;

      // Find scheme name from current line or previous line
      let schemeName = line.split(/(?:Units|Folio|NAV|ISIN)/i)[0].replace(/^[\d.\-\s]+/, "").trim();
      if (!schemeName && i > 0) {
        schemeName = lines[i - 1].replace(/^[\d.\-\s]+/, "").trim();
      }
      if (!schemeName) schemeName = "Mutual Fund Scheme";

      holdings.push({
        name: schemeName,
        folio: currentFolio || "N/A",
        amc: currentAmc,
        units,
        nav,
        currentValue: Math.round(val),
        invested: Math.round(cost),
        category: inferMFCategory(schemeName),
        type: "Mutual Fund",
        frequency: "monthly",
      });
    }
  }

  return holdings;
}

/**
 * Parses Tabular/CSV CAS rows
 */
function parseCsvCAS(lines) {
  const holdings = [];
  let headerIndex = -1;
  let headers = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("scheme") || (lower.includes("folio") && lower.includes("unit"))) {
      headerIndex = i;
      headers = splitCsvLine(lines[i]).map((h) => h.toLowerCase().trim());
      break;
    }
  }

  if (headerIndex === -1) return [];

  const schemeCol = headers.findIndex((h) => h.includes("scheme") || h.includes("fund") || h.includes("security") || h.includes("name"));
  const folioCol = headers.findIndex((h) => h.includes("folio"));
  const unitsCol = headers.findIndex((h) => h.includes("unit") || h.includes("qty") || h.includes("balance"));
  const navCol = headers.findIndex((h) => h.includes("nav") || h.includes("price") || h.includes("rate"));
  const costCol = headers.findIndex((h) => h.includes("cost") || h.includes("invested") || h.includes("purchase"));
  const valueCol = headers.findIndex((h) => h.includes("current value") || h.includes("market value") || h.includes("valuation") || (h.includes("value") && !h.includes("cost") && !h.includes("invested")));

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const schemeName = schemeCol >= 0 ? cols[schemeCol]?.trim() : "";
    if (!schemeName || schemeName.toLowerCase().includes("total") || schemeName.toLowerCase().includes("disclaimer")) continue;

    const units = unitsCol >= 0 ? parseNumeric(cols[unitsCol]) : 0;
    const nav = navCol >= 0 ? parseNumeric(cols[navCol]) : 0;
    let val = valueCol >= 0 ? parseNumeric(cols[valueCol]) : 0;
    if (val === 0 && units > 0 && nav > 0) val = units * nav;

    const cost = costCol >= 0 ? parseNumeric(cols[costCol]) : 0;
    const folio = folioCol >= 0 ? cols[folioCol]?.trim() : "";

    if (units > 0 || val > 0) {
      holdings.push({
        name: schemeName,
        folio: folio || "N/A",
        units: units || (nav > 0 ? Math.round(val / nav * 100) / 100 : 0),
        nav: nav || (units > 0 ? Math.round(val / units * 100) / 100 : 0),
        currentValue: Math.round(val),
        invested: Math.round(cost),
        category: inferMFCategory(schemeName),
        type: "Mutual Fund",
        frequency: "monthly",
      });
    }
  }

  return holdings;
}

/**
 * Split CSV line respecting quoted fields
 */
function splitCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === "\t") && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseNumeric(val) {
  if (!val) return 0;
  const clean = String(val).replace(/[₹$,\s]/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Compares parsed CAS holdings against existing investments to generate diff summary:
 * - toAdd: New schemes not present in current portfolio
 * - toUpdate: Existing schemes matched by name or folio with changed units/valuation
 * - unchanged: Identical holdings
 */
export function diffCASHoldings(casHoldings = [], existingInvestments = []) {
  const toAdd = [];
  const toUpdate = [];
  const unchanged = [];

  casHoldings.forEach((casItem) => {
    const normCasName = (casItem.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = existingInvestments.find((e) => {
      if (casItem.folio && casItem.folio !== "N/A" && e.folio && e.folio === casItem.folio) {
        return true;
      }
      const normEName = (e.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return normEName.length > 5 && (normEName.includes(normCasName) || normCasName.includes(normEName));
    });

    if (!match) {
      toAdd.push({
        ...casItem,
        action: "add",
      });
    } else {
      const isDifferent =
        Math.abs((match.currentValue || 0) - casItem.currentValue) > 50 ||
        Math.abs((match.units || 0) - (casItem.units || 0)) > 0.01;

      if (isDifferent) {
        toUpdate.push({
          ...match,
          prevCurrentValue: match.currentValue || 0,
          prevUnits: match.units || 0,
          currentValue: casItem.currentValue,
          units: casItem.units,
          nav: casItem.nav || match.nav,
          folio: casItem.folio !== "N/A" ? casItem.folio : match.folio,
          action: "update",
        });
      } else {
        unchanged.push({
          ...match,
          action: "unchanged",
        });
      }
    }
  });

  return { toAdd, toUpdate, unchanged };
}

/**
 * Merges approved CAS holdings into existing investments list
 */
export function mergeCASHoldings(existingInvestments = [], approvedItems = []) {
  const current = [...existingInvestments];

  approvedItems.forEach((item) => {
    if (item.action === "update" && item.id) {
      const idx = current.findIndex((c) => c.id === item.id);
      if (idx !== -1) {
        current[idx] = {
          ...current[idx],
          currentValue: item.currentValue,
          units: item.units,
          nav: item.nav,
          folio: item.folio || current[idx].folio,
          lastUpdated: new Date().toISOString().slice(0, 10),
        };
      }
    } else if (item.action === "add") {
      current.push({
        id: item.id || nextId(current),
        name: item.name,
        category: item.category || "Mutual Fund",
        type: "Mutual Fund",
        currentValue: item.currentValue || 0,
        amount: item.amount || 0,
        invested: item.invested || 0,
        units: item.units || 0,
        nav: item.nav || 0,
        folio: item.folio || "",
        frequency: "monthly",
        returnPct: 12,
        startDate: new Date().toISOString().slice(0, 10),
      });
    }
  });

  return current;
}
