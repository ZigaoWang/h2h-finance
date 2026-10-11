import { describe, expect, it } from "vitest";
import { centsToDecimal, formatMoney, parseMoney } from "./money";

describe("money", () => {
  it("formats fen as yuan", () => {
    expect(formatMoney(123450)).toBe("¥1,234.50");
    expect(formatMoney(5)).toBe("¥0.05");
    expect(formatMoney(-2500)).toBe("-¥25.00");
  });

  it("parses what people type", () => {
    expect(parseMoney("25")).toBe(2500);
    expect(parseMoney("25.5")).toBe(2550);
    expect(parseMoney(" ¥1,234.56 ")).toBe(123456);
    expect(parseMoney("0.10")).toBe(10);
  });

  it("rejects anything that isn't a positive amount", () => {
    for (const bad of ["", "0", "0.00", "-5", "1.234", "abc", "1e3"]) {
      expect(parseMoney(bad)).toBeNull();
    }
  });

  it("round-trips through the decimal form", () => {
    expect(centsToDecimal(108640)).toBe("1086.40");
    expect(parseMoney(centsToDecimal(108640))).toBe(108640);
  });
});
