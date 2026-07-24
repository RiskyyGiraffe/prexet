import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.prexet.com"),
  title: "Prexet",
  description: "Prexet is a document outreach and redlining workspace for managing recipients, project stages, Word documents, email drafts, and approved Gmail sends.",
  openGraph: {
    title: "Prexet",
    description: "Document outreach, redlining, and approved email sending in one workspace.",
    type: "website",
    images: [{
      url: "/og.png",
      width: 1200,
      height: 628,
      alt: "Prexet — document outreach and redlining workspace.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prexet",
    description: "Document outreach, redlining, and approved email sending in one workspace.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-hidden">{children}</body>
    </html>
  );
}
