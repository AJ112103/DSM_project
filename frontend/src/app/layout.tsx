import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Sidebar from "./sidebar";
import Providers from "./providers";
import AgentSheet from "@/components/AgentSheet";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "WACMR — India's Interbank Rate, Forecast",
  description:
    "A 545-week investigation into India's Weighted Average Call Money Rate. Regime clustering, XGBoost walk-forward forecasting, SHAP explanations, a policy counterfactual simulator, and a Gemini-powered research agent.",
  openGraph: {
    title: "WACMR — India's Interbank Rate, Forecast",
    description:
      "A data-science investigation into the heartbeat of Indian monetary policy.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-950 text-slate-100">
        <Providers>
          <Sidebar />
          <main className="ml-0 min-h-screen transition-all duration-300 lg:ml-60">
            {/* pt-16 on mobile reserves vertical space for the fixed hamburger
                button (left-3 top-3, 40px). lg: drops back to standard padding. */}
            <div className="px-4 pb-4 pt-16 sm:px-6 sm:pb-6 lg:p-8">{children}</div>
          </main>
          <AgentSheet />
        </Providers>
      </body>
    </html>
  );
}
