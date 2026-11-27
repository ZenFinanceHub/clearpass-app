import { describe, expect, it } from "vitest";
import { assertBackendAllowed, backendProblems } from "./backendGuard";

const PROD_SUPABASE = "https://secavejbaapapvvqbwed.supabase.co";
const PROD_API = "https://clearpass-app-production.up.railway.app";
const prod = { NEXT_PUBLIC_SUPABASE_URL: PROD_SUPABASE, NEXT_PUBLIC_API_URL: PROD_API };
const staging = {
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref.supabase.co",
  NEXT_PUBLIC_API_URL: "https://clearpass-staging.up.railway.app",
};

describe("backendGuard", () => {
  it("Vercel production must declare NEXT_PUBLIC_APP_ENV=production explicitly", () => {
    expect(backendProblems({ VERCEL_ENV: "production", ...prod })).toHaveLength(1);
    expect(backendProblems({ VERCEL_ENV: "production", NEXT_PUBLIC_APP_ENV: "staging", ...prod })).toHaveLength(1);
    expect(backendProblems({ VERCEL_ENV: "production", NEXT_PUBLIC_APP_ENV: "production", ...prod })).toEqual([]);
  });

  it("refuses production values in Vercel preview and development builds, with no override", () => {
    for (const VERCEL_ENV of ["preview", "development"]) {
      expect(backendProblems({ VERCEL_ENV, ...prod })).toHaveLength(2);
      expect(backendProblems({ VERCEL_ENV, NEXT_PUBLIC_APP_ENV: "production", ...prod })).toHaveLength(2);
    }
  });

  it("refuses a single production value mixed with staging", () => {
    expect(backendProblems({ VERCEL_ENV: "preview", ...staging, NEXT_PUBLIC_API_URL: PROD_API })).toEqual([
      "NEXT_PUBLIC_API_URL points at production in a Vercel preview build",
    ]);
  });

  it("allows staging values in a preview build", () => {
    expect(backendProblems({ VERCEL_ENV: "preview", ...staging })).toEqual([]);
  });

  it("on a developer machine, refuses production unless NEXT_PUBLIC_APP_ENV=production", () => {
    expect(backendProblems(prod)).toHaveLength(2);
    expect(backendProblems({ NEXT_PUBLIC_APP_ENV: "production", ...prod })).toEqual([]);
    expect(backendProblems({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321" })).toEqual([]);
  });

  it("leaves missing values to lib/supabase.ts (runtime throw)", () => {
    expect(backendProblems({ VERCEL_ENV: "preview" })).toEqual([]);
  });

  it("assertBackendAllowed throws with the variable names", () => {
    expect(() => assertBackendAllowed({ VERCEL_ENV: "preview", ...prod })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
