import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracker",
  description: "Tap to log anything — drinks, habits, anything — and see your calendar and stats.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <body>{children}</body>
    </html>
  );
}
