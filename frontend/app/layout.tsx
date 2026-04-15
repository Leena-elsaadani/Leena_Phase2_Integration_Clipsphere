import './globals.css';
import Link from 'next/link';
import { ReactNode } from 'react';

export const metadata = {
  title: 'ClipSphere',
  description: 'Share short videos with the world',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 min-h-screen">
        {/* ── Nav ── */}
        <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl font-black tracking-tight">
              <span className="text-violet-400">Clip</span>Sphere
            </Link>
            <Link
              href="/upload"
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <span>＋</span> Upload
            </Link>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}