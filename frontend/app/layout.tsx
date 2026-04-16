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
        <nav className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-14 flex flex-wrap items-center justify-between gap-y-2 py-2 sm:py-0">
            <Link href="/" className="text-xl font-black tracking-tight shrink-0">
              <span className="text-violet-400">Clip</span>Sphere
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/feed"
                className="text-sm font-medium text-zinc-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                Feed
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-300 hover:text-white px-3 py-2 rounded-lg transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="text-sm font-semibold text-violet-300 hover:text-white px-3 py-2 rounded-lg border border-violet-500/40 hover:bg-violet-500/10 transition-colors"
              >
                Sign up
              </Link>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <span aria-hidden>＋</span> Upload
              </Link>
            </div>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}
