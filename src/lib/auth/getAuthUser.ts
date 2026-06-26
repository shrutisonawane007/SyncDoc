import { NextRequest } from 'next/server';
import { verifyToken, UserTokenPayload } from './jwt';

export function getAuthUser(req: NextRequest): UserTokenPayload | null {
  // 1. Check HTTP-only cookie
  const tokenCookie = req.cookies.get('token');
  if (tokenCookie?.value) {
    const payload = verifyToken(tokenCookie.value);
    if (payload) return payload;
  }

  // 2. Check Authorization Header as fallback
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) return payload;
  }

  return null;
}
