import type { Metadata } from "next";
import "./globals.css";
import "./mobile-refinements.css";
import "./account.css";
import "./polish.css";
import "./screen-layout.css";
import "./journeys.css";
import "./welcome.css";

export const metadata: Metadata = {
  title: "Digital Samiti · Grow together",
  description: "Save with your people. Build a community savings circle, contribute monthly, and make lending decisions together.",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
