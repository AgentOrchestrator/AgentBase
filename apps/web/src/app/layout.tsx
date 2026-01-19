import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Agent Base - Your AI Coding Companions, Connected',
  description:
    'Aggregate chat histories from AI coding assistants like Claude Code, Cursor, and VSCode. AI-powered summaries for team collaboration.',
  openGraph: {
    title: 'Agent Base - Your AI Coding Companions, Connected',
    description:
      'Aggregate chat histories from AI coding assistants like Claude Code, Cursor, and VSCode. AI-powered summaries for team collaboration.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
