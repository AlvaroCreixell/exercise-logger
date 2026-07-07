import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LlmKeyCard } from "@/features/settings/LlmKeyCard";

vi.mock("@/services/settings-service", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  setLlmApiKey: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/llm/anthropic-provider", () => ({
  testAnthropicKey: vi.fn().mockResolvedValue({ ok: true, message: "Connected — key works." }),
}));

import { setLlmApiKey } from "@/services/settings-service";
import { testAnthropicKey } from "@/services/llm/anthropic-provider";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LlmKeyCard", () => {
  it("shows 'Not set' when no key is configured", () => {
    render(<LlmKeyCard llmApiKey="" />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("masks a configured key", () => {
    render(<LlmKeyCard llmApiKey="sk-ant-abc123xyz789" />);
    expect(screen.getByText(/•+…789/)).toBeInTheDocument();
    expect(screen.queryByText("sk-ant-abc123xyz789")).not.toBeInTheDocument();
  });

  it("saves an entered key", async () => {
    const user = userEvent.setup();
    render(<LlmKeyCard llmApiKey="" />);
    await user.click(screen.getByText("Not set"));
    await user.type(screen.getByLabelText("Anthropic API key"), "sk-ant-new-key");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(setLlmApiKey).toHaveBeenCalledWith(expect.anything(), "sk-ant-new-key");
  });

  it("runs the connection test and shows the result", async () => {
    const user = userEvent.setup();
    render(<LlmKeyCard llmApiKey="sk-ant-abc123xyz789" />);
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    expect(testAnthropicKey).toHaveBeenCalledWith("sk-ant-abc123xyz789");
    expect(await screen.findByText("Connected — key works.")).toBeInTheDocument();
  });
});
