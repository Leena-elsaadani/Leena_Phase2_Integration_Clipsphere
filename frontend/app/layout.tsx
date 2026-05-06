import './globals.css';
import { ReactNode } from 'react';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'ClipSphere',
  description: 'Share short videos with the world',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 min-h-screen">
        <Navbar />

        {children}
      </body>
    </html>
  );
}
