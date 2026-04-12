import { NextRequest, NextResponse } from 'next/server';

// Protected routes — redirect to login if no token cookie
const protectedRoutes = ['/profile', '/upload', '/admin'];

export function middleware(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const { pathname } = req.nextUrl;

  const isProtected = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/upload/:path*', '/admin/:path*'],
};