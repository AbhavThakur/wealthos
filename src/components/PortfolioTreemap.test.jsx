import { describe, it, expect } from "vitest";
import { classifyAsset, buildTreemapData } from "./PortfolioTreemap";

describe("Portfolio Treemap & Asset Classifier", () => {
  it("classifies asset categories correctly", () => {
    expect(classifyAsset({ category: "Mutual Funds", name: "Parag Parikh Flexi Cap" })).toBe("Equity");
    expect(classifyAsset({ category: "Fixed Deposit", name: "HDFC FD" })).toBe("Debt");
    expect(classifyAsset({ category: "PPF", name: "Public Provident Fund" })).toBe("Debt");
    expect(classifyAsset({ category: "Sovereign Gold Bond", name: "SGB 2024" })).toBe("Gold");
    expect(classifyAsset({ category: "Real Estate", name: "Bangalore Apartment" })).toBe("Real Estate");
    expect(classifyAsset({ category: "Savings Account", name: "ICICI Bank" })).toBe("Cash");
  });

  it("builds hierarchical tree structure with grouped totals", () => {
    const investments = [
      { name: "UTI Nifty 50 Index", currentValue: 500000, category: "Mutual Funds" },
      { name: "HDFC Large Cap", currentValue: 300000, category: "Mutual Funds" },
      { name: "SBI FD 3yr", currentValue: 200000, category: "FD" },
      { name: "SGB 2023", currentValue: 100000, category: "Gold" },
    ];

    const data = buildTreemapData(investments);

    expect(data.length).toBe(3); // Equity, Debt, Gold
    const equityGroup = data.find((d) => d.name === "Equity");
    expect(equityGroup).toBeDefined();
    expect(equityGroup.value).toBe(800000);
    expect(equityGroup.children.length).toBe(2);

    const debtGroup = data.find((d) => d.name === "Debt");
    expect(debtGroup.value).toBe(200000);

    const goldGroup = data.find((d) => d.name === "Gold");
    expect(goldGroup.value).toBe(100000);
  });
});
