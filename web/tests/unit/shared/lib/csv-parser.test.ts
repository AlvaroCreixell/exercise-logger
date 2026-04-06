import { describe, it, expect } from "vitest";
import { parseCsv } from "@/shared/lib/csv-parser";

describe("parseCsv", () => {
  it("parses a simple CSV with header and data rows", () => {
    const csv = `Name,Type,Equipment
Barbell Back Squat,Weight,Barbell
Leg Curl,Weight,Machine`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Barbell Back Squat", Type: "Weight", Equipment: "Barbell" },
      { Name: "Leg Curl", Type: "Weight", Equipment: "Machine" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseCsv("   \n  \n  ")).toEqual([]);
  });

  it("returns empty array for header-only CSV", () => {
    const csv = "Name,Type,Equipment";
    const result = parseCsv(csv);
    expect(result).toEqual([]);
  });

  it("trims whitespace from headers and values", () => {
    const csv = ` Name , Type , Equipment
 Squat , Bodyweight , Bodyweight `;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight", Equipment: "Bodyweight" },
    ]);
  });

  it("skips empty lines", () => {
    const csv = `Name,Type

Squat,Bodyweight

Plank,Isometric
`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight" },
      { Name: "Plank", Type: "Isometric" },
    ]);
  });

  it("handles values with slashes (not treated as separators)", () => {
    const csv = `Name,Type,Equipment,Muscle Group
Lat Pulldown,Weight,Machine / Cable,Back
Kettlebell Swing,Weight,Kettlebell,Legs / Back`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      {
        Name: "Lat Pulldown",
        Type: "Weight",
        Equipment: "Machine / Cable",
        "Muscle Group": "Back",
      },
      {
        Name: "Kettlebell Swing",
        Type: "Weight",
        Equipment: "Kettlebell",
        "Muscle Group": "Legs / Back",
      },
    ]);
  });

  it("handles Windows-style line endings (CRLF)", () => {
    const csv = "Name,Type\r\nSquat,Bodyweight\r\nPlank,Isometric\r\n";
    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight" },
      { Name: "Plank", Type: "Isometric" },
    ]);
  });

  it("fills missing values with empty string when row has fewer columns", () => {
    const csv = `Name,Type,Equipment
Squat,Bodyweight`;

    const result = parseCsv(csv);
    expect(result).toEqual([
      { Name: "Squat", Type: "Bodyweight", Equipment: "" },
    ]);
  });
});
