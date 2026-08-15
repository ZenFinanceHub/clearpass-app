import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearPass Instructors",
  description: "Buy and manage learner seats",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
