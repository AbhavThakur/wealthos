import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TripSyncModal from "./TripSyncModal.jsx";

// Mock fetch for Supabase
const mockSupabaseTrips = [
  {
    id: "vietnam-dec-2026",
    data: {
      title: "Vietnam Master Expedition",
      startDate: "2026-12-03",
      budget: { total: 406000, items: [] },
    },
  },
];

describe("TripSyncModal Component", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSupabaseTrips,
    });
  });

  it("renders when open and displays integration tabs", async () => {
    render(
      <TripSyncModal
        open={true}
        onClose={vi.fn()}
        expenses={[]}
        sharedTrips={[]}
        updatePerson={vi.fn()}
        updateShared={vi.fn()}
      />,
    );

    expect(screen.getByText(/Trip Architecture Sync/i)).toBeDefined();
    expect(screen.getByText(/⚡ Supabase Cloud/i)).toBeDefined();
    expect(screen.getByText(/Manual JSON/i)).toBeDefined();
    expect(screen.getByText(/Export JSON/i)).toBeDefined();
    expect(screen.getByText(/Webhook API/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/Connected to/i)).toBeDefined();
    });
  });

  it("switches to Manual JSON tab, loads sample payload and enables import button", () => {
    const updateSharedMock = vi.fn();
    render(
      <TripSyncModal
        open={true}
        onClose={vi.fn()}
        expenses={[]}
        sharedTrips={[]}
        updatePerson={vi.fn()}
        updateShared={updateSharedMock}
      />,
    );

    // Switch to Manual JSON tab
    fireEvent.click(screen.getByText(/Manual JSON/i));

    // Click Load sample payload
    fireEvent.click(screen.getByText(/Load sample payload/i));

    // Should render preview with trip details
    expect(screen.getByText(/✈️ Goa Beach Holiday/i)).toBeDefined();

    // Click Import button
    const importBtn = screen.getByRole("button", {
      name: /Import to WealthOS/i,
    });
    fireEvent.click(importBtn);

    expect(updateSharedMock).toHaveBeenCalledTimes(1);
    expect(updateSharedMock).toHaveBeenCalledWith(
      "trips",
      expect.any(Function),
    );
  });
  it("renders Split Mode toggle defaulting to Mode A and allows switching to Mode B", async () => {
    render(
      <TripSyncModal
        open={true}
        onClose={vi.fn()}
        expenses={[]}
        sharedTrips={[]}
        updatePerson={vi.fn()}
        updateShared={vi.fn()}
      />
    );

    expect(screen.getByText(/Mode A \(Our Share Only\)/i)).toBeDefined();
    expect(screen.getByText(/Mode B: Full Total/i)).toBeDefined();

    const modeBBtn = screen.getByRole("button", { name: /Mode B: Full Total/i });
    fireEvent.click(modeBBtn);
    expect(screen.getByText(/Mode B \(Full Cost\)/i)).toBeDefined();
  });

  it("automatically switches view month when importing a trip belonging to a future month", async () => {
    const updateSharedMock = vi.fn();
    const onSelectMonthMock = vi.fn();

    render(
      <TripSyncModal
        open={true}
        onClose={vi.fn()}
        expenses={[]}
        sharedTrips={[]}
        updatePerson={vi.fn()}
        updateShared={updateSharedMock}
        currentMonth="2026-04"
        onSelectMonth={onSelectMonthMock}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Vietnam Master Expedition/i)).toBeDefined();
    });

    // Click Import as Shared Trip
    const importBtn = screen.getByRole("button", { name: /Import as Shared Trip/i });
    fireEvent.click(importBtn);

    expect(updateSharedMock).toHaveBeenCalledTimes(1);
    // Should trigger month switch to 2026-12 (trip start date)
    expect(onSelectMonthMock).toHaveBeenCalledWith("2026-12");
  });
});
