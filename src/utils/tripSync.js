import { EXPENSE_CATEGORIES } from "./finance.js";

export const DEFAULT_SUPABASE_URL = "https://eqciatcascbstrohqbnp.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxY2lhdGNhc2Nic3Ryb2hxYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzE2NjYsImV4cCI6MjEwNDcwNzY2Nn0.MMUXd8hM9oINQAuGlv3A02hcD0bHIjUjwiTtG1u3q3E";

/**
 * Maps external categories/booking types from Trip-Architecture or travel APIs
 * into standard WealthOS expense categories.
 */
export function mapToWealthOSCategory(rawCategory) {
  if (!rawCategory || typeof rawCategory !== "string") {
    return "Others";
  }

  const str = rawCategory.trim().toLowerCase();

  // If already directly matching a known category (case-insensitive)
  const exact = EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === str,
  );
  if (exact) return exact;

  // Transit & Transport
  if (
    /flight|plane|airline|indigo|airways|airport|train|rail|metro|bus|cab|taxi|uber|ola|transport|transit|rental|fuel|petrol|diesel/i.test(
      str,
    )
  ) {
    return "Transport";
  }

  // Stay & Housing
  if (
    /hotel|resort|airbnb|hostel|stay|accommodation|room|villa|homestay|lodge|motel|cruise/i.test(
      str,
    )
  ) {
    return "Housing";
  }

  // Food & Dining
  if (
    /food|dinner|lunch|breakfast|cafe|restaurant|dining|bar|cocktail|drinks|groceries|swiggy|zomato|snack|bakery|pub|malnad/i.test(
      str,
    )
  ) {
    return "Food";
  }

  // Entertainment & Activities
  if (
    /ticket|activity|activities|tour|sightseeing|scuba|trek|adventure|safari|entry|museum|entertainment|show|event|park|club|spa|guide/i.test(
      str,
    )
  ) {
    return "Entertainment";
  }

  // Shopping
  if (/shopping|souvenir|market|mall|clothes|bazaar|gift|coffee/i.test(str)) {
    return "Shopping";
  }

  return "Others";
}

/**
 * Maps WealthOS category to Trip Architect standard category
 */
export function mapWealthOSToTripArchitectCategory(category) {
  switch (category) {
    case "Transport":
      return "transport";
    case "Housing":
      return "stays";
    case "Food":
      return "food";
    case "Entertainment":
      return "tours";
    case "Shopping":
      return "shopping";
    default:
      return "misc";
  }
}

/**
 * Parses currency amount from number or Indian currency formatted string (e.g. "₹3,500", "₹1,200/day")
 */
export function parseCurrencyAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.max(0, val);
  if (typeof val === "string") {
    const match = val.match(/(\d[\d,]*)/);
    if (!match) return 0;
    const clean = match[1].replace(/,/g, "");
    const num = Number(clean);
    return isNaN(num) ? 0 : Math.max(0, num);
  }
  return 0;
}

/**
 * Generates unique ID for trip item
 */
export function genTripItemId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Validates and normalizes raw JSON or object from Trip Architecture
 */
export function normalizeTripPayload(input) {
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("Invalid trip payload: JSON parsing failed.");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid trip payload: expected object.");
  }

  // Handle wrapped payloads e.g. { trip: { ... } }
  const data = parsed.trip && typeof parsed.trip === "object" ? parsed.trip : parsed;

  const rawName =
    data.name || data.destination || data.title || data.tripName || "";
  const name = String(rawName).trim();
  if (!name) {
    throw new Error("Trip must have a name or destination.");
  }

  const startDate = String(data.startDate || data.start || data.dates?.start || "").trim();
  const endDate = String(data.endDate || data.end || data.dates?.end || "").trim();
  const budget = Math.max(0, parseCurrencyAmount(data.budget ?? data.targetBudget ?? 0));
  const itineraryUrl = String(
    data.itineraryUrl || data.url || data.link || data.tripUrl || "",
  ).trim();

  // Extract raw items
  const rawItems = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.expenses)
      ? data.expenses
      : Array.isArray(data.bookings)
        ? data.bookings
        : Array.isArray(data.lineItems)
          ? data.lineItems
          : [];

  const items = rawItems.map((item) => {
    const itemName = String(
      item.name || item.title || item.description || "Trip expense",
    ).trim();
    const amount = Math.max(
      0,
      parseCurrencyAmount(item.amount ?? item.cost ?? item.price ?? 0),
    );
    const category = mapToWealthOSCategory(
      item.category || item.type || item.group || "",
    );
    const date = String(item.date || startDate || "").trim();

    return {
      id: item.id || genTripItemId(),
      name: itemName,
      amount,
      category,
      date,
      ...(item.notes ? { notes: String(item.notes) } : {}),
    };
  });

  const totalAmount = items.reduce((s, i) => s + (i.amount || 0), 0);

  return {
    name,
    startDate,
    endDate,
    budget,
    itineraryUrl,
    items,
    amount: totalAmount,
    category: "Others",
    expenseType: "trip",
  };
}

/**
 * Converts a Supabase trip record (data jsonb) to a WealthOS trip structure.
 * Handles three budget styles from Trip Architect:
 * - Items style: budget.items = [{ id, item, total, category, date }]
 * - Breakdown style: budget.breakdown = [{ item, cost }]
 * - Categories style: budget.categories = [{ name, amount, icon }]
 */

const MONTH_MAP = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

/**
 * Parses freeform and text date ranges into standard ISO YYYY-MM-DD
 */
export function parseDateRangeString(raw) {
  if (!raw || typeof raw !== "string") return { startDate: "", endDate: "" };
  const str = raw.trim();

  // Pattern 1: ISO dates (e.g. "2026-10-02" or "2026-10-02 to 2026-10-04")
  const isoMatches = str.match(/(\d{4}-\d{2}-\d{2})/g);
  if (isoMatches && isoMatches.length > 0) {
    return {
      startDate: isoMatches[0],
      endDate: isoMatches[1] || isoMatches[0],
    };
  }

  // Pattern 2: "Oct 2 – 4, 2026" or "Sep 12 – 14, 2026"
  const m1 = str.match(/([A-Za-z]+)\s+(\d{1,2})(?:\s*[–-]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}))?,?\s+(\d{4})/);
  if (m1) {
    const startMonthStr = m1[1].toLowerCase().slice(0, 3);
    const startMonth = MONTH_MAP[startMonthStr] || "01";
    const startDay = m1[2].padStart(2, "0");
    const endMonthStr = (m1[3] ? m1[3].toLowerCase().slice(0, 3) : startMonthStr);
    const endMonth = MONTH_MAP[endMonthStr] || startMonth;
    const endDay = (m1[4] || m1[2]).padStart(2, "0");
    const year = m1[5];

    return {
      startDate: `${year}-${startMonth}-${startDay}`,
      endDate: `${year}-${endMonth}-${endDay}`,
    };
  }

  return { startDate: str, endDate: str };
}

/**
 * Resolves multi-pax liability and assigns payer attribution for Abhav (p1) & Aanya (p2)
 */
export function resolvePayerAndPaxShare(item, options = {}) {
  const mode = options.mode || "couple_share"; // "couple_share" | "full"
  const couplePax = options.couplePax || 2;
  const p1Name = (options.p1Name || "Abhav").toLowerCase();
  const p2Name = (options.p2Name || "Aanya").toLowerCase();

  const rawCost = parseCurrencyAmount(item.total ?? item.cost ?? item.amount);
  const itemPax = Math.max(1, parseInt(item.pax, 10) || options.tripPax || 2);
  const pp = item.pp || (itemPax > 0 ? Math.round(rawCost / itemPax) : rawCost);

  // Mode A: Couple Share Only
  let amount = rawCost;
  if (mode === "couple_share" && itemPax > couplePax) {
    amount = pp * couplePax;
  }

  // Payer Detection
  const rawPayer = String(item.paidBy || item.payer || "Shared").trim();
  const payerLower = rawPayer.toLowerCase();

  let paidBy = "shared";
  if (payerLower === p1Name || /me|p1|abhav/i.test(payerLower)) {
    paidBy = "p1";
  } else if (payerLower === p2Name || /partner|p2|aanya/i.test(payerLower)) {
    paidBy = "p2";
  } else if (/shared|both|couple|all/i.test(payerLower)) {
    paidBy = "shared";
  } else {
    paidBy = "external"; // Co-traveler paid
  }

  let noteParts = [];
  if (item.details || item.notes || item.note) {
    noteParts.push(item.details || item.notes || item.note);
  }
  if (itemPax > couplePax) {
    noteParts.push(`${itemPax} Pax Split • Original: ₹${rawCost.toLocaleString("en-IN")}`);
    if (paidBy === "external") {
      noteParts.push(`Paid by ${rawPayer}`);
    } else {
      noteParts.push(`Fronted by ${rawPayer}`);
    }
  }

  return {
    amount,
    paidBy,
    notes: noteParts.join(" • "),
    originalCost: rawCost,
    itemPax,
    pp,
  };
}

export function parseSupabaseTripToWealthOS(supabaseRow, options = { mode: "couple_share", couplePax: 2 }) {
  if (!supabaseRow) return null;
  const data = supabaseRow.data || supabaseRow;
  const supabaseTripId = String(supabaseRow.id || data.id || "");

  const name = String(data.title || data.name || data.destination || "Trip").trim();
  const parsedStart = parseDateRangeString(
    data.startDate || data.dates || data.start || "",
  );
  const parsedEnd = data.endDate ? parseDateRangeString(data.endDate) : null;
  const startDate = parsedStart.startDate || "";
  const endDate = parsedEnd ? (parsedEnd.startDate || parsedEnd.endDate) : (parsedStart.endDate || "");
  const itineraryUrl = String(data.url || data.itineraryUrl || "").trim();

  const rawBudget = data.budget || {};
  const tripPax = rawBudget.paxCount || (Array.isArray(data.travelersList) ? data.travelersList.length : 2);
  const budget = parseCurrencyAmount(
    rawBudget.total ?? rawBudget.totalEstimate ?? rawBudget.target ?? 0,
  );

  let rawItems = [];
  if (Array.isArray(rawBudget.items) && rawBudget.items.length > 0) {
    rawItems = rawBudget.items.map((b) => {
      const share = resolvePayerAndPaxShare(b, { ...options, tripPax });
      return {
        id: b.id || genTripItemId(),
        name: b.item || b.name || "Expense",
        amount: share.amount,
        category: mapToWealthOSCategory(b.category || b.item || ""),
        date: b.date || startDate || "",
        paidBy: share.paidBy,
        notes: share.notes,
      };
    });
  } else if (Array.isArray(rawBudget.breakdown) && rawBudget.breakdown.length > 0) {
    rawItems = rawBudget.breakdown.map((b) => {
      const share = resolvePayerAndPaxShare(b, { ...options, tripPax });
      return {
        id: genTripItemId(),
        name: b.item || "Expense",
        amount: share.amount,
        category: mapToWealthOSCategory(b.category || b.item || ""),
        date: b.date || startDate || "",
        paidBy: share.paidBy,
        notes: share.notes,
      };
    });
  } else if (Array.isArray(rawBudget.categories) && rawBudget.categories.length > 0) {
    rawItems = rawBudget.categories.map((b) => {
      const share = resolvePayerAndPaxShare(b, { ...options, tripPax });
      return {
        id: genTripItemId(),
        name: b.name || b.title || "Category",
        amount: share.amount,
        category: mapToWealthOSCategory(b.name || b.icon || ""),
        date: startDate || "",
        paidBy: share.paidBy,
        notes: share.notes,
      };
    });
  }

  const totalAmount = rawItems.reduce((s, i) => s + (i.amount || 0), 0);

  return {
    supabaseTripId,
    name,
    startDate,
    endDate,
    budget,
    itineraryUrl,
    items: rawItems,
    amount: totalAmount,
    category: "Others",
    expenseType: "trip",
  };
}

/**
 * Builds the updated Supabase data object with budget items synced from WealthOS.
 * Preserves all other non-budget metadata (itinerary, checklist, packing, etc.).
 */
export function buildSupabaseBudgetDataFromWealthOS(wealthOSTrip, existingSupabaseData = {}) {
  const existing = { ...existingSupabaseData };
  const items = Array.isArray(wealthOSTrip?.items) ? wealthOSTrip.items : [];

  const supabaseBudgetItems = items.map((item) => ({
    id: item.id || genTripItemId(),
    item: item.name || "Expense",
    total: item.amount || 0,
    category: mapWealthOSToTripArchitectCategory(item.category),
    date: item.date || wealthOSTrip?.startDate || "",
    status: item.status || "confirmed",
    details: item.notes || "",
  }));

  const totalAmount = supabaseBudgetItems.reduce((s, i) => s + (i.total || 0), 0);

  const existingBudget = existing.budget || {};

  return {
    ...existing,
    id: existing.id || wealthOSTrip.supabaseTripId || wealthOSTrip.id,
    title: existing.title || wealthOSTrip.name,
    budget: {
      ...existingBudget,
      total: totalAmount,
      items: supabaseBudgetItems,
    },
  };
}

/**
 * Merges incoming items into an existing WealthOS trip
 */
export function mergeTripItems(existingTrip, incomingItems = [], options = { deduplicate: true }) {
  if (!existingTrip) return null;
  const existingItems = Array.isArray(existingTrip.items) ? [...existingTrip.items] : [];

  const seenFingerprints = new Set(
    existingItems.map(
      (i) => `${(i.name || "").toLowerCase().trim()}_${i.amount || 0}_${i.date || ""}`,
    ),
  );

  const itemsToAdd = [];
  for (const item of incomingItems) {
    const fp = `${(item.name || "").toLowerCase().trim()}_${item.amount || 0}_${item.date || ""}`;
    if (options.deduplicate && seenFingerprints.has(fp)) {
      continue;
    }
    seenFingerprints.add(fp);
    itemsToAdd.push({
      ...item,
      id: item.id || genTripItemId(),
      category: mapToWealthOSCategory(item.category),
    });
  }

  const mergedItems = [...existingItems, ...itemsToAdd];
  const newAmount = mergedItems.reduce((s, i) => s + (i.amount || 0), 0);

  return {
    ...existingTrip,
    items: mergedItems,
    amount: newAmount,
  };
}

/**
 * Formats a WealthOS trip into Trip Architecture export schema
 */
export function exportTripToArchitectureFormat(trip) {
  if (!trip) return null;
  const items = Array.isArray(trip.items) ? trip.items : [];
  const totalSpend =
    trip.amount || items.reduce((s, i) => s + (i.amount || 0), 0);

  return {
    version: "wealthos-trip-v1",
    exportedAt: new Date().toISOString(),
    trip: {
      id: trip.id,
      name: trip.name,
      startDate: trip.startDate || "",
      endDate: trip.endDate || "",
      budget: trip.budget || 0,
      totalSpend,
      itineraryUrl: trip.itineraryUrl || "",
      expenses: items.map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        category: i.category,
        date: i.date || "",
        ...(i.notes ? { notes: i.notes } : {}),
      })),
    },
  };
}

/**
 * Supabase Cloud Live Sync API Client
 */
export async function fetchSupabaseTrips(
  supabaseUrl = DEFAULT_SUPABASE_URL,
  anonKey = DEFAULT_SUPABASE_ANON_KEY,
) {
  const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/trips?select=*`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch trips from Supabase: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Syncs a WealthOS trip to Supabase Cloud
 */
export async function syncWealthOSTripToSupabase(
  wealthOSTrip,
  supabaseTripId,
  supabaseUrl = DEFAULT_SUPABASE_URL,
  anonKey = DEFAULT_SUPABASE_ANON_KEY,
) {
  if (!supabaseTripId) {
    throw new Error("Missing Supabase Trip ID for sync.");
  }

  // 1. Fetch current trip data to preserve non-budget structures
  const getUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/trips?id=eq.${encodeURIComponent(
    supabaseTripId,
  )}&select=*`;
  const getRes = await fetch(getUrl, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
  });

  let existingData = {};
  if (getRes.ok) {
    const rows = await getRes.json();
    if (rows && rows.length > 0) {
      existingData = rows[0].data || {};
    }
  }

  // 2. Build updated data
  const updatedData = buildSupabaseBudgetDataFromWealthOS(wealthOSTrip, existingData);

  // 3. Patch Supabase row
  const patchUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/trips?id=eq.${encodeURIComponent(
    supabaseTripId,
  )}`;
  const patchRes = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      data: updatedData,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!patchRes.ok) {
    throw new Error(`Failed to update Supabase trip: ${patchRes.status} ${patchRes.statusText}`);
  }

  return updatedData;
}

/**
 * Automatically pings Supabase Cloud if more than 48 hours have elapsed since the last ping.
 * Prevents Supabase project from auto-pausing on the free tier.
 */
export async function pingSupabaseKeepAlive(
  supabaseUrl = DEFAULT_SUPABASE_URL,
  anonKey = DEFAULT_SUPABASE_ANON_KEY,
) {
  if (typeof window === "undefined" || !window.localStorage) return;

  const PING_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48 hours
  const STORAGE_KEY = "wealthos_supabase_last_keepalive";
  const lastPing = Number(localStorage.getItem(STORAGE_KEY) || 0);
  const now = Date.now();

  if (now - lastPing < PING_INTERVAL_MS) {
    return; // Already pinged recently
  }

  try {
    const url = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/trips?select=id&limit=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (res.ok) {
      localStorage.setItem(STORAGE_KEY, String(now));
    }
  } catch {
    // Fail silently in background
  }
}

export const DEFAULT_LOCALHOST_TRIP_URL = "http://localhost:5174";

/**
 * Localhost Dev Trip Sync API Client (Port 5174)
 * Allows 100% isolated local end-to-end testing without touching Supabase PROD data.
 */
export async function fetchLocalhostTrips(baseUrl = DEFAULT_LOCALHOST_TRIP_URL) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/trips`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to connect to local Trip Architect at ${baseUrl}: ${res.status} ${res.statusText}`,
    );
  }

  return await res.json();
}

/**
 * Syncs a WealthOS trip directly to Localhost Trip Architect (Port 5174)
 */
export async function syncWealthOSTripToLocalhost(
  wealthOSTrip,
  tripId,
  baseUrl = DEFAULT_LOCALHOST_TRIP_URL,
) {
  if (!tripId) {
    throw new Error("Missing Trip ID for local sync.");
  }

  // 1. Fetch current local trip
  const getUrl = `${baseUrl.replace(/\/$/, "")}/api/trips/${encodeURIComponent(tripId)}`;
  let existingData = {};
  try {
    const getRes = await fetch(getUrl);
    if (getRes.ok) {
      const row = await getRes.json();
      existingData = row.data || row || {};
    }
  } catch {
    /* fallback to empty */
  }

  // 2. Build updated data
  const updatedData = buildSupabaseBudgetDataFromWealthOS(wealthOSTrip, existingData);

  // 3. Post to local endpoint
  const postRes = await fetch(
    `${baseUrl.replace(/\/$/, "")}/api/trips/${encodeURIComponent(tripId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tripId, data: updatedData }),
    },
  );

  if (!postRes.ok) {
    throw new Error(`Failed to save to local Trip Architect: ${postRes.status}`);
  }

  return await postRes.json();
}
