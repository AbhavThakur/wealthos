import { describe, it, expect } from "vitest";
import { parsePayslipText } from "./payslipParser";

describe("parsePayslipText", () => {
  it("extracts common salary components with plain labels", () => {
    const text = `
      Basic Salary        96,545.00
      HRA                 38,618.00
      LTA                 8,045.00
      Special Allowance   84,572.00
      Communication Allowance 2,000.00
    `;
    expect(parsePayslipText(text)).toEqual({
      basicSalary: 96545,
      hra: 38618,
      lta: 8045,
      specialAllowance: 84572,
      communicationAllowance: 2000,
    });
  });

  it("matches HRA/LTA/NPS by full name too", () => {
    const text = `
      House Rent Allowance: 40000
      Leave Travel Allowance: 5000
      National Pension Scheme: 5500
    `;
    expect(parsePayslipText(text)).toEqual({
      hra: 40000,
      lta: 5000,
      nps: 5500,
    });
  });

  it("ignores lines with no trailing amount", () => {
    expect(parsePayslipText("Basic Salary\nEmployee Name: John Doe")).toEqual(
      {},
    );
  });

  it("returns empty object for empty/undefined input", () => {
    expect(parsePayslipText("")).toEqual({});
    expect(parsePayslipText(undefined)).toEqual({});
  });

  it("keeps the first match when a field appears more than once", () => {
    const text = "Basic Salary 50000\nBasic Pay Arrears 2000";
    expect(parsePayslipText(text).basicSalary).toBe(50000);
  });
});
