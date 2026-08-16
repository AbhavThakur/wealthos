import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GoogleSheetsConnect from "./GoogleSheetsConnect";
import * as useGoogleSheetsModule from "../hooks/useGoogleSheets";
import * as DataContextModule from "../context/DataContext";

vi.mock("../hooks/useGoogleSheets");
vi.mock("../context/DataContext");

describe("GoogleSheetsConnect Component", () => {
  const mockDataContext = {
    p1: {},
    p2: {},
    shared: {},
    personNames: { p1: "Abhav", p2: "Aanya" },
  };

  it("renders disconnected state with AI-Optimized badge and Connect button", () => {
    vi.spyOn(DataContextModule, "useData").mockReturnValue(mockDataContext);
    vi.spyOn(useGoogleSheetsModule, "useGoogleSheets").mockReturnValue({
      integration: null,
      connected: false,
      loading: false,
      syncing: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      syncAll: vi.fn(),
      pull: vi.fn(),
    });

    render(<GoogleSheetsConnect />);
    expect(screen.getByText("Google Sheets")).toBeDefined();
    expect(screen.getByText(/AI-Optimized/i)).toBeDefined();
    expect(screen.getByText("Connect Google Sheets")).toBeDefined();
    expect(screen.getByText(/AI-ready structured format/i)).toBeDefined();
  });

  it("renders connected state with 7 tabs breakdown and Gemini AI Prompts toggle", () => {
    const mockSyncAll = vi.fn().mockResolvedValue(42);
    vi.spyOn(DataContextModule, "useData").mockReturnValue(mockDataContext);
    vi.spyOn(useGoogleSheetsModule, "useGoogleSheets").mockReturnValue({
      integration: {
        spreadsheetId: "test-sheet-id",
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/test",
        sheetTitle: "WealthOS Finance [DEV]",
        connectedAt: "2026-08-16T12:00:00Z",
      },
      connected: true,
      loading: false,
      syncing: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      syncAll: mockSyncAll,
      pull: vi.fn(),
    });

    render(<GoogleSheetsConnect />);
    expect(screen.getByText("Connected")).toBeDefined();
    expect(screen.getByText("Gemini AI Ready")).toBeDefined();
    expect(screen.getByText("DEV SHEET")).toBeDefined();
    expect(screen.getByText("Sync All (7 AI Tabs)")).toBeDefined();

    // Check tabs breakdown list
    expect(screen.getByText("Monthly_Summary")).toBeDefined();
    expect(screen.getByText("All_Transactions")).toBeDefined();
    expect(screen.getByText("Budget_vs_Actual")).toBeDefined();
    expect(screen.getByText("Investments_&_Assets")).toBeDefined();
    expect(screen.getByText("Goals_Tracker")).toBeDefined();
    expect(screen.getByText("Net_Worth_History")).toBeDefined();
    expect(screen.getByText("AI_Prompts_&_Formulas")).toBeDefined();

    // Toggle Gemini AI Prompts accordion
    const promptsBtn = screen.getByText("Gemini AI Prompts");
    fireEvent.click(promptsBtn);
    expect(screen.getByText("Executive Month Review")).toBeDefined();
    expect(screen.getByText("Find Spending Leaks")).toBeDefined();
  });
});
