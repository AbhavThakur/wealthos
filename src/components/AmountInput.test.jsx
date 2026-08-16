import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AmountInput from "./AmountInput";

describe("AmountInput Component", () => {
  it("renders with Indian formatted commas", () => {
    render(<AmountInput value={1000000} onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    expect(input.value).toBe("10,00,000");
  });

  it("displays verbal words preview badge for Lakhs", () => {
    render(<AmountInput value={500000} onChange={() => {}} />);
    expect(screen.getByText("₹5 Lakhs")).toBeDefined();
  });

  it("calls onChange with numeric value when typing", () => {
    const handleChange = vi.fn();
    render(<AmountInput value="" onChange={handleChange} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "25000" } });
    expect(handleChange).toHaveBeenCalledWith(25000);
  });
});
