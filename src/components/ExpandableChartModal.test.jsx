import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpandableChartModal from "./ExpandableChartModal";

describe("ExpandableChartModal", () => {
  it("does not render when isOpen is false", () => {
    render(
      <ExpandableChartModal isOpen={false} onClose={() => {}}>
        <div>Chart Content</div>
      </ExpandableChartModal>
    );
    expect(screen.queryByText("Chart Content")).toBeNull();
  });

  it("renders children, title, and zoom controls when open", () => {
    const handleClose = vi.fn();
    render(
      <ExpandableChartModal isOpen={true} onClose={handleClose} title="Custom Fullscreen Title">
        <div>Chart Content Inside</div>
      </ExpandableChartModal>
    );

    expect(screen.getByText("Custom Fullscreen Title")).toBeDefined();
    expect(screen.getByText("Chart Content Inside")).toBeDefined();
    expect(screen.getByText("100%")).toBeDefined();

    // Test Zoom In
    const zoomInBtn = screen.getByTitle("Zoom In (+)");
    fireEvent.click(zoomInBtn);
    expect(screen.getByText("115%")).toBeDefined();

    // Test Close
    const closeBtn = screen.getByLabelText("Close expanded view");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
