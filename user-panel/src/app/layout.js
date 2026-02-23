import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FCMInit from "./FCMInit";
import NotificationProvider from "./notification-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Hope Homoeopathy",
  description: "Live Token Status – Hope Homoeopathy, Malakpet",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* PWA REQUIRED TAGS */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <FCMInit />
        <NotificationProvider />
        {children}
      </body>
    </html>
  );
}
