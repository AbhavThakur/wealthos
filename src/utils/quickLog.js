/**
 * Quick-Log Text Parser for Natural Text / Chat / Shortcuts
 *
 * Supports fast shorthand syntax like:
 * - "450 Swiggy P1"
 * - "Petrol 2000 P2"
 * - "Dinner with team 3500 split"
 * - "Grocery 1800 P1 split 60:40"
 * - "₹850 Uber"
 * - "4.5k Flight Tickets"
 */

import { localDateISO } from "./date";

const CATEGORY_KEYWORDS = {
  "Food & Dining": [
    "swiggy", "zomato", "mcdonalds", "kfc", "starbucks", "dominos", "pizza",
    "burger", "coffee", "cafe", "dinner", "lunch", "breakfast", "restaurant",
    "bar", "pub", "brewery", "chaat", "sweet", "bakery"
  ],
  Groceries: [
    "blinkit", "zepto", "instamart", "bigbasket", "bbnow", "dmart", "spencer",
    "nature basket", "grocery", "groceries", "supermarket", "vegetables", "fruits",
    "milk", "dairy", "meat", "fish"
  ],
  Transport: [
    "uber", "ola", "rapido", "namma yatri", "petrol", "diesel", "fuel", "cng",
    "fastag", "toll", "metro", "auto", "cab", "parking", "shell", "hpcl", "bpcl", "ioc"
  ],
  Shopping: [
    "amazon", "flipkart", "myntra", "ajio", "zara", "h&m", "uniqlo", "nykaa",
    "meesho", "clothes", "shoes", "mall", "shopping"
  ],
  "Bills & Utilities": [
    "electricity", "bescom", "tneb", "cesc", "water", "gas", "cylinder", "wifi",
    "broadband", "airtel", "jio", "vi", "recharge", "maintenance", "maid"
  ],
  Entertainment: [
    "netflix", "spotify", "prime", "hotstar", "youtube", "bookmyshow", "pvr",
    "inox", "movie", "cinema", "game", "steam", "playstation"
  ],
  "Health & Medical": [
    "apollo", "pharmeasy", "1mg", "medplus", "practo", "doctor", "dentist",
    "hospital", "clinic", "medicine", "pharmacy", "lab", "blood test"
  ],
  Travel: [
    "makemytrip", "mmt", "goibibo", "easemytrip", "flight", "indigo", "air india",
    "irctc", "train", "hotel", "airbnb", "resort", "trip", "vacation"
  ],
};

/**
 * Parses numeric amount from shorthand text (supports 'k', 'L', '₹', 'Rs', commas)
 */
function extractAmount(str) {
  // Check for '4.5k' or '2k'
  const kMatch = str.match(/(?:₹|Rs\.?\s*)?(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return { amount: Math.round(parseFloat(kMatch[1]) * 1000), matchedStr: kMatch[0] };
  }

  // Check for '1.5L' or '2L'
  const lMatch = str.match(/(?:₹|Rs\.?\s*)?(\d+(?:\.\d+)?)\s*L\b/i);
  if (lMatch) {
    return { amount: Math.round(parseFloat(lMatch[1]) * 100000), matchedStr: lMatch[0] };
  }

  // Check standard numeric: ₹450, 450, 1,200.50
  const numMatches = [...str.matchAll(/(?:₹|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)/gi)];
  for (const m of numMatches) {
    const rawVal = m[1].replace(/,/g, "");
    const parsed = parseFloat(rawVal);
    // Ignore small isolated numbers like "p1", "p2", or day numbers unless clearly an amount
    if (!isNaN(parsed) && parsed > 0) {
      return { amount: parsed, matchedStr: m[0] };
    }
  }

  return { amount: null, matchedStr: "" };
}

/**
 * Auto-detects category from merchant/name keywords
 */
export function inferCategory(text) {
  const lower = (text || "").toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "General & Other";
}

/**
 * Parses a raw natural quick-log string into a structured transaction
 */
export function parseQuickLogText(rawText = "", defaultPerson = "p1", personNames = { p1: "P1", p2: "P2" }) {
  if (!rawText || typeof rawText !== "string") return null;

  let text = rawText.trim();
  if (!text) return null;

  // 1. Detect person tag (p1 / p2 / names)
  let person = defaultPerson;
  let personMatched = "";

  const p1Name = (personNames.p1 || "p1").toLowerCase();
  const p2Name = (personNames.p2 || "p2").toLowerCase();
  const lower = text.toLowerCase();

  if (/\bp2\b/i.test(lower) || (p2Name !== "p2" && lower.includes(p2Name))) {
    person = "p2";
    personMatched = "p2";
  } else if (/\bp1\b/i.test(lower) || (p1Name !== "p1" && lower.includes(p1Name))) {
    person = "p1";
    personMatched = "p1";
  }

  // 2. Detect split flags
  let isSplit = false;
  let splitMode = "50:50";
  let splitMatched = "";

  if (/\b(?:split\s*60:40|60:40\s*split)\b/i.test(text)) {
    isSplit = true;
    splitMode = "60:40";
    splitMatched = "60:40";
  } else if (/\b(?:split\s*40:60|40:60\s*split)\b/i.test(text)) {
    isSplit = true;
    splitMode = "40:60";
    splitMatched = "40:60";
  } else if (/\b(?:split\s*70:30|70:30\s*split)\b/i.test(text)) {
    isSplit = true;
    splitMode = "70:30";
    splitMatched = "70:30";
  } else if (/\b(?:split|half|shared|50:50)\b/i.test(text)) {
    isSplit = true;
    splitMode = "50:50";
    splitMatched = "split";
  }

  // 3. Extract Amount
  const { amount, matchedStr: amountMatched } = extractAmount(text);
  if (!amount) return null;

  // 4. Clean merchant / description name
  let cleanName = text;
  if (amountMatched) cleanName = cleanName.replace(amountMatched, " ");
  if (personMatched) cleanName = cleanName.replace(new RegExp(`\\b${personMatched}\\b`, "gi"), " ");
  if (splitMatched) cleanName = cleanName.replace(new RegExp(`\\b${splitMatched}\\b`, "gi"), " ");
  cleanName = cleanName
    .replace(/\b(?:split|paid|by|for|in|at)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If cleanName is empty or just punctuation, fallback to category name
  const category = inferCategory(text);
  if (!cleanName) {
    cleanName = category === "General & Other" ? "Quick Expense" : category;
  }

  return {
    id: `ql_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
    amount,
    category,
    person,
    paidBy: person,
    isSplit,
    splitMode,
    date: localDateISO(),
    source: "quick_log",
  };
}
