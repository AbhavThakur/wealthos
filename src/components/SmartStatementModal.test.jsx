import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SmartStatementModal from "./SmartStatementModal";

describe("SmartStatementModal Component", () => {
  const p1 = {
    transactions: [
      { id: 1, date: "2026-08-14", desc: "Swiggy lunch", amount: -480 },
    ],
  };
  const p2 = { transactions: [] };

  it("renders statement upload dropzone", () => {
    render(
      <SmartStatementModal
        open={true}
        onClose={vi.fn()}
        p1={p1}
        p2={p2}
        personNames={{ p1: "Abhav", p2: "Aanya" }}
        updatePerson={vi.fn()}
      />
    );

    expect(screen.getByText(/Smart Bank Statement Ingestion/i)).toBeDefined();
    expect(screen.getByText(/Load 7 Sample Bank Transactions/i)).toBeDefined();
  });

  it("processes bank statement, flags duplicates and imports selected transactions", () => {
    const updatePersonMock = vi.fn();
    render(
      <SmartStatementModal
        open={true}
        onClose={vi.fn()}
        p1={p1}
        p2={p2}
        personNames={{ p1: "Abhav", p2: "Aanya" }}
        updatePerson={updatePersonMock}
      />
    );

    // Click load sample statement
    fireEvent.click(screen.getByText(/Load 7 Sample Bank Transactions/i));

    // Verify duplicate warning badge appears
    expect(screen.getByText(/duplicate.*skipped/i)).toBeDefined();

    // Click Import button
    const importBtn = screen.getByRole("button", { name: /Import .* Transactions into Abhav/i });
    fireEvent.click(importBtn);

    expect(updatePersonMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Statement Imported Successfully/i)).toBeDefined();
  });
});
