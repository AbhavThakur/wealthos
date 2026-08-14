import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettlementCard from "./SettlementCard";
import { ViewModeProvider, useViewMode } from "../context/ViewModeContext";

describe("SettlementCard Component", () => {
  const mockP1 = {
    incomes: [{ amount: 100000 }],
    expenses: [
      {
        id: 1,
        name: "Apartment Rent",
        category: "Housing",
        amount: 40000,
        isSplit: true,
        splitMode: "50:50",
        paidBy: "p1",
        expenseType: "monthly",
      },
    ],
  };

  const mockP2 = {
    incomes: [{ amount: 80000 }],
    expenses: [
      {
        id: 2,
        name: "Supermarket Groceries",
        category: "Groceries",
        amount: 10000,
        isSplit: true,
        splitMode: "50:50",
        paidBy: "p2",
        expenseType: "monthly",
      },
    ],
  };

  const mockShared = {
    settlements: [],
    trips: [],
  };

  const personNames = { p1: "Rahul", p2: "Priya" };

  it("renders net balance correctly (Priya owes Rahul ₹15,000)", () => {
    render(
      <SettlementCard
        p1={mockP1}
        p2={mockP2}
        shared={mockShared}
        month="2026-08"
        personNames={personNames}
        updateShared={vi.fn()}
      />
    );

    expect(screen.getByText(/Household Split Balance/i)).toBeDefined();
    expect(screen.getByText("Priya")).toBeDefined();
    expect(screen.getByText("Rahul")).toBeDefined();
    expect(screen.getAllByText("₹15,000").length).toBeGreaterThan(0);
  });

  it("opens the Settle Up modal when clicking Settle Up button", () => {
    render(
      <SettlementCard
        p1={mockP1}
        p2={mockP2}
        shared={mockShared}
        month="2026-08"
        personNames={personNames}
        updateShared={vi.fn()}
      />
    );

    const settleBtn = screen.getByRole("button", { name: /Settle Up/i });
    fireEvent.click(settleBtn);

    expect(screen.getByText(/Record Settlement Payment/i)).toBeDefined();
    expect(screen.getByText(/Confirm Settlement/i)).toBeDefined();
  });

  it("records settlement on confirm", () => {
    const updateSharedMock = vi.fn();
    render(
      <SettlementCard
        p1={mockP1}
        p2={mockP2}
        shared={mockShared}
        month="2026-08"
        personNames={personNames}
        updateShared={updateSharedMock}
      />
    );

    const settleBtn = screen.getByRole("button", { name: /Settle Up/i });
    fireEvent.click(settleBtn);

    const confirmBtn = screen.getByRole("button", { name: /Confirm Settlement/i });
    fireEvent.click(confirmBtn);

    expect(updateSharedMock).toHaveBeenCalledWith("settlements", expect.any(Array));
  });

  it("toggles item breakdown list", () => {
    render(
      <SettlementCard
        p1={mockP1}
        p2={mockP2}
        shared={mockShared}
        month="2026-08"
        personNames={personNames}
        updateShared={vi.fn()}
      />
    );

    const toggleBtn = screen.getByText(/View 2 shared items/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Apartment Rent")).toBeDefined();
    expect(screen.getByText("Supermarket Groceries")).toBeDefined();
  });
});

describe("ViewModeContext", () => {
  function TestConsumer() {
    const { viewMode, setViewMode, toggleViewMode, isSimple } = useViewMode();
    return (
      <div>
        <span data-testid="mode">{viewMode}</span>
        <span data-testid="is-simple">{String(isSimple)}</span>
        <button onClick={() => setViewMode("simple")}>Set Simple</button>
        <button onClick={toggleViewMode}>Toggle</button>
      </div>
    );
  }

  it("provides view mode and allows switching between simple and pro", () => {
    render(
      <ViewModeProvider>
        <TestConsumer />
      </ViewModeProvider>
    );

    expect(screen.getByTestId("mode").textContent).toBe("pro");
    expect(screen.getByTestId("is-simple").textContent).toBe("false");

    fireEvent.click(screen.getByText("Set Simple"));
    expect(screen.getByTestId("mode").textContent).toBe("simple");
    expect(screen.getByTestId("is-simple").textContent).toBe("true");

    fireEvent.click(screen.getByText("Toggle"));
    expect(screen.getByTestId("mode").textContent).toBe("pro");
  });
});
