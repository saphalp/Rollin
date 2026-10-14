// Offline handler checks: no real Didit account, network, or Deno installation needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const nodeCrypto = require('node:crypto');

const compiled = ts.transpileModule(fs.readFileSync('supabase/functions/didit-webhook/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const SECRET = 'test-webhook-secret';

// Mirrors the handler's own canonicalisation so tests can sign requests the same
// way Didit would, without exporting the (intentionally private) helpers.
function shortenFloats(v) {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shortenFloats(x)]));
  if (typeof v === 'number' && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((acc, k) => { acc[k] = sortKeys(v[k]); return acc; }, {});
  return v;
}
function sign(body, secret = SECRET) {
  const canonical = JSON.stringify(sortKeys(shortenFloats(body)));
  return nodeCrypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

function setup(options = {}) {
  let handler;
  const updates = [];
  const client = {
    from: (table) => ({
      update: (fields) => ({
        eq: async (col, val) => {
          updates.push({ table, fields, col, val });
          return { error: options.updateError ? new Error('db error') : null };
        },
      }),
    }),
  };
  vm.runInNewContext(compiled, {
    exports: {},
    require: () => ({ createClient: () => client }),
    Deno: {
      env: {
        get: (key) => {
          if (key === 'DIDIT_WEBHOOK_SECRET') return options.noSecret ? undefined : SECRET;
          return 'test-value';
        },
      },
      serve: (fn) => { handler = fn; },
    },
    Response, crypto, TextEncoder,
  });

  function request({ body, method = 'POST', timestamp = Math.floor(Date.now() / 1000), signature, tamperAfterSigning } = {}) {
    const raw = JSON.stringify(body ?? {});
    const parsedForTamper = tamperAfterSigning ? { ...JSON.parse(raw), ...tamperAfterSigning } : null;
    const finalBody = parsedForTamper ? JSON.stringify(parsedForTamper) : raw;
    const finalSignature = signature ?? sign(body ?? {});
    return {
      method,
      text: async () => finalBody,
      headers: {
        get: (name) => {
          if (name === 'x-signature-v2') return finalSignature;
          if (name === 'x-timestamp') return String(timestamp);
          return null;
        },
      },
    };
  }

  return { updates, run: (req) => handler(req), request };
}

test('valid signature updates the matching driver profile', async () => {
  const app = setup();
  const res = await app.run(app.request({ body: { vendor_data: 'profile-1', status: 'Approved' } }));
  assert.equal(await res.text(), 'ok');
  assert.equal(app.updates.length, 1);
  const update = app.updates[0];
  // `fields` is a live object from inside the vm sandbox, so it carries a different
  // realm's Object.prototype than this file — compare primitives, not the whole object.
  assert.equal(update.table, 'driver_profiles');
  assert.equal(update.col, 'profile_id');
  assert.equal(update.val, 'profile-1');
  assert.equal(update.fields.verification_status, 'verified');
});

test('maps every Didit status onto the four-value verification_status enum', async () => {
  const cases = [
    ['Approved', 'verified'],
    ['Declined', 'rejected'],
    ['Abandoned', 'rejected'],
    ['Expired', 'rejected'],
    ['Kyc Expired', 'unverified'],
    ['Not Started', 'pending'],
    ['In Progress', 'pending'],
    ['Awaiting User', 'pending'],
    ['In Review', 'pending'],
    ['Resubmitted', 'pending'],
  ];
  for (const [status, expected] of cases) {
    const app = setup();
    await app.run(app.request({ body: { vendor_data: 'profile-1', status } }));
    assert.equal(app.updates[0].fields.verification_status, expected, `status ${status}`);
  }
});

test('rejects a stale timestamp before checking the signature at all', async () => {
  const app = setup();
  const res = await app.run(app.request({
    body: { vendor_data: 'profile-1', status: 'Approved' },
    timestamp: Math.floor(Date.now() / 1000) - 400,
  }));
  assert.equal(res.status, 401);
  assert.equal(await res.text(), 'stale');
  assert.equal(app.updates.length, 0);
});

test('rejects a tampered body even though the signature header looks well-formed', async () => {
  const app = setup();
  const res = await app.run(app.request({
    body: { vendor_data: 'profile-1', status: 'Approved' },
    tamperAfterSigning: { status: 'Declined' },
  }));
  assert.equal(res.status, 401);
  assert.equal(await res.text(), 'bad signature');
  assert.equal(app.updates.length, 0);
});

test('rejects an outright wrong signature', async () => {
  const app = setup();
  const res = await app.run(app.request({
    body: { vendor_data: 'profile-1', status: 'Approved' },
    signature: 'f'.repeat(64),
  }));
  assert.equal(res.status, 401);
  assert.equal(app.updates.length, 0);
});

test('503s when the webhook secret is not configured', async () => {
  const app = setup({ noSecret: true });
  const res = await app.run(app.request({ body: { vendor_data: 'profile-1', status: 'Approved' } }));
  assert.equal(res.status, 503);
  assert.equal(app.updates.length, 0);
});

test('acknowledges a validly-signed but malformed payload without writing anything', async () => {
  const app = setup();
  const res = await app.run(app.request({ body: { status: 'Approved' } })); // missing vendor_data
  assert.equal(await res.text(), 'ok');
  assert.equal(app.updates.length, 0);
});

test('rejects non-POST requests', async () => {
  const app = setup();
  const res = await app.run(app.request({ method: 'GET' }));
  assert.equal(res.status, 405);
});

test('still returns ok to Didit even when the database write fails', async () => {
  const app = setup({ updateError: true });
  const res = await app.run(app.request({ body: { vendor_data: 'profile-1', status: 'Approved' } }));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
});
