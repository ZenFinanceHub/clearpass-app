// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// VerificationCard imports the real @/lib/supabase, which throws at import
// time without NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and would otherwise make a
// real auth call — stubbed here to a fixed session so the component's own
// GET (mocked via fetch below) is the only thing under test.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "test-token" } } }),
    },
  },
}));

import VerificationCard from "./VerificationCard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockNoneStatusFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: "none", licenceType: null, submittedAt: null, reviewNote: null }),
    }))
  );
}

describe("VerificationCard — declaration checkbox gates the submit button", () => {
  test("submit is disabled until the declaration is ticked, then enabled", async () => {
    mockNoneStatusFetch();
    render(<VerificationCard />);

    const submitButton = await screen.findByRole("button", { name: /submit/i });
    expect(submitButton).toBeDisabled();

    const declarationCheckbox = screen.getByRole("checkbox");
    await userEvent.click(declarationCheckbox);

    await waitFor(() => expect(submitButton).not.toBeDisabled());
  });

  test("unticking the declaration disables submit again", async () => {
    mockNoneStatusFetch();
    render(<VerificationCard />);

    const submitButton = await screen.findByRole("button", { name: /submit/i });
    const declarationCheckbox = screen.getByRole("checkbox");

    await userEvent.click(declarationCheckbox);
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    await userEvent.click(declarationCheckbox);
    await waitFor(() => expect(submitButton).toBeDisabled());
  });
});
