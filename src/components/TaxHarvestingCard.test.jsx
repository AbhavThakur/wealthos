import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TaxHarvestingCard from "./TaxHarvestingCard";

describe("TaxHarvestingCard Component", () => {
  const investments = [
    {
      id: 1,
      name: "Parag Parikh Flexi Cap",
      type: "Mutual Fund",
      existingCorpus: 300000,
      invested: 200000,
      units: 3000,
      startDate: "2024-01-01",
    },
  ];

  it("renders tax harvesting advisor and potential tax savings", () => {
    render(<TaxHarvestingCard investments={investments} personName="Abhav" />);

    expect(screen.getByText(/LTCG ₹1.25 Lakh Tax Harvesting Advisor/i)).toBeDefined();
    expect(screen.getByText(/Tax Saving Opportunity/i)).toBeDefined();
    expect(screen.getByText(/Section 112A/i)).toBeDefined();
  });

  it("toggles detailed harvesting recommendations table", () => {
    render(<TaxHarvestingCard investments={investments} personName="Abhav" />);

    const toggleBtn = screen.getByRole("button", { name: /View .* Recommended Fund Redemptions/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/How to execute:/i)).toBeDefined();
    expect(screen.getByText(/Units to Redeem/i)).toBeDefined();
  });
});
