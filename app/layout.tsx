import type { Metadata } from "next";
import { Fira_Sans, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/lib/trpc/client";
import { LanguageProvider } from "@/features/i18n";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import "./globals.css";

const firaSans = Fira_Sans({
  variable: "--font-fira-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VietMealFit",
  description: "Personalized meal planning, exercise routines, and Vietnamese nutrition data.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();

  return (
    <html
      lang={language}
      className={`${firaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider initialLanguage={language}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  );
}
