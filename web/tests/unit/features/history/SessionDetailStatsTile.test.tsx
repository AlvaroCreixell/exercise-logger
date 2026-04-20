import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionDetailStatsTile } from "@/features/history/SessionDetailStatsTile";

describe("SessionDetailStatsTile", () => {
  it("renders sets / volume / time", () => {
    render(
      <SessionDetailStatsTile setCount={17} volumeKg={8240} durationMin={52} units="kg" />
    );
    expect(screen.getByText("17")).toBeVisible();
    expect(screen.getByText("8,240 kg")).toBeVisible();
    expect(screen.getByText("52m")).toBeVisible();
    expect(screen.getByText(/sets/i)).toBeVisible();
    expect(screen.getByText(/volume/i)).toBeVisible();
    expect(screen.getByText(/time/i)).toBeVisible();
  });

  it("renders '—' for duration when durationMin is null", () => {
    render(
      <SessionDetailStatsTile setCount={1} volumeKg={0} durationMin={null} units="kg" />
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("renders volume in lbs when units='lbs'", () => {
    render(
      <SessionDetailStatsTile setCount={1} volumeKg={1000} durationMin={30} units="lbs" />
    );
    expect(screen.getByText("2,205 lbs")).toBeVisible();
  });

  it("renders '0 kg' for volume when volumeKg is 0", () => {
    render(
      <SessionDetailStatsTile setCount={1} volumeKg={0} durationMin={30} units="kg" />
    );
    expect(screen.getByText("0 kg")).toBeVisible();
  });
});
