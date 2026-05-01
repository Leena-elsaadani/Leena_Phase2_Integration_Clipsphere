import { NextRequest, NextResponse } from 'next/server';

/**
 * JWT is set by the API on localhost:5000 (httpOnly). The browser still sends it on
 * fetch(..., { credentials: 'include' }) to the API, but that cookie is often not
 * present on document requests to localhost:3000, so a hard redirect here would
 * loop / block /admin and /upload even when useAuth() is valid. Auth is enforced
 * by the Express protect middleware; pages add client-side guards where needed.
 */
export function middleware(req: NextRequest) {
  // Keep home and all app routes publicly reachable on first load.
  // Auth-protected API behavior and page-level guards handle protected actions.
  void req;
  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/upload/:path*', '/admin/:path*'],
};