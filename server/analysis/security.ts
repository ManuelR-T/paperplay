import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export class AnalysisHttpError extends Error {
  constructor(readonly status: number, message: string, readonly uncertain = false) { super(message); }
}
export function signingKey(apiKey: string, override?: string) {
  return override?.trim() || createHmac('sha256', apiKey).update('paperplay-analysis-capability-v1').digest('hex');
}
export function signToken(value: Record<string, unknown>, key: string) {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}
export function verifyToken(token: string, key: string): Record<string, unknown> {
  if (token.length > 5000) throw new AnalysisHttpError(403, 'Invalid analysis access token.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new AnalysisHttpError(403, 'Invalid analysis access token.');
  const expected = createHmac('sha256', key).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new AnalysisHttpError(403, 'Invalid analysis access token.');
  try { const result = JSON.parse(Buffer.from(payload, 'base64url').toString()); if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error(); return result; }
  catch { throw new AnalysisHttpError(403, 'Invalid analysis access token.'); }
}
export function requireSameOrigin(request: Request, allowedOrigin?: string) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  // Next can reconstruct request.url with the listening address (0.0.0.0).
  // Compare with the actual HTTP Host, never an arbitrary forwarded host.
  const url = new URL(request.url);
  const host = request.headers.get('host') ?? url.host;
  if (/[\s/@\\#?]/.test(host) || origin !== `${url.protocol}//${host}` || (site && !['same-origin', 'none'].includes(site))) throw new AnalysisHttpError(403, 'Analysis requests must come from this application.');
  const hostname = new URL(origin).hostname;
  const configuredOrigin = (allowedOrigin ?? process.env.ANALYSIS_APP_ORIGIN)?.trim();
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) && origin !== configuredOrigin) throw new AnalysisHttpError(403, 'This application origin is not enabled for analysis. Configure ANALYSIS_APP_ORIGIN for a LAN or hosted installation.');
}
export function sessionFor(request: Request, key: string, now: number, create: boolean, options: { cookieName?: string } = {}) {
  const cookieName = options.cookieName ?? 'paperplay_session';
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(cookieName)) throw new AnalysisHttpError(500, 'Invalid application session configuration.');
  const renewedCookie = (sid: string) => {
    const token = signToken({ sid, exp: now + 24 * 60 * 60 * 1000 }, key);
    return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  };
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (cookie) {
    try {
      const payload = verifyToken(cookie, key);
      if (typeof payload.sid === 'string' && /^[a-f0-9]{48}$/.test(payload.sid) && typeof payload.exp === 'number' && payload.exp > now) return { sid: payload.sid, cookie: create ? renewedCookie(payload.sid) : undefined };
    } catch { /* An expired/malformed session cannot read jobs; start may create a new one. */ }
  }
  if (!create) throw new AnalysisHttpError(403, 'The browser session for this analysis is missing or expired.');
  const sid = randomBytes(24).toString('hex');
  return { sid, cookie: renewedCookie(sid) };
}
export async function readBoundedJson(request: Request) {
  const max = 768_000;
  if (Number(request.headers.get('content-length') || 0) > max) throw new AnalysisHttpError(413, 'The analysis request is too large. Import a shorter document.');
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AnalysisHttpError(415, 'Analysis requests require JSON.');
  if (!request.body) throw new AnalysisHttpError(400, 'The analysis request has no body.');
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new AnalysisHttpError(413, 'The analysis request is too large. Import a shorter document.'); } chunks.push(value); }
    const body = Buffer.concat(chunks).toString('utf8');
    try { return JSON.parse(body) as unknown; } catch { throw new AnalysisHttpError(400, 'The analysis request contains invalid JSON.'); }
  } finally { reader.releaseLock(); }
}
