import { describe, it, expect } from "vitest";
import { parseQuickLogText, inferCategory } from "./quickLog";

describe("Quick-Log Parser", () => {
  it("infers categories from keyword tokens", () => {
    expect(inferCategory("starbucks latte")).toBe("Food & Dining");
    expect(inferCategory("apollo pharmacy")).toBe("Health & Medical");
    expect(inferCategory("netflix monthly")).toBe("Entertainment");
  });

  it("parses '450 Swiggy P1' correctly", () => {
    const res = parseQuickLogText("450 Swiggy P1");
    expect(res).toBeDefined();
    expect(res.amount).toBe(450);
    expect(res.name).toBe("Swiggy");
    expect(res.person).toBe("p1");
    expect(res.category).toBe("Food & Dining");
    expect(res.isSplit).toBe(false);
  });

  it("parses 'Petrol 2000 P2' correctly", () => {
    const res = parseQuickLogText("Petrol 2000 P2");
    expect(res.amount).toBe(2000);
    expect(res.name).toBe("Petrol");
    expect(res.person).toBe("p2");
    expect(res.category).toBe("Transport");
  });

  it("parses split expense 'Dinner with team 3500 split' correctly", () => {
    const res = parseQuickLogText("Dinner with team 3500 split");
    expect(res.amount).toBe(3500);
    expect(res.name).toBe("Dinner with team");
    expect(res.isSplit).toBe(true);
    expect(res.splitMode).toBe("50:50");
    expect(res.category).toBe("Food & Dining");
  });

  it("parses custom split ratio 'Grocery 1800 P1 split 60:40'", () => {
    const res = parseQuickLogText("Grocery 1800 P1 split 60:40");
    expect(res.amount).toBe(1800);
    expect(res.person).toBe("p1");
    expect(res.isSplit).toBe(true);
    expect(res.splitMode).toBe("60:40");
    expect(res.category).toBe("Groceries");
  });

  it("handles shorthand 'k' and 'L' values like '4.5k Flight Tickets'", () => {
    const res = parseQuickLogText("4.5k Flight Tickets");
    expect(res.amount).toBe(4500);
    expect(res.category).toBe("Travel");
  });

  it("detects partner custom names", () => {
    const res = parseQuickLogText("Zomato 620 Priya", "p1", { p1: "Rahul", p2: "Priya" });
    expect(res.amount).toBe(620);
    expect(res.person).toBe("p2");
  });

  it("returns null for non-financial text", () => {
    expect(parseQuickLogText("Hello world")).toBeNull();
    expect(parseQuickLogText("")).toBeNull();
  });
});
