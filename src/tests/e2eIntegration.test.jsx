import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Goals from "../pages/Goals";
import PortfolioAuditCard from "../components/PortfolioAuditCard";
import ExecutivePulseCard from "../components/ExecutivePulseCard";
import AmountInput from "../components/AmountInput";
import { ViewModeProvider } from "../context/ViewModeContext";

const mockInvestmentsP1 = [
  {
    id: "inv1",
    name: "SBI 1-Yr FD",
    type: "FD",
    amount: 150000,
    returnPct: 5.5,
    startDate: "2024-01-01",
    endDate: "2025-01-01",
  },
  {
    id: "inv2",
    name: "Parag Parikh Flexi Cap",
    type: "Mutual Fund",
    existingCorpus: 400000,
    returnPct: 14.5,
    frequency: "monthly",
    sipMonthly: 15000,
  },
];

const mockInvestmentsP2 = [
  {
    id: "inv3",
    name: "HDFC High Yield FD",
    type: "FD",
    amount: 200000,
    returnPct: 7.25,
    startDate: "2025-01-01",
    endDate: "2026-01-01",
  },
];

describe("End-to-End Comprehensive Feature Integration Suite", () => {
  it("AmountInput: formats numbers with Indian commas and verbal Lakh badge live", () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <AmountInput value={1000000} onChange={handleChange} />,
    );

    const input = screen.getByRole("textbox");
    expect(input.value).toBe("10,00,000");
    expect(screen.getByText("₹10 Lakhs")).toBeDefined();

    fireEvent.change(input, { target: { value: "5000000" } });
    expect(handleChange).toHaveBeenCalledWith(5000000);

    rerender(<AmountInput value={5000000} onChange={handleChange} />);
    expect(screen.getByText("₹50 Lakhs")).toBeDefined();
  });

  it("Goals: creates shared goal, displays AmountInput, and renders per-person portfolio sourcing hub", () => {
    const updateShared = vi.fn();
    const updatePerson = vi.fn();

    render(
      <ViewModeProvider>
        <Goals
          data={{ goals: [] }}
          sharedData={{ goals: [] }}
          p1={{ investments: mockInvestmentsP1 }}
          p2={{ investments: mockInvestmentsP2 }}
          personName="Abhav"
          personColor="var(--p1)"
          updatePerson={updatePerson}
          updateShared={updateShared}
          isHousehold={true}
          personNames={{ p1: "Abhav", p2: "Aanya" }}
        />
      </ViewModeProvider>,
    );

    // Open shared goal modal
    const addBtns = screen.getAllByRole("button", { name: /Add/i });
    fireEvent.click(addBtns[0]);

    // Type target amount into AmountInput
    const targetInput = screen.getByPlaceholderText("e.g. 10,00,000");
    fireEvent.change(targetInput, { target: { value: "600000" } });

    // Verify Person 1 & Person 2 funding hubs are visible
    expect(screen.getByText(/Abhav's Share & Sourcing/i)).toBeDefined();
    expect(screen.getByText(/Aanya's Share & Sourcing/i)).toBeDefined();
  });

  it("Investments: PortfolioAuditCard renders top compounders, FD alerts, and potential gain boost", () => {
    const allInvestments = [...mockInvestmentsP1, ...mockInvestmentsP2];
    render(<PortfolioAuditCard investments={allInvestments} />);

    // Check title and metrics
    expect(screen.getByText("Portfolio Health & Audit Summary")).toBeDefined();
    expect(screen.getByText(/Top Wealth Compounders/i)).toBeDefined();
    expect(screen.getByText("Parag Parikh Flexi Cap")).toBeDefined();
    expect(screen.getByText("14.5%")).toBeDefined();

    // Check FD alert
    expect(screen.getByText(/FD Optimization & Matured Alerts/i)).toBeDefined();
    expect(screen.getByText(/SBI 1-Yr FD/i)).toBeDefined();
  });

  it("Dashboard & Budget: ExecutivePulseCard displays 10-second pulse with budget, investment, and goals status", () => {
    const p1 = {
      incomes: [{ id: 1, name: "Salary", amount: 100000 }],
      expenses: [{ id: 1, amount: 40000, category: "Living" }],
      transactions: [{ id: "t1", amount: -20000, date: "2026-08-01" }],
      investments: mockInvestmentsP1,
    };
    const p2 = {
      incomes: [{ id: 2, name: "Salary", amount: 80000 }],
      expenses: [{ id: 2, amount: 30000, category: "Living" }],
      transactions: [{ id: "t2", amount: -15000, date: "2026-08-05" }],
      investments: mockInvestmentsP2,
    };
    const shared = {
      goals: [{ id: "g1", name: "Vacation", target: 200000, p1Saved: 50000, p2Saved: 50000 }],
    };

    render(
      <ExecutivePulseCard
        p1={p1}
        p2={p2}
        shared={shared}
        currentMonthYm="2026-08"
      />,
    );

    expect(screen.getByText("10-Second Financial Health Pulse")).toBeDefined();
    expect(screen.getByText(/Monthly Cashflow & Budget/i)).toBeDefined();
    expect(screen.getByText(/Investment Engine/i)).toBeDefined();
    expect(screen.getByText(/Life Goals Track/i)).toBeDefined();
    expect(screen.getByText("Next step:")).toBeDefined();
  });
});
