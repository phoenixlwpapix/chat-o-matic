import { describe, expect, it } from "vitest";
import { calculateQuizExpression } from "./quiz-calculator";

describe("quiz arithmetic", () => {
  it("computes the reported work-rate problem independently", () => {
    expect(calculateQuizExpression("(1-(1/12+1/15)*4)/(1/12)")).toBeCloseTo(4.8, 12);
  });
  it.each([["2+3*4", 14], ["(2+3)*4", 20], ["2^3^2", 512], ["-2^2", -4], ["2^-2", 0.25], [".5+1e-2", 0.51], ["(-2)^2", 4]])("evaluates %s with mathematical precedence", (expression, value) => {
    expect(calculateQuizExpression(expression)).toBeCloseTo(value, 12);
  });
  it.each(["1/0", "(1+2", "1 2", "1e", "2**3", "NaN", "Infinity", "process.exit()", "1;2", "2^1001", "", "1e999", "9".repeat(301)])("rejects unsafe or invalid expressions: %s", (expression) => {
    expect(() => calculateQuizExpression(expression)).toThrow();
  });
});
