import type { Metadata } from "next";
import RedeemClient from "./RedeemClient";
import type { SeatStatusResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://clearpass-app-production.up.railway.app";

const DEFAULT_TITLE = "Your instructor has given you ClearPass Pro";
const DEFAULT_DESCRIPTION = "Set up your account to claim 90 days of ClearPass Pro — free hazard perception, mock tests and more.";

// Personalises the WhatsApp/social preview with the instructor's name when
// we can fetch it (same read-only GET /api/seats/:token the client uses,
// see RedeemClient.tsx — this never consumes the token either). Falls back
// to generic copy on any failure: an unreachable proxy or an invalid token
// must never break the page from rendering, just make its preview less
// specific.
export async function generateMetadata({ params }: PageProps<"/redeem/[token]">): Promise<Metadata> {
  const { token } = await params;
  let title = DEFAULT_TITLE;

  try {
    const res = await fetch(`${API_URL}/api/seats/${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as SeatStatusResponse;
      if (data.valid && data.instructorName) {
        title = `${data.instructorName} has given you ClearPass Pro`;
      }
    }
  } catch {
    // Preview falls back to generic copy — see DEFAULT_TITLE above.
  }

  return {
    title,
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      title,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: "https://instructors.getclearpass.co.uk/og-redeem.png", width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: DEFAULT_DESCRIPTION,
      images: ["https://instructors.getclearpass.co.uk/og-redeem.png"],
    },
  };
}

export default async function RedeemPage({ params }: PageProps<"/redeem/[token]">) {
  const { token } = await params;
  return <RedeemClient token={token} />;
}
