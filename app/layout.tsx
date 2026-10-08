import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://huntlyst2.vercel.app'),
  title: 'Huntlyst — Find the companies worth knowing.',
  description: 'Autonomous Company Discovery & Lead Intelligence platform that discovers, researches, and validates high-potential technology companies.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Huntlyst — Find the companies worth knowing.',
    description: 'Autonomous Company Discovery & Lead Intelligence platform.',
    images: ['/huntlyst-logo.svg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}