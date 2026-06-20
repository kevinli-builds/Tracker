import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tracker",
  description: "Tap to log anything — drinks, habits, anything — and see your calendar and stats.",
};

// viewportFit: 'cover' is required for env(safe-area-inset-*) to resolve on
// notched/home-indicator iPhones (used by the floating Add button).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f9",
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
