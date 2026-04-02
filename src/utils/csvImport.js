// CSV bank statement parser
// Supports common Indian bank CSV formats (date, description, debit, credit, balance)

/**
 * Parse a CSV string into an array of row objects.
 * Auto-detects delimiter (comma or semicolon) and handles quoted fields.
 */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detect delimiter
  const delim = lines[0].includes(";") ? ";" : ",";

  const splitRow = (line) => {
    const result = [];
    let current = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === delim && !inQuote) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    if (vals.length < 2 || vals.every((v) => !v)) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = vals[j] || "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Auto-detect column mappings from headers.
 * Returns { date, description, amount, debit, credit } with header name matches.
 */
export function autoDetectColumns(headers) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const mapping = {
    date: "",
    description: "",
    amount: "",
    debit: "",
    credit: "",
  };

  for (let i = 0; i < lower.length; i++) {
    const h = lower[i];
    if (
      !mapping.date &&
      (h.includes("date") || h.includes("txn date") || h.includes("value date"))
    ) {
      mapping.date = headers[i];
    }
    if (
      !mapping.description &&
      (h.includes("desc") ||
        h.includes("narration") ||
        h.includes("particular") ||
        h.includes("remark"))
    ) {
      mapping.description = headers[i];
    }
    if (!mapping.amount && (h === "amount" || h === "transaction amount")) {
      mapping.amount = headers[i];
    }
    if (
      !mapping.debit &&
      (h.includes("debit") || h.includes("withdrawal") || h.includes("dr"))
    ) {
      mapping.debit = headers[i];
    }
    if (
      !mapping.credit &&
      (h.includes("credit") || h.includes("deposit") || h.includes("cr"))
    ) {
      mapping.credit = headers[i];
    }
  }
  return mapping;
}

/**
 * Convert parsed rows to WealthOS transaction objects using column mapping.
 */
export function mapToTransactions(rows, mapping, startId = 1000) {
  const transactions = [];
  let id = startId;

  for (const row of rows) {
    const rawDate = row[mapping.date] || "";
    const desc = row[mapping.description] || "Imported transaction";

    // Parse date (try DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY)
    let date = "";
    if (rawDate) {
      const d = parseDate(rawDate);
      if (d) date = d;
    }
    if (!date) continue;

    // Parse amount
    let amount = 0;
    if (mapping.amount && row[mapping.amount]) {
      amount = parseAmount(row[mapping.amount]);
    } else {
      const debit = mapping.debit ? parseAmount(row[mapping.debit]) : 0;
      const credit = mapping.credit ? parseAmount(row[mapping.credit]) : 0;
      if (credit > 0) amount = credit;
      else if (debit > 0) amount = -debit;
    }
    if (amount === 0) continue;

    transactions.push({
      id: id++,
      date,
      desc: desc.slice(0, 100),
      amount,
      type: amount > 0 ? "income" : "expense",
      category: amount > 0 ? "Income" : "Others",
      imported: true,
    });
  }

  return transactions;
}

function parseDate(s) {
  // Remove surrounding quotes
  s = s.replace(/^["']|["']$/g, "").trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // MM/DD/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m && parseInt(m[1]) <= 12) {
    return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  return "";
}

function parseAmount(s) {
  if (!s) return 0;
  // Remove currency symbols, commas, spaces
  const cleaned = String(s)
    .replace(/[₹$€£,\s]/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}
