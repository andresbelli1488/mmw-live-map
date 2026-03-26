import type { Metadata } from "next";
import { Libre_Baskerville, Outfit } from "next/font/google";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const libre = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-libre" });

export const metadata: Metadata = {
  title: "MMW 2026 - The Ultimate Guide",
  description: "Miami Music Week 2026 live map with events, pulse feed, promo reveal, and save workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${libre.variable}`} style={{ margin: 0, fontFamily: "var(--font-outfit), sans-serif", background: "#09090b", color: "#f4f4f5" }}>
        {children}
      </body>
    </html>
  );
}
