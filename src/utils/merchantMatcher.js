/* ── Merchant → Expense Card Matcher ──────────────────────────────────────────
 *  Matches parsed SMS transactions to existing expense cards.
 *  Uses a learned merchant→card memory (persisted in DataContext)
 *  plus fuzzy name matching as fallback.
 *
 *  The merchant map is stored in shared.merchantMap: { [merchantKey]: expenseId }
 *  This enables auto-routing: once "Swiggy" → "Food" card is confirmed once,
 *  future Swiggy messages pre-select the Food card.
 * ──────────────────────────────────────────────────────────────────────────── */

import { guessCategory } from "./smsParser";

// ── Normalize merchant name for matching ────────────────────────────────────
function normalizeKey(str) {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── Levenshtein distance (bounded — bails early if > maxDist) ───────────────
function levenshtein(a, b, maxDist = 5) {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

// ── Score a transaction against an expense card ─────────────────────────────
function scoreMatch(txn, expense, merchantMap) {
  const merchant = normalizeKey(txn.merchant);
  const expName = normalizeKey(expense.name);
  if (!merchant || !expName) return 0;

  let score = 0;

  // 1. Exact learned mapping (highest priority)
  if (merchantMap && merchantMap[merchant] === expense.id) {
    score += 100;
  }

  // 2. Name contains merchant or vice versa
  if (expName.includes(merchant) || merchant.includes(expName)) {
    score += 60;
  }

  // 3. Category match (from guessCategory)
  // "Others" is the fallback for unknown merchants — matching two unknowns is not a signal.
  const guessed = guessCategory(txn.merchant);
  if (guessed.category === expense.category && guessed.category !== "Others") {
    score += 30;
  }
  if (guessed.sub && guessed.sub === expense.subCategory) {
    score += 15;
  }

  // 4. Fuzzy name similarity (penalized by distance)
  const dist = levenshtein(merchant, expName);
  if (dist <= 3) {
    score += (4 - dist) * 10; // 40 for exact, 30 for 1 edit, etc.
  }

  // 5. Entry history — if this card already has entries with similar notes
  const entries = expense.entries || [];
  for (const e of entries) {
    const noteKey = normalizeKey(e.note);
    if (noteKey && (noteKey.includes(merchant) || merchant.includes(noteKey))) {
      score += 20;
      break;
    }
  }

  return score;
}

// ── Match a single transaction to the best expense card ─────────────────────
// Returns { expense, score, isNew } — isNew=true if no good match found.
export function matchToExpenseCard(txn, expenses, merchantMap) {
  if (!expenses.length) {
    return { expense: null, score: 0, isNew: true };
  }

  // Only match against monthly and onetime (not trips)
  const candidates = expenses.filter(
    (e) => e.expenseType === "monthly" || e.expenseType === "onetime",
  );

  let bestExp = null;
  let bestScore = 0;

  for (const exp of candidates) {
    const s = scoreMatch(txn, exp, merchantMap);
    if (s > bestScore) {
      bestScore = s;
      bestExp = exp;
    }
  }

  // Threshold: if score < 25, suggest creating a new card
  if (bestScore < 25) {
    return { expense: null, score: 0, isNew: true };
  }

  return { expense: bestExp, score: bestScore, isNew: false };
}

// ── Match all transactions in batch ─────────────────────────────────────────
// Returns array of { txn, match: { expense, score, isNew }, suggestedCategory }
export function matchAllTransactions(transactions, expenses, merchantMap) {
  return transactions.map((txn) => {
    const match = matchToExpenseCard(txn, expenses, merchantMap);
    const suggestedCategory = guessCategory(txn.merchant);
    return { txn, match, suggestedCategory };
  });
}

// ── Build updated merchant map from confirmed assignments ───────────────────
// Called after user confirms assignments in the review sheet.
export function updateMerchantMap(existingMap, assignments) {
  const updated = { ...existingMap };
  for (const { merchant, expenseId } of assignments) {
    const key = normalizeKey(merchant);
    if (key && expenseId) {
      updated[key] = expenseId;
    }
  }
  return updated;
}
