import { createClient } from 'npm:@supabase/supabase-js@2.110.2';

// Whole-number floats (1.0) -> integers (1), recursively. Matches Didit's server canonicalisation.
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)]),
    );
  }
  if (typeof v === 'number' && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

// Recursive lexicographic key sort (array order preserved).
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Our driver_profiles.verification_status only has these four values —
// collapse Didit's full status set onto them.
function mapVerificationStatus(status: string): 'unverified' | 'pending' | 'verified' | 'rejected' {
  if (status === 'Approved') return 'verified';
  if (status === 'Declined' || status === 'Abandoned' || status === 'Expired') return 'rejected';
  if (status === 'Kyc Expired') return 'unverified';
  // Not Started, In Progress, Awaiting User, In Review, Resubmitted
  return 'pending';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Use POST.', { status: 405 });

  try {
    const raw = await req.text();
    const signature = (req.headers.get('x-signature-v2') ?? '').toLowerCase();
    const timestamp = Number(req.headers.get('x-timestamp'));

    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return new Response('stale', { status: 401 });
    }

    const secret = Deno.env.get('DIDIT_WEBHOOK_SECRET');
    if (!secret) {
      console.error('didit-webhook: missing DIDIT_WEBHOOK_SECRET secret');
      return new Response('not configured', { status: 503 });
    }

    const parsed = JSON.parse(raw);
    const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));
    const expected = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (!timingSafeEqual(signature, expected)) {
      return new Response('bad signature', { status: 401 });
    }

    const vendorData = parsed.vendor_data;
    const status = parsed.status;
    if (typeof vendorData !== 'string' || typeof status !== 'string') {
      // Acknowledge malformed-but-signed payloads so Didit doesn't retry forever.
      return new Response('ok');
    }

    // Unauthenticated caller (Didit, not a signed-in user) — service role bypasses RLS.
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { error } = await client
      .from('driver_profiles')
      .update({ verification_status: mapVerificationStatus(status) })
      .eq('profile_id', vendorData);
    if (error) console.error('didit-webhook: failed to update driver profile', error);

    return new Response('ok');
  } catch (err) {
    console.error('didit-webhook: unexpected error', err);
    // Acknowledge anyway — a bug on our end shouldn't make Didit retry indefinitely.
    return new Response('ok');
  }
});
