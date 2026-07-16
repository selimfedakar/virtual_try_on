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
  metadataBase: new URL("https://virtual-try-on-three-sage.vercel.app"),
  title: {
    default: "VTO — Virtual Try-On",
    template: "%s — VTO Virtual Try-On",
  },
  description:
    "See how clothes look on you before you buy. VTO is an AI-powered virtual try-on app for iPhone with an AI stylist, fit analysis, and a digital closet.",
  openGraph: {
    title: "VTO — Virtual Try-On",
    description:
      "See how clothes look on you before you buy. AI-powered virtual try-on for iPhone.",
    url: "https://virtual-try-on-three-sage.vercel.app",
    siteName: "VTO — Virtual Try-On",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VTO — Virtual Try-On",
    description:
      "See how clothes look on you before you buy. AI-powered virtual try-on for iPhone.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
