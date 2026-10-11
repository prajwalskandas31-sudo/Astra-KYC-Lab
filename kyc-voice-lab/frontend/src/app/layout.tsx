import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PrivacyBanner from "@/components/PrivacyBanner";

export const metadata: Metadata = {
  title: "KYC Voice Lab — Local Verification PoC",
  description:
    "Local-first automated KYC voice verification proof of concept using faster-whisper, FastAPI, and Next.js.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        <PrivacyBanner />
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
          <p>
            KYC Voice Lab Proof of Concept • Local Speech-to-Text Verification • Fully Offline Execution
          </p>
        </footer>
      </body>
    </html>
  );
}
