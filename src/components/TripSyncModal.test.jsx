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
});
