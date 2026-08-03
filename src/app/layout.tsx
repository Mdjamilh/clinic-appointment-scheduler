import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page depends on the signed-in user and live availability.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "CareSlot · Clinic appointment scheduling",
    template: "%s · CareSlot",
  },
  description: "Find a provider, see real-time availability and book, reschedule or cancel clinic visits in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-dvh flex-col antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
          <footer className="border-t">
            <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs sm:flex-row sm:justify-between sm:px-6">
              <p>CareSlot is a portfolio demo. All patients and providers are synthetic — not for clinical use.</p>
              <p>Built with Next.js, PostgreSQL and Drizzle ORM.</p>
            </div>
          </footer>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
