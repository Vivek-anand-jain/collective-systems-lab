import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Collective Systems Lab",
  description:
    "A first-principles, production-grade course on distributed GPU collective communication.",
  icons: {
    icon: `${siteUrl}/favicon.png`,
    shortcut: `${siteUrl}/favicon.png`,
  },
  openGraph: {
    title: "Collective Systems Lab",
    description:
      "Learn distributed GPU communication from first principles to production systems.",
    type: "website",
    images: [{ url: `${siteUrl}/og.png`, width: 1672, height: 941, alt: "Collective Systems Lab course preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Collective Systems Lab",
    description:
      "Interactive lessons, algorithms, performance labs, and production engineering.",
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
