import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SetLogForm from "@/components/SetLogForm";

describe("SetLogForm", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    effectiveType: "weight" as const,
    effectiveEquipment: "barbell" as const,
    units: "kg" as const,
    prefill: null,
    label: "Barbell Back Squat - Set 1",
    onSubmit: vi.fn(),
  };

  it("shows weight and reps fields for weight type with reps targetKind", () => {
    render(<SetLogForm {...defaultProps} targetKind="reps" />);
    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/duration/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/distance/i)).not.toBeInTheDocument();
  });

  it("shows reps field and optional weight toggle for bodyweight type with reps targetKind", () => {
    render(
      <SetLogForm {...defaultProps} effectiveType="bodyweight" targetKind="reps" />
    );
    // Weight field is not visible until expanded
    expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/reps/i)).toBeInTheDocument();
    // But the "add weight" toggle is present
    expect(screen.getByText(/add weight/i)).toBeInTheDocument();
  });

  it("shows duration field for duration targetKind", () => {
    render(
      <SetLogForm {...defaultProps} effectiveType="isometric" targetKind="duration" />
    );
    expect(screen.queryByLabelText(/weight/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/reps/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
  });

  it("shows distance and duration fields for cardio type without targetKind (extra exercise)", () => {
    render(
      <SetLogForm {...defaultProps} effectiveType="cardio" />
    );
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/distance/i)).toBeInTheDocument();
  });

  it("pre-fills values from prefill prop", () => {
    render(
      <SetLogForm
        {...defaultProps}
        targetKind="reps"
        prefill={{
          performedWeightKg: 80,
          performedReps: 10,
          performedDurationSec: null,
          performedDistanceM: null,
        }}
      />
    );
    expect(screen.getByLabelText(/weight/i)).toHaveValue(80);
    expect(screen.getByLabelText(/reps/i)).toHaveValue(10);
  });

  it("calls onSubmit with parsed values when Save is clicked", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <SetLogForm {...defaultProps} targetKind="reps" onSubmit={onSubmit} />
    );

    await user.type(screen.getByLabelText(/weight/i), "80");
    await user.type(screen.getByLabelText(/reps/i), "10");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0]![0];
    expect(input.performedWeightKg).toBeCloseTo(80, 0);
    expect(input.performedReps).toBe(10);
  });

  it("shows delete button when onDelete is provided", () => {
    render(
      <SetLogForm {...defaultProps} targetKind="reps" onDelete={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("shows tag label when tag is provided", () => {
    render(<SetLogForm {...defaultProps} targetKind="reps" tag="Top" />);
    expect(screen.getByText("(Top)")).toBeInTheDocument();
  });
});
