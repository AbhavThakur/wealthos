import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MoneyDateModal from "./MoneyDateModal";

describe("MoneyDateModal Component", () => {
  const p1 = {
    incomes: [{ amount: 150000 }],
    expenses: [{ amount: 40000, category: "Housing" }],
    transactions: [],
  };
  const p2 = {
    incomes: [{ amount: 100000 }],
    expenses: [{ amount: 20000, category: "Groceries" }],
    transactions: [],
  };
  const shared = {
    goals: [{ id: "g1", name: "Home Fund", target: 1000000, current: 400000 }],
    settlements: [],
  };

  it("renders step 1 (The Big Picture) with combined financial metrics", () => {
    render(
      <MoneyDateModal
        open={true}
        onClose={vi.fn()}
        p1={p1}
        p2={p2}
        shared={shared}
        month="2026-08"
        personNames={{ p1: "Rahul", p2: "Priya" }}
      />,
    );

    expect(screen.getByText(/Monthly Money Date/i)).toBeDefined();
    expect(screen.getByText(/The Big Picture/i)).toBeDefined();
    expect(screen.getByText(/Combined Income/i)).toBeDefined();
    expect(screen.getByText("₹2,50,000")).toBeDefined();
  });

  it("steps through the 5-step guided flow when clicking Next", () => {
    const onSaveReview = vi.fn();
    render(
      <MoneyDateModal
        open={true}
        onClose={vi.fn()}
        onSaveReview={onSaveReview}
        p1={p1}
        p2={p2}
        shared={shared}
        month="2026-08"
        personNames={{ p1: "Rahul", p2: "Priya" }}
      />,
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Where Did Our Money Go/i)).toBeDefined();

    // Step 2 -> Step 3 (health score)
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Household Health Score/i)).toBeDefined();
    expect(screen.getByText(/Emergency Fund/i)).toBeDefined();

    // Step 3 -> Step 4 (goals + settlement)
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Shared Dreams & Goals/i)).toBeDefined();
    expect(screen.getByText("Home Fund")).toBeDefined();
    expect(screen.getByText(/Shared Balance & Settlement/i)).toBeDefined();

    // Step 4 -> Step 5
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Money Date Complete/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/What went well/i), {
      target: { value: "We stayed within our dining budget" },
    });
    fireEvent.change(screen.getByLabelText(/Our next action/i), {
      target: { value: "Increase the home fund SIP" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Review/i }));

    expect(onSaveReview).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "money-date-2026-08",
        month: "2026-08",
        healthScore: expect.objectContaining({
          score: expect.any(Number),
          label: expect.any(String),
        }),
        tips: expect.any(Array),
        reflection: expect.objectContaining({
          win: "We stayed within our dining budget",
          nextAction: "Increase the home fund SIP",
        }),
        summary: expect.objectContaining({
          totalIncome: 250000,
          totalSpent: 60000,
          savingsRate: 76,
        }),
      }),
    );
  });

  it("shows previously saved monthly reviews", () => {
    render(
      <MoneyDateModal
        open={true}
        onClose={vi.fn()}
        p1={p1}
        p2={p2}
        shared={{
          ...shared,
          monthlyReviews: [
            {
              id: "money-date-2026-07",
              month: "2026-07",
              summary: { savingsRate: 42, combinedNetWorth: 2500000 },
              reflection: { win: "Cleared the credit card" },
            },
          ],
        }}
        month="2026-08"
      />,
    );

    expect(screen.getByText(/Past Monthly Reviews/i)).toBeDefined();
    expect(screen.getByText(/Cleared the credit card/i)).toBeDefined();
    expect(screen.getByText(/42% saved/i)).toBeDefined();
  });
});
