const test = require('node:test');
const assert = require('node:assert/strict');

function isTransientRealtimeError(error) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('1001') ||
    message.includes('1000') ||
    message.includes('1006') ||
    message.includes('Stream end') ||
    message.includes('socket closed') ||
    message.includes('transport failure')
  );
}

test('identifies socket closed 1001 Stream end as transient', () => {
  const err = new Error('socket closed: 1001 (Stream end encountered)');
  assert.equal(isTransientRealtimeError(err), true);
});

test('identifies normal socket close 1000 as transient', () => {
  const err = new Error('socket closed: 1000');
  assert.equal(isTransientRealtimeError(err), true);
});

test('identifies abnormal closure 1006 as transient', () => {
  const err = new Error('socket closed: 1006');
  assert.equal(isTransientRealtimeError(err), true);
});

test('identifies transport failure as transient', () => {
  const err = new Error('channel error: transport failure');
  assert.equal(isTransientRealtimeError(err), true);
});

test('identifies non-Error string transient message', () => {
  assert.equal(isTransientRealtimeError('socket closed: 1001'), true);
});

test('does not classify unauthorized/RLS errors as transient', () => {
  const err = new Error('Unauthorized: JWT expired or row-level security policy violation');
  assert.equal(isTransientRealtimeError(err), false);
});

test('handles null and undefined gracefully', () => {
  assert.equal(isTransientRealtimeError(null), false);
  assert.equal(isTransientRealtimeError(undefined), false);
});

