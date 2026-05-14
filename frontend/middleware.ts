import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // Protected routes that require authentication
  const protectedRoutes = ['/upload', '/profile', '/admin', '/settings'];
  
  const isProtectedRoute = protectedRoutes.some(route => 
    url.pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    const token = req.cookies.get('token')?.value;
    
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', url.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/upload/:path*', '/admin/:path*', '/settings/:path*'],
};