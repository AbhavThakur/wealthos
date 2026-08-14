import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LifeDecisionLab from "./LifeDecisionLab";

describe("LifeDecisionLab Component", () => {
  const p1 = {
    incomes: [{ id: 1, amount: 150000 }],
    expenses: [{ id: 1, amount: 50000 }],
    investments: [{ id: 1, existingCorpus: 2000000 }],
  };
  const p2 = {
    incomes: [{ id: 2, amount: 100000 }],
    expenses: [{ id: 2, amount: 30000 }],
    investments: [{ id: 2, existingCorpus: 1000000 }],
  };

  it("renders scenario tabs and default home purchase scenario", () => {
    render(<LifeDecisionLab p1={p1} p2={p2} />);

    expect(screen.getByText(/Life Decision Simulator/i)).toBeDefined();
    expect(screen.getByText(/Buy a Home/i)).toBeDefined();
    expect(screen.getByText(/Career Sabbatical/i)).toBeDefined();
    expect(screen.getByText(/Monthly EMI/i)).toBeDefined();
  });

  it("switches to Career Sabbatical scenario on tab click", () => {
    render(<LifeDecisionLab p1={p1} p2={p2} />);

    fireEvent.click(screen.getByText(/Career Sabbatical \/ Study/i));
    expect(screen.getByText(/Break Duration/i)).toBeDefined();
    expect(screen.getByText(/Total Break Cost/i)).toBeDefined();
  });

  it("switches to FIRE tab and displays target corpus", () => {
    render(<LifeDecisionLab p1={p1} p2={p2} />);

    fireEvent.click(screen.getByText(/FIRE & Early Retirement/i));
    expect(screen.getByText(/Target FIRE Corpus/i)).toBeDefined();
    expect(screen.getByText(/Years to Financial Independence/i)).toBeDefined();
  });
});
