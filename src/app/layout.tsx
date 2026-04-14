import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hawki Prompt Manager",
  description: "Gerenciamento de prompts Sofia IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
        <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
      </html>
    </ClerkProvider>
  );
}
