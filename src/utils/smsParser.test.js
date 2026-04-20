import { describe, it, expect } from "vitest";
import {
  segmentMessages,
  parseSingleSMS,
  parseTransactionSMS,
  dedupeAgainstExisting,
  guessCategory,
} from "../utils/smsParser";

// ── segmentMessages ─────────────────────────────────────────────────────────
describe("segmentMessages", () => {
  it("splits on blank lines", () => {
    const text = "Message one about debit\n\nMessage two about credit";
    const msgs = segmentMessages(text);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain("Message one");
    expect(msgs[1]).toContain("Message two");
  });

  it("returns empty array for blank input", () => {
    expect(segmentMessages("")).toEqual([]);
    expect(segmentMessages("   ")).toEqual([]);
    expect(segmentMessages(null)).toEqual([]);
  });

  it("handles single message without separator", () => {
    const text =
      "Alert: Your A/c no. XX0000 is debited for Rs. 500.00 on 2026-04-15 by UPI Ref no 123456789012.";
    expect(segmentMessages(text)).toHaveLength(1);
  });

  it("skips trivially short lines", () => {
    const text = "OK\n\nAlert: Your A/c debited Rs. 500.00";
    const msgs = segmentMessages(text);
    expect(msgs).toHaveLength(1);
  });

  it("splits HDFC messages without blank-line separators", () => {
    const text = [
      "Spent Rs.794 On HDFC Bank Card 4263 At ..BREAD On 2026-04-05:21:02:11.Not You?",
      "Sent Rs.106.00",
      "From HDFC Bank A/C *6908",
      "To SANJU PANDITA",
      "On 31/03/26",
      "Ref 645612137225",
    ].join("\n");
    const msgs = segmentMessages(text);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain("Rs.794");
    expect(msgs[1]).toContain("Rs.106");
  });

  it("splits multi-line messages that start with Sent/Paid/Alert", () => {
    const text = "Paid Rs. 200 to Swiggy\nPaid Rs. 100 to Zomato";
    const msgs = segmentMessages(text);
    expect(msgs).toHaveLength(2);
  });
});

// ── parseSingleSMS ──────────────────────────────────────────────────────────
describe("parseSingleSMS", () => {
  it("parses HDFC debit SMS", () => {
    const msg =
      "Alert: Your A/c no. XX0000 is debited for Rs. 500.00 on 2026-04-15 by UPI Ref no 123456789012. If not done by you, call 1800-XXX-XXXX.";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(500);
    expect(result.direction).toBe("debit");
    expect(result.date).toBe("2026-04-15");
    expect(result.refId).toBe("123456789012");
    expect(result.account).toBe("0000");
    // Bank name not in SMS body (comes from sender ID) — correctly Unknown
    expect(result.source.type).toBe("unknown");
  });

  it("parses ICICI short format", () => {
    const msg =
      "A/c XX000 debited for INR 250.00; Info: UPI/Swiggy/123456789012/Shopping. Balance: INR 10,000.00.";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(250);
    expect(result.direction).toBe("debit");
    expect(result.merchant).toBe("Swiggy");
    // Bank name not in SMS body (comes from sender ID) — correctly Unknown
    expect(result.source.type).toBe("unknown");
  });

  it("parses SBI format with month abbreviation date", () => {
    const msg =
      "Your A/c X0000 debited by Rs. 1,000.00 on 15-Apr-26; Transf. to merchant@upi Ref: 612345678901. Not you? Report to 1930.";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(1000);
    expect(result.date).toBe("2026-04-15");
    // Bank name not in SMS body — correctly Unknown
    expect(result.source.type).toBe("unknown");
  });

  it("parses Axis Bank format", () => {
    const msg =
      "Axis Bank: Rs. 150.00 debited from A/c XX0000 towards UPI/9800000111@axisbank/Ref No 123456789012 on 15-04-26 14:30:00.";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(150);
    expect(result.direction).toBe("debit");
    expect(result.source.name).toBe("Axis Bank");
  });

  it("parses GPay/PhonePe generic format", () => {
    const msg =
      "Paid Rs. 100 to Swiggy via UPI. Ref: 123456789012. Check PhonePe app for details.";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(100);
    expect(result.direction).toBe("debit");
    expect(result.merchant).toBe("Swiggy");
    expect(result.source.name).toBe("PhonePe");
  });

  it("parses HDFC credit card POS format", () => {
    const msg =
      "Spent Rs.794 On HDFC Bank Card 4263 At ..BREAD AND BEAN S_ On 2026-04-05:21:02:11.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 4263 to 7308080808";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(794);
    expect(result.direction).toBe("debit");
    expect(result.date).toBe("2026-04-05");
    expect(result.merchant).toBe("BREAD AND BEAN S");
    expect(result.source.name).toBe("HDFC Bank");
  });

  it("parses HDFC UPI 'Sent' format with person name", () => {
    const msg =
      "Sent Rs.106.00 From HDFC Bank A/C *6908 To SANJU PANDITA On 31/03/26 Ref 645612137225 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(106);
    expect(result.direction).toBe("debit");
    expect(result.date).toBe("2026-03-31");
    expect(result.merchant).toBe("SANJU PANDITA");
    expect(result.source.name).toBe("HDFC Bank");
    expect(result.refId).toBe("645612137225");
  });

  it("strips Mr/Mrs prefix from merchant name", () => {
    const msg =
      "Sent Rs.40.00 From HDFC Bank A/C *6908 To Mr SUDEERAM On 27/03/26 Ref 645210474664 Not You?";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(40);
    expect(result.merchant).toBe("SUDEERAM");
  });

  it("detects credit/refund", () => {
    const msg =
      "Your A/c XX1234 credited with Rs. 200.00 — refund from Amazon. Ref: 999888777666.";
    const result = parseSingleSMS(msg);
    expect(result).not.toBeNull();
    expect(result.direction).toBe("credit");
    expect(result.amount).toBe(200);
  });

  it("returns null for OTP messages", () => {
    const msg = "Your OTP for login is 123456. Do not share with anyone.";
    expect(parseSingleSMS(msg)).toBeNull();
  });

  it("returns null for promo messages", () => {
    const msg =
      "Exciting promotion! Get flat 50% cashback on your next purchase.";
    expect(parseSingleSMS(msg)).toBeNull();
  });

  it("returns null for messages without amounts", () => {
    const msg = "Your KYC update is pending. Visit your nearest branch.";
    expect(parseSingleSMS(msg)).toBeNull();
  });

  it("preserves sourceText", () => {
    const msg = "Paid Rs. 100 to Swiggy via UPI. Ref: 123456789012.";
    const result = parseSingleSMS(msg);
    expect(result.sourceText).toBe(msg);
  });
});

// ── parseTransactionSMS (batch) ─────────────────────────────────────────────
describe("parseTransactionSMS", () => {
  it("parses multiple messages in bulk", () => {
    const text = [
      "Alert: Your A/c no. XX0000 is debited for Rs. 500.00 on 2026-04-15 by UPI Ref no 123456789012.",
      "",
      "Paid Rs. 100 to Zomato via UPI. Ref: 999888777666. Check PhonePe app for details.",
    ].join("\n");
    const results = parseTransactionSMS(text);
    expect(results).toHaveLength(2);
    expect(results[0].amount).toBe(500);
    expect(results[1].amount).toBe(100);
  });

  it("deduplicates by refId within same batch", () => {
    const text = [
      "Paid Rs. 100 to Swiggy via UPI. Ref: 123456789012.",
      "",
      "Paid Rs. 100 to Swiggy via UPI. Ref: 123456789012.",
    ].join("\n");
    const results = parseTransactionSMS(text);
    expect(results).toHaveLength(1);
  });

  it("filters out noise from mixed input", () => {
    const text = [
      "Your OTP is 123456. Do not share.",
      "",
      "Paid Rs. 250 to Amazon. Ref: 111222333444.",
      "",
      "Exciting offer! Get flat Rs. 200 cashback.",
    ].join("\n");
    const results = parseTransactionSMS(text);
    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(250);
  });

  it("parses 4 real HDFC SMS pasted without blank separators", () => {
    const text = [
      "Spent Rs.794 On HDFC Bank Card 4263 At ..BREAD AND BEAN S_ On 2026-04-05:21:02:11.Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 4263 to 7308080808",
      "Sent Rs.106.00 From HDFC Bank A/C *6908 To SANJU PANDITA On 31/03/26 Ref 645612137225 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808",
      "Sent Rs.40.00 From HDFC Bank A/C *6908 To Mr SUDEERAM On 27/03/26 Ref 645210474664 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808",
      "Sent Rs.93.00 From HDFC Bank A/C *6908 To HEMANTA  NAYAK On 25/03/26 Ref 645025056879 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808",
    ].join("\n");
    const results = parseTransactionSMS(text);
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.amount)).toEqual([794, 106, 40, 93]);
    expect(results[0].merchant).toBe("BREAD AND BEAN S");
    expect(results[1].merchant).toBe("SANJU PANDITA");
    expect(results[2].merchant).toBe("SUDEERAM");
    expect(results[3].merchant).toBe("HEMANTA NAYAK");
  });
});

// ── dedupeAgainstExisting ───────────────────────────────────────────────────
describe("dedupeAgainstExisting", () => {
  it("removes transactions matching existing entries", () => {
    const parsed = [
      { amount: 500, date: "2026-04-15", merchant: "Swiggy" },
      { amount: 200, date: "2026-04-16", merchant: "Zomato" },
    ];
    const expenses = [
      {
        id: 1,
        entries: [{ amount: 500, date: "2026-04-15", note: "swiggy order" }],
      },
    ];
    const fresh = dedupeAgainstExisting(parsed, expenses);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].amount).toBe(200);
  });

  it("keeps all when no matches", () => {
    const parsed = [{ amount: 300, date: "2026-04-17", merchant: "Uber" }];
    const expenses = [
      {
        id: 1,
        entries: [{ amount: 500, date: "2026-04-15", note: "Swiggy" }],
      },
    ];
    expect(dedupeAgainstExisting(parsed, expenses)).toHaveLength(1);
  });
});

// ── guessCategory ───────────────────────────────────────────────────────────
describe("guessCategory", () => {
  it("maps food merchants to Food", () => {
    expect(guessCategory("Swiggy").category).toBe("Food");
    expect(guessCategory("Zomato").category).toBe("Food");
    expect(guessCategory("Dominos Pizza").category).toBe("Food");
  });

  it("maps transport merchants", () => {
    expect(guessCategory("Uber").category).toBe("Transport");
    expect(guessCategory("Ola").category).toBe("Transport");
  });

  it("maps shopping merchants", () => {
    expect(guessCategory("Amazon").category).toBe("Shopping");
    expect(guessCategory("Flipkart").category).toBe("Shopping");
  });

  it("maps streaming to Entertainment", () => {
    expect(guessCategory("Netflix").category).toBe("Entertainment");
    expect(guessCategory("Spotify").category).toBe("Entertainment");
  });

  it("returns Others for unknown merchants", () => {
    expect(guessCategory("RandomShop123").category).toBe("Others");
    expect(guessCategory(null).category).toBe("Others");
  });

  it("maps grocery merchants", () => {
    expect(guessCategory("BigBasket").category).toBe("Food");
    expect(guessCategory("BigBasket").sub).toBe("Groceries");
  });
});
