import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CASImportModal from "./CASImportModal";

describe("CASImportModal Component", () => {
  const p1 = {
    investments: [
      { id: 1, name: "Parag Parikh Flexi Cap", folio: "12491/88", units: 1000, currentValue: 70000 },
    ],
  };
  const p2 = { investments: [] };

  it("renders upload dropzone and sample CAS loader", () => {
    render(
      <CASImportModal
        open={true}
        onClose={vi.fn()}
        p1={p1}
        p2={p2}
        personNames={{ p1: "Abhav", p2: "Aanya" }}
        updatePerson={vi.fn()}
      />
    );

    expect(screen.getByText(/1-Click CAS eCAS Portfolio Ingestion/i)).toBeDefined();
    expect(screen.getByText(/Load 5 Sample Indian Mutual Funds/i)).toBeDefined();
  });

  it("loads sample CAS and calculates diff preview with 1-click commit", () => {
    const updatePersonMock = vi.fn();
    render(
      <CASImportModal
        open={true}
        onClose={vi.fn()}
        p1={p1}
        p2={p2}
        personNames={{ p1: "Abhav", p2: "Aanya" }}
        updatePerson={updatePersonMock}
      />
    );

    // Click sample load
    fireEvent.click(screen.getByText(/Load 5 Sample Indian Mutual Funds/i));

    // Should transition to review table showing New and Updated holdings
    expect(screen.getByText(/New Holdings/i)).toBeDefined();
    expect(screen.getByText(/Updated Valuations/i)).toBeDefined();

    // Click Import button
    const importBtn = screen.getByRole("button", { name: /Import .* Holdings into Abhav/i });
    expect(importBtn).toBeDefined();
    fireEvent.click(importBtn);

    expect(updatePersonMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Portfolio Synchronized Successfully/i)).toBeDefined();
  });
});
