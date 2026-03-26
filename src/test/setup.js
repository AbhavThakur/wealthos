/**
 * Vitest setup file — global mocks and configuration.
 */
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => cleanup());

// Mock ResizeObserver (not available in jsdom) - must be a class
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock Firebase (prevents real network calls during tests)
vi.mock("../firebase", () => ({
  db: {},
  IS_DEV: true,
}));
