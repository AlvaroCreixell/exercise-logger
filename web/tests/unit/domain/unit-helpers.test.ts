import { describe, it, expect } from "vitest";
import { getEffectiveUnit } from "@/domain/unit-helpers";

describe("getEffectiveUnit", () => {
  it("returns unitOverride when not null", () => {
    expect(getEffectiveUnit("lbs", "kg")).toBe("lbs");
  });

  it("returns globalUnits when unitOverride is null", () => {
    expect(getEffectiveUnit(null, "kg")).toBe("kg");
  });

  it("returns globalUnits when unitOverride is undefined", () => {
    expect(getEffectiveUnit(undefined as never, "lbs")).toBe("lbs");
  });
});
