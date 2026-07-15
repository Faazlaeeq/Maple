import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SmoothScroll from "../components/SmoothScroll";

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: "Maple | The AI Receptionist for Modern Dental Clinics",
  description: "Never miss a new patient. The AI receptionist that books appointments while you sleep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jakarta.variable} font-sans bg-bg text-ink selection:bg-primary selection:text-white`}>
        <SmoothScroll>
          {children}
        </SmoothScroll>

        {/* Maple Chat Widget Integration */}
        <Script 
          src="https://maple-gray.vercel.app/widget/maple-widget.js" 
          strategy="afterInteractive"
          data-clinic-id="maplewood"
        />
      </body>
    </html>
  );
}
