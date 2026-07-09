import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} ${jakarta.variable} font-sans bg-bg text-ink selection:bg-primary selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
