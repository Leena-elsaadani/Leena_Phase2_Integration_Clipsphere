import { NextRequest, NextResponse } from 'next/server';

/**
 * JWT is set by the API on localhost:5000 (httpOnly). The browser still sends it on
 * fetch(..., { credentials: 'include' }) to the API, but that cookie is often not
 * present on document requests to localhost:3000, so a hard redirect here would
 * loop / block /admin and /upload even when useAuth() is valid. Auth is enforced
 * by the Express protect middleware; pages add client-side guards where needed.
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Protected routes that require auth via `token` cookie set by the backend.
  const protectedRoutes = ['/upload', '/profile', '/admin'];
  const isProtectedRoute = protectedRoutes.some((route) =>
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
  matcher: ['/profile/:path*', '/upload/:path*', '/admin/:path*'],
};