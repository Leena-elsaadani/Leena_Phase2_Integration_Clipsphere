import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'ClipSphere',
  description: 'Short video social platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  );
}