/* ── SMS Transaction Parser ────────────────────────────────────────────────────
 *  Deterministic regex-based parser for Indian bank & UPI transactional SMS.
 *  Supports: HDFC, ICICI, SBI, Axis, Kotak, BOB, PNB, Yes Bank, IndusInd,
 *            GPay, PhonePe, Paytm, CRED, Amazon Pay, and generic formats.
 *
 *  Input  : raw multi-line text (user pastes from SMS app)
 *  Output : array of parsed transaction objects
 *
 *  Design : regex-first, zero network calls, fully offline.
 *           AI fallback is a separate layer (see SmartPaste component).
 * ──────────────────────────────────────────────────────────────────────────── */

// ── Noise filter — skip OTPs, promos, balance-only, non-transactional ───────
const NOISE_PATTERNS = [
  /\bOTP\b/i,
  /\bverification code\b/i,
  /\bone.time.password\b/i,
  /\bDO NOT SHARE\b/i,
  /\blogin.?code\b/i,
  /\bpromoti?on\b/i,
  /\boffer\b.*\bflat\b/i,
  /\bcashback.*\bwon\b/i,
  /\bEMI\s+available\b/i,
  /\bupgrade.*card\b/i,
  /\bpre.?approved\b/i,
  /\bKYC\b.*\bupdate\b/i,
  /\bstatement.*ready\b/i,
  /\bminimum amount due\b/i,
  /\bpayment.*due\b/i,
  /\bDear Customer.*welcome\b/i,
];

function isNoise(msg) {
  return NOISE_PATTERNS.some((re) => re.test(msg));
}

// ── Amount extraction ───────────────────────────────────────────────────────
// Matches: Rs. 1,500.00 | Rs 500 | INR 1500.00 | ₹1,500 | Rs.1500
const AMOUNT_RE = /(?:Rs\.?\s*|INR\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/i;

function parseAmount(str) {
  const m = str.match(AMOUNT_RE);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

// ── Date extraction ─────────────────────────────────────────────────────────
const DATE_PATTERNS = [
  // 2026-04-15 or 2026/04/15
  /(\d{4})[/-](\d{2})[/-](\d{2})/,
  // 15-04-2026 or 15/04/2026 or 15-04-26
  /(\d{2})[/-](\d{2})[/-](\d{2,4})/,
  // 15-Apr-26 or 15 Apr 2026
  /(\d{1,2})[- ]?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[- ]?(\d{2,4})/i,
];

const MONTH_MAP = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

function parseDate(str) {
  // Pattern 1: YYYY-MM-DD
  let m = str.match(DATE_PATTERNS[0]);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Pattern 3: DD-Mon-YY (check before DD-MM-YY to avoid conflict)
  m = str.match(DATE_PATTERNS[2]);
  if (m) {
    const day = m[1].padStart(2, "0");
    const mon = MONTH_MAP[m[2].slice(0, 3).toLowerCase()];
    let yr = m[3];
    if (yr.length === 2) yr = "20" + yr;
    return `${yr}-${mon}-${day}`;
  }

  // Pattern 2: DD-MM-YYYY or DD-MM-YY
  m = str.match(DATE_PATTERNS[1]);
  if (m) {
    let [, a, b, c] = m;
    if (c.length === 2) c = "20" + c;
    // Heuristic: if first number > 12, it's DD-MM-YYYY, else ambiguous (assume DD-MM)
    if (Number(a) > 12) return `${c}-${b}-${a}`;
    if (Number(b) > 12) return `${c}-${a}-${b}`;
    // Default: DD-MM-YYYY
    return `${c}-${b}-${a}`;
  }

  // Fallback: today
  return new Date().toISOString().slice(0, 10);
}

// ── Direction detection (debit vs credit) ───────────────────────────────────
const DEBIT_KEYWORDS = [
  /\bdebited\b/i,
  /\bdebit\b/i,
  /\bpaid\b/i,
  /\bsent\b/i,
  /\bpurchase\b/i,
  /\bspent\b/i,
  /\bcharged\b/i,
  /\bwithdraw/i,
  /\btransferred\b.*\bto\b/i,
  /\btowards\b/i,
  /\bbought\b/i,
];
const CREDIT_KEYWORDS = [
  /\bcredited\b/i,
  /\bcredit\b/i,
  /\breceived\b/i,
  /\brefund/i,
  /\bcashback\b/i,
  /\btransferred\b.*\bfrom\b/i,
  /\breversal\b/i,
  /\bsalary\b/i,
];

function detectDirection(msg) {
  const debitScore = DEBIT_KEYWORDS.reduce(
    (s, re) => s + (re.test(msg) ? 1 : 0),
    0,
  );
  const creditScore = CREDIT_KEYWORDS.reduce(
    (s, re) => s + (re.test(msg) ? 1 : 0),
    0,
  );
  if (debitScore > creditScore) return "debit";
  if (creditScore > debitScore) return "credit";
  return "debit"; // default assumption
}

// ── UPI Ref extraction ──────────────────────────────────────────────────────
const REF_PATTERNS = [
  /(?:UPI\s*Ref\s*(?:no\.?\s*)?|Ref\s*(?:No\.?\s*)?:?\s*)(\d{12,})/i,
  /(?:Ref|Txn)\s*(?:ID|No)?[\s:]*(\d{9,})/i,
];

function parseRefId(msg) {
  for (const re of REF_PATTERNS) {
    const m = msg.match(re);
    if (m) return m[1];
  }
  return null;
}

// ── Account last-4 extraction ───────────────────────────────────────────────
function parseAccount(msg) {
  // XX0000, XX000, x1234, A/c XX0000
  const m =
    msg.match(/A\/c\s*(?:no\.?\s*)?[Xx*]+(\d{3,6})/i) ||
    msg.match(/(?:account|acct|a\/c)\s*[Xx*]+(\d{3,6})/i) ||
    msg.match(/[Xx*]+(\d{4,6})\s+(?:is\s+)?(?:debited|credited)/i);
  return m ? m[1] : null;
}

// ── Bank / UPI app detection ────────────────────────────────────────────────
const BANK_PATTERNS = [
  [/\bHDFC\b/i, "HDFC Bank"],
  [/\bICICI\b/i, "ICICI Bank"],
  [/\bSBI\b|State Bank/i, "SBI"],
  [/\bAxis\s*Bank\b/i, "Axis Bank"],
  [/\bKotak\b/i, "Kotak Bank"],
  [/\bBOB\b|Bank of Baroda/i, "Bank of Baroda"],
  [/\bPNB\b|Punjab National/i, "PNB"],
  [/\bYes\s*Bank\b/i, "Yes Bank"],
  [/\bIndusInd\b/i, "IndusInd Bank"],
  [/\bIDBI\b/i, "IDBI Bank"],
  [/\bFederal\s*Bank\b/i, "Federal Bank"],
  [/\bCanara\b/i, "Canara Bank"],
  [/\bUnion\s*Bank\b/i, "Union Bank"],
];

const APP_PATTERNS = [
  [/\bGPay\b|Google\s*Pay/i, "GPay"],
  [/\bPhonePe\b/i, "PhonePe"],
  [/\bPaytm\b/i, "Paytm"],
  [/\bCRED\b/, "CRED"],
  [/\bAmazon\s*Pay\b/i, "Amazon Pay"],
  [/\bSlice\b/i, "Slice"],
  [/\bJupiter\b/i, "Jupiter"],
  [/\bFi\b(?:\s|$)/, "Fi Money"],
];

function detectSource(msg) {
  for (const [re, name] of APP_PATTERNS) {
    if (re.test(msg)) return { type: "app", name };
  }
  for (const [re, name] of BANK_PATTERNS) {
    if (re.test(msg)) return { type: "bank", name };
  }
  return { type: "unknown", name: "Unknown" };
}

// ── Merchant extraction ─────────────────────────────────────────────────────
// This is the trickiest part — merchant names are unstructured.
const MERCHANT_PATTERNS = [
  // "UPI/MerchantName/..." (ICICI, Axis style)
  /UPI\/([^/]+)\//i,
  // "Paid Rs. X to MerchantName" (GPay / PhonePe style)
  /Paid\s+(?:Rs\.?\s*[\d,]+\.?\d*\s+)?to\s+([^\s][^.]*?)(?:\s+via\b|\s*\.\s*Ref|\s*$)/i,
  // "Sent Rs.X ... To PersonName" (HDFC UPI format)
  /Sent\s+Rs\.?\s*[\d,]+\.?\d*\s.*?To\s+([A-Z][A-Za-z ]+?)(?:\s+On\b|\s*$)/i,
  // "At ..STORE NAME" or "At STORE NAME" (HDFC credit card POS format)
  /\bAt\s+\.{0,3}\s*([A-Za-z][A-Za-z0-9 &'._-]+?)(?:\s+On\b|\s*$)/i,
  // "towards UPI/merchant@bank" — extract before the @
  /towards\s+UPI\/([^/@\s]+)/i,
  // "Info: UPI/MerchantName" (ICICI)
  /Info:\s*UPI\/([^/]+)/i,
  // "Transf. to merchant@upi" or "transfer to Name"
  /Transf(?:er)?\.?\s+to\s+([^\s@]+)/i,
  // "at MerchantName" (generic POS)
  /\bat\s+([A-Z][A-Za-z0-9 &'.]+?)(?:\s+on\b|\s*$)/,
  // "to VPA merchantname@bank"
  /to\s+VPA\s+([^@\s]+)/i,
];

function extractMerchant(msg) {
  for (const re of MERCHANT_PATTERNS) {
    const m = msg.match(re);
    if (m) {
      let merchant = m[1].trim();
      // Clean up UPI IDs like "9800000111@axisbank" → use the number
      if (/^\d{10,}$/.test(merchant)) return null; // just a phone number
      // Remove trailing digits if it looks like a UPI ID suffix
      merchant = merchant.replace(/@\w+$/, "").trim();
      // Remove trailing underscores/dots (HDFC POS artifacts)
      merchant = merchant.replace(/[_.]+$/, "").trim();
      // Collapse multiple spaces
      merchant = merchant.replace(/\s{2,}/g, " ");
      // Strip honorific prefixes for person-to-person transfers
      merchant = merchant
        .replace(/^(?:Mr|Mrs|Ms|Dr|Shri|Smt)\.?\s+/i, "")
        .trim();
      // Title-case cleanup
      if (merchant.length > 2) {
        return merchant.charAt(0).toUpperCase() + merchant.slice(1);
      }
      return merchant;
    }
  }
  return null;
}

// ── Segment raw text into individual messages ───────────────────────────────
// Users may paste multiple SMS separated by newlines, or a block with timestamps.
// Also detects new-message boundaries from SMS patterns ("Sent Rs.", "Spent Rs.", "Alert:").
const NEW_MSG_RE =
  /^(?:Sent\s+Rs|Spent\s+Rs|Alert[:\s]|Dear\s|Your\s+A\/c|A\/c\s+[Xx*]|Paid\s+Rs|Rs\.?\s*\d+.*debited|\d{4}[/-]\d{2}[/-]\d{2}|\d{1,2}[/-]\w{3}[/-]\d{2,4}|\[?\d{1,2}:\d{2})/i;

export function segmentMessages(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\n/);
  const messages = [];
  let current = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines — they are message separators
    if (!trimmed) {
      if (current.length) {
        messages.push(current.join(" "));
        current = [];
      }
      continue;
    }
    // If line starts with a recognizable SMS-start pattern, flush previous
    if (current.length && NEW_MSG_RE.test(trimmed)) {
      messages.push(current.join(" "));
      current = [];
    }
    current.push(trimmed);
  }
  if (current.length) messages.push(current.join(" "));

  return messages.filter((m) => m.length > 10); // skip trivially short fragments
}

// ── Main parser — parse a single SMS string into a structured transaction ───
export function parseSingleSMS(msg) {
  if (!msg || typeof msg !== "string") return null;
  if (isNoise(msg)) return null;

  const amount = parseAmount(msg);
  if (!amount || amount <= 0) return null; // not a transaction

  const direction = detectDirection(msg);
  const date = parseDate(msg);
  const refId = parseRefId(msg);
  const account = parseAccount(msg);
  const source = detectSource(msg);
  const merchant = extractMerchant(msg);

  return {
    amount,
    direction, // "debit" | "credit"
    date, // "YYYY-MM-DD"
    refId, // string | null
    account, // last 4-6 digits | null
    source, // { type, name }
    merchant, // string | null
    sourceText: msg,
  };
}

// ── Batch parser — parse raw pasted text into an array of transactions ──────
export function parseTransactionSMS(rawText) {
  const messages = segmentMessages(rawText);
  const results = [];
  const seenRefs = new Set();

  for (const msg of messages) {
    const parsed = parseSingleSMS(msg);
    if (!parsed) continue;

    // Deduplicate by ref ID within the same paste batch
    if (parsed.refId) {
      if (seenRefs.has(parsed.refId)) continue;
      seenRefs.add(parsed.refId);
    }

    results.push(parsed);
  }

  return results;
}

// ── Deduplicate against existing entries ─────────────────────────────────────
// Returns only transactions that don't already exist in the user's data.
export function dedupeAgainstExisting(parsed, existingExpenses) {
  // Build a set of existing fingerprints: amount|date from entries.
  // This is intentionally broad — the review sheet is the safety net.
  const existing = new Set();
  for (const exp of existingExpenses) {
    for (const entry of exp.entries || []) {
      existing.add(`${entry.amount}|${entry.date}`);
    }
  }

  return parsed.filter((txn) => !existing.has(`${txn.amount}|${txn.date}`));
}

// ── Mark duplicates (non-destructive — returns all items with isDuplicate flag) ──
export function markDuplicates(parsed, existingExpenses) {
  const existing = new Set();
  for (const exp of existingExpenses) {
    for (const entry of exp.entries || []) {
      existing.add(`${entry.amount}|${entry.date}`);
    }
  }
  return parsed.map((txn) => ({
    ...txn,
    isDuplicate: existing.has(`${txn.amount}|${txn.date}`),
  }));
}

// ── Merchant → Category mapping (heuristic) ────────────────────────────────
const CATEGORY_HINTS = [
  {
    re: /swiggy|zomato|food|dominos|pizza|biryani|restaurant|cafe|starbucks|chaayos|kitchen|dining|eat/i,
    category: "Food",
    sub: "Food Delivery",
  },
  {
    re: /uber|ola|rapido|auto|cab|metro|irctc|railway|redbus|bus|flight|makemytrip|goibibo|cleartrip/i,
    category: "Transport",
    sub: "Cab / Auto",
  },
  {
    re: /amazon|flipkart|myntra|ajio|meesho|nykaa|tata\s*cliq|shopping|mart/i,
    category: "Shopping",
    sub: "",
  },
  {
    re: /netflix|hotstar|prime\s*video|spotify|youtube|jio\s*cinema|zee5|sonyliv|gaana|apple\s*music/i,
    category: "Entertainment",
    sub: "OTT / Streaming",
  },
  {
    re: /pharmeasy|1mg|medplus|apollo|netmeds|hospital|clinic|doctor|lab|diagnostic/i,
    category: "Healthcare",
    sub: "Medicines",
  },
  {
    re: /airtel|jio|vi\b|vodafone|bsnl|recharge|broadband|wifi|internet/i,
    category: "Utilities",
    sub: "Mobile Recharge",
  },
  {
    re: /electricity|power|bescom|tata\s*power|adani\s*gas|gas|water/i,
    category: "Utilities",
    sub: "Electricity",
  },
  {
    re: /rent|maintenance|society|apartment|housing/i,
    category: "Housing",
    sub: "Rent / EMI",
  },
  {
    re: /insurance|lic|star\s*health|hdfc\s*life|icici\s*pru/i,
    category: "Insurance",
    sub: "",
  },
  {
    re: /school|college|university|tuition|course|udemy|coursera/i,
    category: "Education",
    sub: "Fees / Tuition",
  },
  {
    re: /salon|spa|grooming|barber|parlour|parlor/i,
    category: "Personal Care",
    sub: "Salon / Grooming",
  },
  {
    re: /petrol|diesel|fuel|hp\b|indian\s*oil|bharat\s*petroleum|shell/i,
    category: "Transport",
    sub: "Fuel",
  },
  {
    re: /grocery|bigbasket|blinkit|zepto|instamart|dmart|reliance\s*fresh/i,
    category: "Food",
    sub: "Groceries",
  },
];

export function guessCategory(merchant) {
  if (!merchant) return { category: "Others", sub: "" };
  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(merchant)) {
      return { category: hint.category, sub: hint.sub };
    }
  }
  return { category: "Others", sub: "" };
}
