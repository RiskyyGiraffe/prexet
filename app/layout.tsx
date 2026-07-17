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
  metadataBase: new URL("https://prexet.com"),
  title: "prexet.com",
  description: "Document response CRM for professional Word review workflows.",
  openGraph: {
    title: "prexet.com",
    description: "Document response, resolved.",
    type: "website",
    images: [{
      url: "/og.png",
      width: 1200,
      height: 628,
      alt: "prexet.com — Document response, resolved.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "prexet.com",
    description: "Document response, resolved.",
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
