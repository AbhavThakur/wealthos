// ── Smart Multi-Bank Statement Ingestion Engine & Deduplication ─────────────
// Supports HDFC, ICICI, SBI, Axis, Kotak, Zerodha, Groww statements


/**
 * Intelligent categorization dictionary for Indian merchant narrations
 */
const CATEGORY_RULES = [
  {
    category: "Food & Dining",
    keywords: ["swiggy", "zomato", "starbucks", "mcdonald", "domino", "kfc", "burger king", "chai point", "third wave", "blue tokai", "subway", "pizza hut", "dunkin", "haldiram"],
  },
  {
    category: "Groceries",
    keywords: ["blinkit", "zepto", "instamart", "bigbasket", "bbdaily", "nature basket", "dmart", "spencers", "reliance fresh", "milkbasket", "country delight"],
  },
  {
    category: "Transport",
    keywords: ["uber", "ola", "rapido", "shell", "fuel", "petrol", "indian oil", "bharat petro", "hp cl", "fastag", "metro", "irctc", "indigo", "air india", "vistara", "makemytrip"],
  },
  {
    category: "Shopping",
    keywords: ["amazon", "flipkart", "myntra", "zara", "h&m", "nykaa", "ajio", "tata cliq", "uniqlo", "decathlon", "ikea", "croma", "reliance digital", "apple store"],
  },
  {
    category: "Entertainment",
    keywords: ["netflix", "spotify", "prime video", "hotstar", "disney", "bookmyshow", "pvr", "inox", "youtube", "sony liv", "zee5", "audible", "steam", "playstation"],
  },
  {
    category: "Health & Medical",
    keywords: ["apollo", "1mg", "practo", "netmeds", "pharmeasy", "medplus", "cult.fit", "cultfit", "curefit", "dr lal", "metropolis", "max healthcare", "fortis"],
  },
  {
    category: "Bills & Utilities",
    keywords: ["bescom", "tata power", "adani electricity", "airtel", "jio", "act fibernet", "vodafone", "vi prepaid", "mahanagar gas", "indraprastha gas", "electricity"],
  },
  {
    category: "EMI",
    keywords: ["emi", "home loan", "housing loan", "car loan", "auto loan", "bajaj finserv", "bajaj finance", "hdfc ltd", "icici hfc", "cred club", "credit card payment"],
  },
  {
    category: "Investment",
    keywords: ["zerodha", "groww", "indmoney", "kuvera", "mf central", "cams", "kfintech", "coin", "upstox", "angel one", "smallcase", "uti mf", "hdfc mf", "sbi mf", "ppfas"],
  },
];

/**
 * Predicts category from narration
 */
export function predictStatementCategory(desc = "", amount = 0) {
  const s = desc.toLowerCase();

  if (amount > 0 && (s.includes("salary") || s.includes("payroll") || s.includes("neft cr") || s.includes("ach cr") || s.includes("bonus"))) {
    return "Income";
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => s.includes(k))) {
      return rule.category;
    }
  }

  return amount > 0 ? "Income" : "Others";
}

/**
 * Parse date from common bank formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD MMM YYYY)
 */
export function normalizeStatementDate(dateStr) {
  if (!dateStr) return "";
  const s = String(dateStr).replace(/^["']|["']$/g, "").trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // DD-MMM-YYYY or DD MMM YYYY (e.g. 15 Aug 2026, 15-AUG-2026)
  const monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  m = s.match(/^(\d{1,2})[\s\-/]([a-zA-Z]{3})[\s\-/](\d{4})$/);
  if (m) {
    const mon = monthMap[m[2].toLowerCase()];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
  }

  return "";
}

/**
 * Parse numeric amount safely from Indian statements
 */
export function parseStatementAmount(val) {
  if (!val) return 0;
  const clean = String(val).replace(/[₹$,\s]/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse raw Bank statement CSV or TSV text
 */
export function parseBankStatement(rawText) {
  if (!rawText || typeof rawText !== "string") return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect delimiter
  const delim = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";

  let headerIndex = -1;
  let headers = [];

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const row = splitStatementLine(lines[i], delim).map((h) => h.toLowerCase().trim());
    if (
      (row.some((h) => h.includes("date")) && (row.some((h) => h.includes("narration") || h.includes("desc") || h.includes("particular") || h.includes("remark"))))
    ) {
      headerIndex = i;
      headers = row;
      break;
    }
  }

  if (headerIndex === -1) return [];

  const dateCol = headers.findIndex((h) => h.includes("date") || h.includes("txn date") || h.includes("value date"));
  const descCol = headers.findIndex((h) => h.includes("narration") || h.includes("desc") || h.includes("particular") || h.includes("remark"));
  const debitCol = headers.findIndex((h) => h.includes("debit") || h.includes("dr") || h.includes("withdrawal"));
  const creditCol = headers.findIndex((h) => h.includes("credit") || h.includes("cr") || h.includes("deposit"));
  const amountCol = headers.findIndex((h) => h === "amount" || h === "transaction amount");

  const transactions = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = splitStatementLine(lines[i], delim);
    if (cols.length < 2) continue;

    const rawDate = dateCol >= 0 ? cols[dateCol] : "";
    const date = normalizeStatementDate(rawDate);
    if (!date) continue;

    const desc = descCol >= 0 ? cols[descCol]?.trim() : "Transaction";
    if (!desc || desc.toLowerCase().includes("opening balance") || desc.toLowerCase().includes("closing balance")) continue;

    let amount = 0;
    if (amountCol >= 0 && cols[amountCol]) {
      amount = parseStatementAmount(cols[amountCol]);
    } else {
      const debit = debitCol >= 0 ? parseStatementAmount(cols[debitCol]) : 0;
      const credit = creditCol >= 0 ? parseStatementAmount(cols[creditCol]) : 0;
      if (credit > 0) amount = credit;
      else if (debit > 0) amount = -debit;
    }

    if (amount === 0) continue;

    const category = predictStatementCategory(desc, amount);

    transactions.push({
      date,
      desc: desc.slice(0, 120),
      amount,
      type: amount > 0 ? "income" : "expense",
      category,
      imported: true,
      selected: true,
    });
  }

  return transactions;
}

function splitStatementLine(line, delim = ",") {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delim && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Intelligent Duplicate Detection:
 * Flags items that match existing transactions/expenses within +/- 2 days with identical amount.
 */
export function flagDuplicateTransactions(parsedTxns = [], existingTxns = [], existingExpenses = []) {
  const allExisting = [
    ...(existingTxns || []).map((t) => ({ date: t.date, amount: Math.abs(t.amount || 0), desc: t.desc || "" })),
    ...(existingExpenses || []).flatMap((e) =>
      (e.entries || []).map((entry) => ({ date: entry.date, amount: Math.abs(entry.amount || 0), desc: e.name || "" }))
    ),
  ];

  return parsedTxns.map((candidate) => {
    const candAmt = Math.abs(candidate.amount);
    const candDateMs = new Date(candidate.date).getTime();

    const matchedDup = allExisting.find((ex) => {
      if (Math.abs(ex.amount - candAmt) > 1) return false;
      const exDateMs = new Date(ex.date).getTime();
      const dayDiff = Math.abs(candDateMs - exDateMs) / (1000 * 60 * 60 * 24);
      return dayDiff <= 2;
    });

    if (matchedDup) {
      return {
        ...candidate,
        isDuplicate: true,
        selected: false, // unselect by default to protect against double entries
        duplicateReason: `Matches existing ₹${candAmt} on ${matchedDup.date}`,
      };
    }

    return {
      ...candidate,
      isDuplicate: false,
      selected: true,
    };
  });
}
