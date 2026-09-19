import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import Providers from "./providers";
import SocketProvider from "./providers/SocketProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Genetix - AI Website Builder",
  description: "Build websites with AI in minutes",

  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },

  openGraph: {
    title: "Genetix - AI Website Builder",
    description: "Build websites with AI in minutes",
    images: [{ url: "/logo.png" }],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Genetix - AI Website Builder",
    description: "Build websites with AI in minutes",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <SocketProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
          </SocketProvider>
        </Providers>
      </body>
    </html>
  );
}