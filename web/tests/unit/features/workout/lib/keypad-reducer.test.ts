import { describe, it, expect } from "vitest";
import { applyKeypadKey } from "@/features/workout/lib/keypad-reducer";

describe("applyKeypadKey", () => {
  it("appends digits in order", () => {
    expect(applyKeypadKey("", "1")).toBe("1");
    expect(applyKeypadKey("1", "2")).toBe("12");
    expect(applyKeypadKey("12", "0")).toBe("120");
  });

  it("drops a leading zero when a real digit follows", () => {
    // Prevents "07" when the user taps 0 then 7 while the field shows "0" by default.
    expect(applyKeypadKey("0", "7")).toBe("7");
  });

  it("keeps a leading zero before a decimal", () => {
    expect(applyKeypadKey("0", ".")).toBe("0.");
    expect(applyKeypadKey("0.", "5")).toBe("0.5");
  });

  it("ignores a second decimal point", () => {
    expect(applyKeypadKey("1.5", ".")).toBe("1.5");
  });

  it("allows a leading decimal", () => {
    expect(applyKeypadKey("", ".")).toBe("0.");
  });

  it("backspace removes the last character", () => {
    expect(applyKeypadKey("125", "back")).toBe("12");
    expect(applyKeypadKey("1.", "back")).toBe("1");
    expect(applyKeypadKey("1", "back")).toBe("");
  });

  it("backspace on empty string is a no-op", () => {
    expect(applyKeypadKey("", "back")).toBe("");
  });
});

describe("applyKeypadKey: pristine replace", () => {
  it("first digit replaces the whole prefilled value", () => {
    expect(applyKeypadKey("52.5", "1", true)).toBe("1");
    expect(applyKeypadKey("12", "0", true)).toBe("0");
  });

  it("decimal on a pristine value starts fresh as 0.", () => {
    expect(applyKeypadKey("12", ".", true)).toBe("0.");
  });

  it("backspace on a pristine value edits it in place (append mode)", () => {
    expect(applyKeypadKey("12", "back", true)).toBe("1");
  });

  it("pristine=false keeps today's append behavior", () => {
    expect(applyKeypadKey("12", "1", false)).toBe("121");
    expect(applyKeypadKey("12", "1")).toBe("121");
  });
});
