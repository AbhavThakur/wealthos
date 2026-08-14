import { describe, it, expect } from "vitest";
import { buildCashFlowSankeyData } from "./SankeyDiagram";

describe("Cash Flow Sankey Diagram Data Builder", () => {
  const p1 = {
    incomes: [{ id: 1, name: "Salary", amount: 100000 }],
    expenses: [
      { id: 10, name: "Apartment Rent", amount: 30000, category: "Housing" },
      { id: 11, name: "Groceries", amount: 15000, category: "Groceries" },
      { id: 12, name: "Dining Out", amount: 8000, category: "Dining" },
    ],
  };

  const p2 = {
    incomes: [{ id: 2, name: "Salary", amount: 80000 }],
    expenses: [
      { id: 20, name: "Electricity", amount: 4000, category: "Utilities" },
      { id: 21, name: "Weekend Trip", amount: 12000, category: "Travel" },
    ],
  };

  it("builds multi-tier nodes and links for combined household", () => {
    const { nodes, links } = buildCashFlowSankeyData(p1, p2, "2026-08", "household", {
      p1: "Rahul",
      p2: "Priya",
    });

    expect(nodes.length).toBeGreaterThan(4);
    expect(links.length).toBeGreaterThan(4);

    // Verify income nodes
    expect(nodes.some((n) => n.name === "Rahul Income")).toBe(true);
    expect(nodes.some((n) => n.name === "Priya Income")).toBe(true);
    expect(nodes.some((n) => n.name === "Total Household Income")).toBe(true);

    // Verify core buckets
    expect(nodes.some((n) => n.name === "Needs & Essentials")).toBe(true);
    expect(nodes.some((n) => n.name === "Lifestyle & Wants")).toBe(true);
    expect(nodes.some((n) => n.name === "Savings & Surplus")).toBe(true);
  });

  it("builds single person stream accurately", () => {
    const { nodes, links } = buildCashFlowSankeyData(p1, p2, "2026-08", "p1", {
      p1: "Rahul",
      p2: "Priya",
    });

    expect(nodes.some((n) => n.name === "Rahul Income")).toBe(true);
    expect(nodes.some((n) => n.name === "Priya Income")).toBe(false);
    expect(links.some((l) => l.source === "Rahul Income")).toBe(true);
  });
});
