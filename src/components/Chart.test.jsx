/**
 * Component tests for Chart.jsx — stability and render tests.
 * These tests would have caught the freeze bugs we fixed.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Chart, DonutChart } from "./Chart";

// Mock ECharts to avoid canvas/WebGL issues in jsdom
// Use named functions to satisfy Vitest's function/class requirement
vi.mock("echarts/core", () => ({
  use: function use() {},
  init: function init() {
    return {
      setOption: function setOption() {},
      resize: function resize() {},
      dispose: function dispose() {},
      isDisposed: function isDisposed() {
        return false;
      },
    };
  },
  getInstanceByDom: function getInstanceByDom() {
    return null;
  },
  graphic: {
    LinearGradient: function LinearGradient(x0, y0, x1, y1, stops) {
      return { stops };
    },
  },
}));

vi.mock("echarts/charts", () => ({
  BarChart: Symbol("BarChart"),
  LineChart: Symbol("LineChart"),
  PieChart: Symbol("PieChart"),
}));

vi.mock("echarts/components", () => ({
  GridComponent: Symbol("GridComponent"),
  TooltipComponent: Symbol("TooltipComponent"),
  LegendComponent: Symbol("LegendComponent"),
  DatasetComponent: Symbol("DatasetComponent"),
}));

vi.mock("echarts/renderers", () => ({
  CanvasRenderer: Symbol("CanvasRenderer"),
}));

describe("Chart component", () => {
  const defaultProps = {
    categories: ["Jan", "Feb", "Mar"],
    series: [
      {
        name: "Income",
        type: "bar",
        data: [1000, 2000, 3000],
        color: "#4caf82",
      },
    ],
  };

  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    const { container } = render(<Chart {...defaultProps} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("handles multiple series (combo chart)", () => {
    const props = {
      categories: ["Jan", "Feb", "Mar"],
      series: [
        {
          name: "Income",
          type: "bar",
          data: [1000, 2000, 3000],
          color: "#4caf82",
        },
        {
          name: "Expense",
          type: "bar",
          data: [800, 1500, 2500],
          color: "#e05c5c",
        },
        { name: "Net", type: "line", data: [200, 500, 500], color: "#c9a84c" },
      ],
    };
    const { container } = render(<Chart {...props} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("handles area chart type", () => {
    const props = {
      categories: ["Jan", "Feb", "Mar"],
      series: [
        {
          name: "Balance",
          type: "area",
          data: [5000, 6000, 7000],
          color: "#4caf82",
        },
      ],
    };
    const { container } = render(<Chart {...props} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("survives mount → unmount → remount cycle (freeze bug test)", () => {
    // This test would have caught the Dashboard freeze bug
    const { container, unmount } = render(<Chart {...defaultProps} />);
    expect(container.querySelector("div")).toBeTruthy();

    // Unmount (navigate away)
    unmount();

    // Remount (navigate back) - this caused the freeze
    const { container: container2 } = render(<Chart {...defaultProps} />);
    expect(container2.querySelector("div")).toBeTruthy();
  });

  it("handles rapid re-renders without freezing", () => {
    const { rerender } = render(<Chart {...defaultProps} />);

    // Simulate rapid re-renders (10 times)
    for (let i = 0; i < 10; i++) {
      rerender(
        <Chart
          {...defaultProps}
          series={[
            {
              name: "Income",
              type: "bar",
              data: [1000 + i, 2000 + i, 3000 + i],
              color: "#4caf82",
            },
          ]}
        />,
      );
    }
    // If we get here without hanging, the test passes
    expect(true).toBe(true);
  });

  it("handles empty data gracefully", () => {
    const props = {
      categories: [],
      series: [],
    };
    const { container } = render(<Chart {...props} />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});

describe("DonutChart component", () => {
  const defaultProps = {
    data: [
      { name: "Food", value: 5000, color: "#f97316" },
      { name: "Transport", value: 3000, color: "#22d3ee" },
      { name: "Rent", value: 10000, color: "#a78bfa" },
    ],
  };

  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    const { container } = render(<DonutChart {...defaultProps} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("survives mount → unmount → remount cycle", () => {
    const { container, unmount } = render(<DonutChart {...defaultProps} />);
    expect(container.querySelector("div")).toBeTruthy();
    unmount();
    const { container: container2 } = render(<DonutChart {...defaultProps} />);
    expect(container2.querySelector("div")).toBeTruthy();
  });

  it("handles legend prop", () => {
    const { container } = render(<DonutChart {...defaultProps} legend />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("handles empty data", () => {
    const { container } = render(<DonutChart data={[]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});
