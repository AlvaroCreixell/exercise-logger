import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title and description when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete routine?"
        description="This cannot be undone."
        confirmText="Delete"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText("Delete routine?")).toBeVisible();
    expect(screen.getByText("This cannot be undone.")).toBeVisible();
  });

  it("calls async onConfirm and shows pending state", async () => {
    const user = userEvent.setup();
    let resolve: () => void;
    const onConfirm = vi.fn(
      () => new Promise<void>((r) => { resolve = r; })
    );
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Clear data?"
        description="All data will be lost."
        confirmText="Clear"
        onConfirm={onConfirm}
        variant="destructive"
      />
    );
    const btn = screen.getByRole("button", { name: "Clear" });
    await user.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
    resolve!();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("calls sync onConfirm and closes immediately", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Finish?"
        description="Are you sure?"
        confirmText="Finish"
        onConfirm={onConfirm}
      />
    );
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("requires two clicks when doubleConfirm is true", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Discard?"
        description="All data will be lost."
        confirmText="Discard"
        onConfirm={onConfirm}
        variant="destructive"
        doubleConfirm
        doubleConfirmText="Tap again to confirm"
      />
    );
    const btn = screen.getByRole("button", { name: "Discard" });
    await user.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Tap again to confirm")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Tap again to confirm" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={() => {}}
        title="Hidden"
        description="Should not appear"
        confirmText="OK"
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
