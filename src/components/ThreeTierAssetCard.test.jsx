import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ThreeTierAssetCard from "./ThreeTierAssetCard";

describe("ThreeTierAssetCard Component", () => {
  const p1 = {
    investments: [
      { id: "i1", name: "Parag Parikh Flexi Cap", type: "Mutual Fund", existingCorpus: 500000 },
      { id: "i2", name: "SBI FD", type: "FD", amount: 200000 },
    ],
    savingsAccounts: [
      { id: "sa1", bankName: "HDFC Bank", balance: 50000 },
    ],
    goals: [{ id: "g1", name: "Emergency Fund", saved: 100000, target: 100000 }],
  };

  const p2 = {
    investments: [
      { id: "i3", name: "PPF Account", type: "PPF", existingCorpus: 150000 },
    ],
    goals: [],
  };

  const shared = {
    goals: [],
  };

  it("renders 3-tier wealth breakdown with Liquid Cash, Wealth Growers, and Guaranteed Safe", () => {
    render(<ThreeTierAssetCard p1={p1} p2={p2} shared={shared} />);

    expect(screen.getByText(/Where is My Money\? \(3-Tier Wealth Structure\)/i)).toBeDefined();
    expect(screen.getByText(/1\. Liquid & Daily Cash/i)).toBeDefined();
    expect(screen.getByText(/2\. Wealth Growers \(Equity\)/i)).toBeDefined();
    expect(screen.getByText(/3\. Guaranteed & Safe/i)).toBeDefined();

    // Check liquid cash value (1.5 Lakhs = 50k savings + 100k emergency cash)
    expect(screen.getByText("₹1,50,000")).toBeDefined();

    // Check wealth growers value (5 Lakhs)
    expect(screen.getByText("₹5,00,000")).toBeDefined();

    // Check guaranteed safe value (2L FD + 1.5L PPF = 3.5 Lakhs)
    expect(screen.getByText("₹3,50,000")).toBeDefined();
  });

  it("renders guidance note", () => {
    render(<ThreeTierAssetCard p1={p1} p2={p2} shared={shared} />);
    expect(screen.getByText(/Guidance:/i)).toBeDefined();
  });
});
