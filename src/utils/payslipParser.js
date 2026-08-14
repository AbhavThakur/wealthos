// Best-effort parser for pasted Indian payslip text — extracts common salary
// components so the Tax Planner can be pre-filled instead of typed by hand.
// Indian payslip layouts vary a lot, so this matches by label keyword + the
// trailing number on the same line, tolerating ₹/commas/decimals.

const FIELD_PATTERNS = [
  { key: "basicSalary", patterns: [/basic\s*(salary|pay)?/i] },
  { key: "hra", patterns: [/house\s*rent\s*allowance/i, /\bhra\b/i] },
  {
    key: "lta",
    patterns: [/leave\s*travel\s*(allowance|assistance)/i, /\blta\b/i],
  },
  { key: "specialAllowance", patterns: [/special\s*allowance/i] },
  {
    key: "communicationAllowance",
    patterns: [/communication\s*allowance/i, /telephone\s*allowance/i],
  },
  {
    key: "nps",
    patterns: [/national\s*pension\s*(scheme|system)/i, /\bnps\b/i],
  },
];

function toNumber(str) {
  const n = Number(String(str).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Returns a monthly ₹ figure per matched field, e.g. { basicSalary: 96545, hra: 38618 }.
// Fields not found in the text are simply omitted (caller keeps existing values).
export function parsePayslipText(text) {
  if (!text) return {};
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const amountMatch = line.match(/([\d][\d,]*\.?\d*)\s*$/);
    if (!amountMatch) continue;
    const amount = toNumber(amountMatch[1]);
    if (amount === null) continue;
    for (const { key, patterns } of FIELD_PATTERNS) {
      if (result[key] != null) continue; // keep first match per field
      if (patterns.some((re) => re.test(line))) {
        result[key] = amount;
        break;
      }
    }
  }
  return result;
}
