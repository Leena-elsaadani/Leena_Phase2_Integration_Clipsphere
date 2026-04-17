const API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:5000/api/v1';

/**
 * Fetch helper: sends cookies to the Express API (JWT httpOnly cookie)
 * (backend sets `token` httpOnly cookie).
 */
export const api = async (endpoint: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const body = data as { message?: string; errors?: { message: string }[] };
    if (body.errors?.length) {
      throw new Error(body.errors.map((e) => e.message).join('; ') || body.message || 'Validation failed');
    }
    throw new Error(body.message || 'Something went wrong');
  }

  return data;
};
