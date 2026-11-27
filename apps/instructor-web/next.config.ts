import type { NextConfig } from "next";
import { assertBackendAllowed } from "./lib/backendGuard";

// Fail closed: a preview or local build must never be wired to the
// production backend by accident. See lib/backendGuard.ts.
assertBackendAllowed(process.env);

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
