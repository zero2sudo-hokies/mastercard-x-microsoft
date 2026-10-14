import type { Metadata } from "next";
import { Inter } from "next/font/google";
import TopBar from "@/components/ui/TopBar";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monopoly",
  description: "Monopoly prototype",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <TopBar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-6 py-3 text-xs text-muted">
          Prototype for LEAD ASPIRE 2026. Modeled data; not financial advice. No protected attributes are used.
        </footer>
      </body>
    </html>
  );
}
