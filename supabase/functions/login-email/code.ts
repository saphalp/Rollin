export function generateCode(): string {
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return String(bytes[0] % 1000000).padStart(6, '0');
}
export async function hashCode(secret: string, session: string, email: string, challenge: string, code: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify([session, email, challenge, code])));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}
