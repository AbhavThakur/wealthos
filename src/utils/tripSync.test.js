import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mapToWealthOSCategory,
  mapWealthOSToTripArchitectCategory,
  parseCurrencyAmount,
  normalizeTripPayload,
  mergeTripItems,
  exportTripToArchitectureFormat,
  parseSupabaseTripToWealthOS,
  buildSupabaseBudgetDataFromWealthOS,
  fetchSupabaseTrips,
  pingSupabaseKeepAlive,
  parseDateRangeString,
  resolvePayerAndPaxShare,
  syncWealthOSTripToSupabase,
} from "./tripSync.js";

describe("tripSync - mapToWealthOSCategory", () => {
  it("maps transit and transport keywords to Transport", () => {
    expect(mapToWealthOSCategory("Flights")).toBe("Transport");
    expect(mapToWealthOSCategory("indigo flight")).toBe("Transport");
    expect(mapToWealthOSCategory("Cab / Uber")).toBe("Transport");
    expect(mapToWealthOSCategory("Train")).toBe("Transport");
  });

  it("maps stay and accommodation keywords to Housing", () => {
    expect(mapToWealthOSCategory("Hotel")).toBe("Housing");
    expect(mapToWealthOSCategory("Resort Booking")).toBe("Housing");
    expect(mapToWealthOSCategory("Airbnb")).toBe("Housing");
    expect(mapToWealthOSCategory("stay")).toBe("Housing");
    expect(mapToWealthOSCategory("stays")).toBe("Housing");
    expect(mapToWealthOSCategory("cruise")).toBe("Housing");
  });

  it("maps dining and beverage keywords to Food", () => {
    expect(mapToWealthOSCategory("Dinner")).toBe("Food");
    expect(mapToWealthOSCategory("Cafe 1947")).toBe("Food");
    expect(mapToWealthOSCategory("Groceries")).toBe("Food");
    expect(mapToWealthOSCategory("Drinks & Cocktails")).toBe("Food");
  });

  it("maps tickets and activities to Entertainment", () => {
    expect(mapToWealthOSCategory("Scuba Diving")).toBe("Entertainment");
    expect(mapToWealthOSCategory("Museum Entry Tickets")).toBe("Entertainment");
    expect(mapToWealthOSCategory("Activities")).toBe("Entertainment");
    expect(mapToWealthOSCategory("tours")).toBe("Entertainment");
  });

  it("maps shopping keywords to Shopping", () => {
    expect(mapToWealthOSCategory("Souvenirs")).toBe("Shopping");
    expect(mapToWealthOSCategory("Market Shopping")).toBe("Shopping");
  });

  it("defaults unknown or missing categories to Others", () => {
    expect(mapToWealthOSCategory("")).toBe("Others");
    expect(mapToWealthOSCategory(null)).toBe("Others");
    expect(mapToWealthOSCategory("random miscellaneous")).toBe("Others");
  });
});

describe("tripSync - mapWealthOSToTripArchitectCategory", () => {
  it("maps WealthOS categories back to Trip Architect standard categories", () => {
    expect(mapWealthOSToTripArchitectCategory("Transport")).toBe("transport");
    expect(mapWealthOSToTripArchitectCategory("Housing")).toBe("stays");
    expect(mapWealthOSToTripArchitectCategory("Food")).toBe("food");
    expect(mapWealthOSToTripArchitectCategory("Entertainment")).toBe("tours");
    expect(mapWealthOSToTripArchitectCategory("Shopping")).toBe("shopping");
    expect(mapWealthOSToTripArchitectCategory("Others")).toBe("misc");
  });
});

describe("tripSync - parseCurrencyAmount", () => {
  it("parses numbers and Indian currency strings with commas/symbols", () => {
    expect(parseCurrencyAmount(85000)).toBe(85000);
    expect(parseCurrencyAmount("₹3,500")).toBe(3500);
    expect(parseCurrencyAmount("₹1,200/day")).toBe(1200);
    expect(parseCurrencyAmount("600")).toBe(600);
    expect(parseCurrencyAmount(null)).toBe(0);
  });
});

describe("tripSync - normalizeTripPayload", () => {
  it("normalizes a valid Trip Architecture payload with items", () => {
    const raw = {
      destination: "Goa Beach Holiday",
      startDate: "2026-11-10",
      endDate: "2026-11-15",
      budget: 30000,
      itineraryUrl: "https://trip-architecture.web.app/trips/goa-2026",
      bookings: [
        {
          title: "Indigo Flights",
          cost: 8500,
          type: "Flight",
          date: "2026-11-10",
        },
        {
          title: "Taj Vivanta",
          cost: 14000,
          type: "Hotel",
          date: "2026-11-11",
        },
      ],
    };

    const trip = normalizeTripPayload(raw);
    expect(trip.name).toBe("Goa Beach Holiday");
    expect(trip.startDate).toBe("2026-11-10");
    expect(trip.endDate).toBe("2026-11-15");
    expect(trip.budget).toBe(30000);
    expect(trip.itineraryUrl).toBe("https://trip-architecture.web.app/trips/goa-2026");
    expect(trip.items).toHaveLength(2);
    expect(trip.amount).toBe(22500); // 8500 + 14000
    expect(trip.items[0]).toMatchObject({
      name: "Indigo Flights",
      amount: 8500,
      category: "Transport",
      date: "2026-11-10",
    });
    expect(trip.items[1]).toMatchObject({
      name: "Taj Vivanta",
      amount: 14000,
      category: "Housing",
      date: "2026-11-11",
    });
    expect(trip.items[0].id).toBeDefined();
  });

  it("parses valid JSON string input", () => {
    const jsonStr = JSON.stringify({
      name: "Paris Trip",
      budget: 150000,
      url: "https://trip-architecture.com/trips/paris",
      expenses: [{ name: "Eiffel Tower Ticket", amount: 3500, category: "Activities" }],
    });

    const trip = normalizeTripPayload(jsonStr);
    expect(trip.name).toBe("Paris Trip");
    expect(trip.budget).toBe(150000);
    expect(trip.itineraryUrl).toBe("https://trip-architecture.com/trips/paris");
    expect(trip.amount).toBe(3500);
    expect(trip.items[0].category).toBe("Entertainment");
  });

  it("throws an error when payload is empty or missing title/name", () => {
    expect(() => normalizeTripPayload(null)).toThrow("Invalid trip payload");
    expect(() => normalizeTripPayload({})).toThrow("Trip must have a name or destination");
    expect(() => normalizeTripPayload("{ invalid json }")).toThrow();
  });
});

describe("tripSync - parseSupabaseTripToWealthOS", () => {
  it("converts Supabase trip with budget.breakdown (Chikmagalur style) to WealthOS trip", () => {
    const supabaseRow = {
      id: "chikmagalur-2026",
      data: {
        id: "chikmagalur-2026",
        title: "Chikmagalur Coffee & Cloud Peaks",
        startDate: "2026-09-12",
        endDate: "2026-09-14",
        url: "chikmagalur_trip_architect.html",
        budget: {
          totalEstimate: "₹6,100 Shared Transport",
          breakdown: [
            { item: "Day 1 Private Sightseeing Cab", cost: "₹3,500" },
            { item: "Jhari Falls 4x4 Jeep", cost: "₹800" },
            { item: "Scooty Fuel & Entry Fees", cost: "₹600" },
          ],
        },
      },
    };

    const trip = parseSupabaseTripToWealthOS(supabaseRow);
    expect(trip.supabaseTripId).toBe("chikmagalur-2026");
    expect(trip.name).toBe("Chikmagalur Coffee & Cloud Peaks");
    expect(trip.startDate).toBe("2026-09-12");
    expect(trip.endDate).toBe("2026-09-14");
    expect(trip.budget).toBe(6100);
    expect(trip.items).toHaveLength(3);
    expect(trip.items[0]).toMatchObject({
      name: "Day 1 Private Sightseeing Cab",
      amount: 3500,
      category: "Transport",
    });
    expect(trip.amount).toBe(4900); // 3500 + 800 + 600
  });

  it("converts Supabase trip with budget.items (Vietnam style) to WealthOS trip", () => {
    const supabaseRow = {
      id: "vietnam-dec-2026",
      data: {
        id: "vietnam-dec-2026",
        title: "Vietnam Master Expedition",
        startDate: "2026-12-03",
        endDate: "2026-12-10",
        budget: {
          total: 406000,
          items: [
            { id: "b-1", item: "Flights", total: 85000, category: "flights", date: "2026-12-03" },
            { id: "b-4", item: "Da Nang Hotel", total: 48000, category: "stays", date: "2026-12-04" },
          ],
        },
      },
    };

    const trip = parseSupabaseTripToWealthOS(supabaseRow);
    expect(trip.supabaseTripId).toBe("vietnam-dec-2026");
    expect(trip.name).toBe("Vietnam Master Expedition");
    expect(trip.budget).toBe(406000);
    expect(trip.items).toHaveLength(2);
    expect(trip.items[0].category).toBe("Transport");
    expect(trip.items[1].category).toBe("Housing");
    expect(trip.amount).toBe(133000);
  });
});

describe("tripSync - buildSupabaseBudgetDataFromWealthOS", () => {
  it("formats WealthOS trip items into Trip Architect budget structure", () => {
    const existingSupabaseData = {
      id: "chikmagalur-2026",
      title: "Chikmagalur Coffee",
      budget: {
        totalEstimate: "₹6,100",
        breakdown: [{ item: "Old Cab", cost: "₹3,500" }],
      },
    };

    const wealthOSTrip = {
      id: 1,
      name: "Chikmagalur Coffee",
      budget: 7000,
      items: [
        { id: "w-1", name: "Cab Booking", amount: 3500, category: "Transport", date: "2026-09-12" },
        { id: "w-2", name: "Resort Stay", amount: 2500, category: "Housing", date: "2026-09-13" },
      ],
    };

    const updatedData = buildSupabaseBudgetDataFromWealthOS(wealthOSTrip, existingSupabaseData);
    expect(updatedData.title).toBe("Chikmagalur Coffee");
    expect(updatedData.budget.total).toBe(6000);
    expect(updatedData.budget.items).toHaveLength(2);
    expect(updatedData.budget.items[0].item).toBe("Cab Booking");
    expect(updatedData.budget.items[0].category).toBe("transport");
    expect(updatedData.budget.items[1].item).toBe("Resort Stay");
    expect(updatedData.budget.items[1].category).toBe("stays");
  });
});

describe("tripSync - mergeTripItems", () => {
  it("merges incoming items and deduplicates identical entries", () => {
    const existingTrip = {
      id: 101,
      name: "Manali Trip",
      amount: 5000,
      items: [
        { id: "e1", name: "Bus Ticket", amount: 2000, category: "Transport", date: "2026-10-01" },
        { id: "e2", name: "Hotel Deposit", amount: 3000, category: "Housing", date: "2026-10-02" },
      ],
    };

    const incomingItems = [
      { name: "Bus Ticket", amount: 2000, category: "Transport", date: "2026-10-01" },
      { name: "River Rafting", amount: 1500, category: "Entertainment", date: "2026-10-03" },
    ];

    const updated = mergeTripItems(existingTrip, incomingItems, { deduplicate: true });
    expect(updated.items).toHaveLength(3);
    expect(updated.items[2].name).toBe("River Rafting");
    expect(updated.amount).toBe(6500);
  });
});

describe("tripSync - exportTripToArchitectureFormat", () => {
  it("formats WealthOS trip into Trip Architecture compatible schema", () => {
    const wealthOSTrip = {
      id: 1,
      name: "Dubai Shopping Fest",
      startDate: "2026-12-15",
      endDate: "2026-12-20",
      budget: 80000,
      amount: 45000,
      itineraryUrl: "https://trip-architecture.web.app/trips/dubai",
      items: [
        { id: "i1", name: "Flight Tickets", amount: 30000, category: "Transport", date: "2026-12-15" },
        { id: "i2", name: "Burj Khalifa Tour", amount: 15000, category: "Entertainment", date: "2026-12-16" },
      ],
    };

    const exported = exportTripToArchitectureFormat(wealthOSTrip);
    expect(exported.version).toBe("wealthos-trip-v1");
    expect(exported.trip.name).toBe("Dubai Shopping Fest");
    expect(exported.trip.totalSpend).toBe(45000);
    expect(exported.trip.expenses).toHaveLength(2);
  });
});

describe("tripSync - Supabase API calls", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetchSupabaseTrips fetches trips via REST API", async () => {
    const mockTrips = [{ id: "t-1", data: { title: "Trip 1" } }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTrips,
    });

    const result = await fetchSupabaseTrips("https://example.supabase.co", "test-key");
    expect(result).toEqual(mockTrips);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/trips?select=*",
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: "test-key" }),
      }),
    );
  });

  it("fetchSupabaseTrips throws error on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    await expect(fetchSupabaseTrips("https://example.supabase.co", "bad-key")).rejects.toThrow(
      "Failed to fetch trips from Supabase: 401 Unauthorized",
    );
  });

  it("syncWealthOSTripToSupabase patches existing trip data preserving metadata", async () => {
    const existingRow = {
      id: "trip-vietnam",
      data: {
        title: "Vietnam Adventure",
        itinerary: [{ day: 1, title: "Hanoi" }],
        budget: { total: 10000 },
      },
    };

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [existingRow],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ ...existingRow.data, budget: { total: 5000 } }],
      });

    const wealthOSTrip = {
      name: "Vietnam Adventure",
      items: [{ name: "Halong Cruise", amount: 5000, category: "Housing" }],
    };

    const synced = await syncWealthOSTripToSupabase(
      wealthOSTrip,
      "trip-vietnam",
      "https://example.supabase.co",
      "test-key",
    );

    expect(synced.itinerary).toEqual([{ day: 1, title: "Hanoi" }]);
    expect(synced.budget.total).toBe(5000);
    expect(synced.budget.items[0].item).toBe("Halong Cruise");
  });
});

describe("tripSync - pingSupabaseKeepAlive", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  it("pings Supabase and records timestamp if > 48 hours elapsed", async () => {
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

    await pingSupabaseKeepAlive("https://example.supabase.co", "test-key");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("wealthos_supabase_last_keepalive")).toBeDefined();

    // Second call immediately after should skip ping (throttled)
    await pingSupabaseKeepAlive("https://example.supabase.co", "test-key");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("tripSync - parseDateRangeString", () => {
  it("converts text date ranges into ISO YYYY-MM-DD", () => {
    const r1 = parseDateRangeString("Oct 2 – 4, 2026");
    expect(r1.startDate).toBe("2026-10-02");
    expect(r1.endDate).toBe("2026-10-04");

    const r2 = parseDateRangeString("Sep 12 – 14, 2026");
    expect(r2.startDate).toBe("2026-09-12");
    expect(r2.endDate).toBe("2026-09-14");

    const r3 = parseDateRangeString("2026-12-03");
    expect(r3.startDate).toBe("2026-12-03");

    const r4 = parseDateRangeString("2026-12-03 to 2026-12-10");
    expect(r4.startDate).toBe("2026-12-03");
    expect(r4.endDate).toBe("2026-12-10");
  });
});

describe("tripSync - resolvePayerAndPaxShare (Multi-Pax Mode A: Our Share Only)", () => {
  it("scales 5-pax expenses to 2-pax for Abhav and Aanya in Mode A", () => {
    // Hotel paid by Abhav for 5 people
    const hotelItem = {
      item: "Da Nang Hotel",
      total: 48000,
      pax: 5,
      paidBy: "Abhav",
      details: "Beachfront suites",
    };
    const res1 = resolvePayerAndPaxShare(hotelItem, {
      mode: "couple_share",
      couplePax: 2,
      p1Name: "Abhav",
      p2Name: "Aanya",
    });

    expect(res1.amount).toBe(19200); // (48000 / 5) * 2 = 9600 * 2 = 19200
    expect(res1.paidBy).toBe("p1"); // Matched to Abhav
    expect(res1.notes).toContain("5 Pax Split");
    expect(res1.notes).toContain("Original: ₹48,000");

    // Flight paid by Sundeep (friend) for 5 people
    const flightItem = {
      item: "Flights",
      total: 85000,
      pax: 5,
      paidBy: "Sundeep",
    };
    const res2 = resolvePayerAndPaxShare(flightItem, {
      mode: "couple_share",
      couplePax: 2,
      p1Name: "Abhav",
      p2Name: "Aanya",
    });

    expect(res2.amount).toBe(34000); // (85000 / 5) * 2 = 17000 * 2 = 34000
    expect(res2.paidBy).toBe("external"); // Friend paid
    expect(res2.notes).toContain("Sundeep");
  });

  it("leaves 2-pax expenses unscaled (100% belongs to couple)", () => {
    const hampiStay = {
      item: "Durga Comfort",
      total: 3200,
      pax: 2,
      paidBy: "Shared",
    };
    const res = resolvePayerAndPaxShare(hampiStay, {
      mode: "couple_share",
      couplePax: 2,
    });
    expect(res.amount).toBe(3200);
    expect(res.paidBy).toBe("shared");
  });
});

describe("tripSync - parseSupabaseTripToWealthOS with Multi-Pax & Date Parsing", () => {
  it("parses Hampi with text date and 2 pax", () => {
    const row = {
      id: "hampi-2026",
      data: {
        id: "hampi-2026",
        title: "Hampi Boulder Trails",
        dates: "Oct 2 – 4, 2026",
        budget: {
          total: 11500,
          paxCount: 2,
          breakdown: [
            { item: "Durga Comfort", cost: 3200, category: "stays", paidBy: "Abhav" },
            { item: "Scooty Rental", cost: 1800, category: "transport", paidBy: "Shared" },
          ],
        },
      },
    };

    const trip = parseSupabaseTripToWealthOS(row, { mode: "couple_share" });
    expect(trip.startDate).toBe("2026-10-02");
    expect(trip.endDate).toBe("2026-10-04");
    expect(trip.items).toHaveLength(2);
    expect(trip.items[0].paidBy).toBe("p1");
    expect(trip.items[0].amount).toBe(3200);
    expect(trip.amount).toBe(5000); // 3200 + 1800
  });

  it("parses Vietnam with 5 pax in Mode A (Our Share Only: 2 Pax)", () => {
    const row = {
      id: "vietnam-dec-2026",
      data: {
        id: "vietnam-dec-2026",
        title: "Vietnam Master Expedition",
        startDate: "2026-12-03",
        endDate: "2026-12-10",
        budget: {
          total: 406000,
          paxCount: 5,
          items: [
            { item: "Flights", total: 85000, pax: 5, category: "flights", paidBy: "Sundeep" },
            { item: "Da Nang Hotel", total: 48000, pax: 5, category: "stays", paidBy: "Abhav" },
          ],
        },
      },
    };

    const trip = parseSupabaseTripToWealthOS(row, { mode: "couple_share", couplePax: 2 });
    expect(trip.items[0].amount).toBe(34000); // 17000 * 2
    expect(trip.items[1].amount).toBe(19200); // 9600 * 2
    expect(trip.amount).toBe(53200); // 34000 + 19200
  });
});
