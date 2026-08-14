import { describe, it, expect } from "vitest";
import { parseCASText, inferMFCategory, diffCASHoldings, mergeCASHoldings } from "./casParser";

describe("CAS Parser & Merger", () => {
  it("infers fund categories accurately", () => {
    expect(inferMFCategory("Parag Parikh Flexi Cap Fund - Direct Plan")).toBe("Flexi Cap");
    expect(inferMFCategory("UTI Nifty 50 Index Fund Direct Growth")).toBe("Large Cap");
    expect(inferMFCategory("Mirae Asset Midcap Fund")).toBe("Mid Cap");
    expect(inferMFCategory("Nippon India Small Cap Fund")).toBe("Small Cap");
    expect(inferMFCategory("Mirae Asset Tax Saver ELSS Fund")).toBe("ELSS");
  });

  it("parses CSV formatted CAS extract", () => {
    const csvContent = `
Scheme Name,Folio Number,Closing Balance,Current NAV,Cost Value,Current Value
Parag Parikh Flexi Cap Fund Direct Growth,12345/67,1000.50,75.40,50000,75437.70
UTI Nifty 50 Index Fund Direct,98765/43,500.00,165.20,60000,82600.00
    `.trim();

    const holdings = parseCASText(csvContent);
    expect(holdings.length).toBe(2);

    expect(holdings[0].name).toBe("Parag Parikh Flexi Cap Fund Direct Growth");
    expect(holdings[0].folio).toBe("12345/67");
    expect(holdings[0].units).toBe(1000.5);
    expect(holdings[0].currentValue).toBe(75438);
    expect(holdings[0].category).toBe("Flexi Cap");

    expect(holdings[1].name).toBe("UTI Nifty 50 Index Fund Direct");
    expect(holdings[1].units).toBe(500);
    expect(holdings[1].currentValue).toBe(82600);
  });

  it("diffs CAS holdings against existing portfolio into add vs update vs unchanged", () => {
    const existing = [
      { id: 1, name: "Parag Parikh Flexi Cap", folio: "12345/67", units: 800, currentValue: 60000 },
      { id: 2, name: "HDFC Large Cap", folio: "11111/22", units: 100, currentValue: 15000 },
    ];

    const casItems = [
      { name: "Parag Parikh Flexi Cap", folio: "12345/67", units: 1000, currentValue: 75000, nav: 75 },
      { name: "UTI Nifty 50 Index Fund", folio: "99999/00", units: 200, currentValue: 30000, nav: 150 },
    ];

    const diff = diffCASHoldings(casItems, existing);

    expect(diff.toUpdate.length).toBe(1);
    expect(diff.toUpdate[0].id).toBe(1);
    expect(diff.toUpdate[0].currentValue).toBe(75000);

    expect(diff.toAdd.length).toBe(1);
    expect(diff.toAdd[0].name).toBe("UTI Nifty 50 Index Fund");

    const merged = mergeCASHoldings(existing, [...diff.toUpdate, ...diff.toAdd]);
    expect(merged.length).toBe(3);
    const updatedPP = merged.find((m) => m.id === 1);
    expect(updatedPP.currentValue).toBe(75000);
    expect(updatedPP.units).toBe(1000);
  });
});
