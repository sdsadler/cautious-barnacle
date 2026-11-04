import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSEA Fortnite Standings",
  description: "Standings for the MSEA Fortnite league",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#1f1f1f] text-white">
        {children}
      </body>
    </html>
  );
}
