const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function createHookInstance(customSupabase) {
  const code = ts.transpileModule(fs.readFileSync('hooks/use-profile-interests.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const stateMap = new Map();
  let stateId = 0;
  const exports = {};

  const context = {
    exports,
    module: { exports },
    console,
    require: (name) => {
      if (name === 'react') {
        return {
          useState: (initial) => {
            const id = ++stateId;
            if (!stateMap.has(id)) {
              stateMap.set(id, typeof initial === 'function' ? initial() : initial);
            }
            const setter = (val) => {
              const nextVal = typeof val === 'function' ? val(stateMap.get(id)) : val;
              stateMap.set(id, nextVal);
            };
            return [stateMap.get(id), setter];
          },
          useRef: (val) => ({ current: val }),
          useCallback: (fn) => fn,
          useEffect: () => {},
        };
      }
      if (name === '@/lib/supabase') {
        return { supabase: customSupabase };
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  };

  vm.runInNewContext(code, context);

  function render(profileId = 'user-123') {
    stateId = 0;
    return exports.useProfileInterests(profileId);
  }

  return { render, stateMap };
}

test('save uses atomic set_profile_interests RPC when available', async () => {
  let rpcCalledWith = null;
  const mockSupabase = {
    from: (table) => {
      if (table === 'interests') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                { id: 'int-1', name: 'Music' },
                { id: 'int-2', name: 'Gaming' },
                { id: 'int-3', name: 'Hiking' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'profile_interests') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { interest_id: 'int-1', interests: { name: 'Music' } },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async (fn, params) => {
      if (fn === 'set_profile_interests') {
        rpcCalledWith = params;
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    },
  };

  const { render } = createHookInstance(mockSupabase);
  let hook = render('user-123');
  await hook.refresh();
  hook = render('user-123');

  assert.deepEqual([...hook.selectedNames], ['Music']);

  // Save new list: add Gaming, remove Music
  const success = await hook.save(['Gaming']);
  assert.equal(success, true);
  assert.deepEqual([...rpcCalledWith.p_interest_ids], ['int-2']);

  hook = render('user-123');
  assert.deepEqual([...hook.selectedNames], ['Gaming']);
});

test('save falls back to client sync and rolls back inserted items if delete fails', async () => {
  let dbInterests = ['int-1']; // starts with Music
  let rolledBackIds = null;
  let reFetched = false;

  const mockSupabase = {
    from: (table) => {
      if (table === 'interests') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                { id: 'int-1', name: 'Music' },
                { id: 'int-2', name: 'Gaming' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'profile_interests') {
        return {
          select: (fields) => {
            if (fields === 'interest_id') {
              return {
                eq: async () => ({
                  data: dbInterests.map((id) => ({ interest_id: id })),
                  error: null,
                }),
              };
            }
            // refresh query
            return {
              eq: async () => {
                reFetched = true;
                return {
                  data: dbInterests.map((id) => ({
                    interest_id: id,
                    interests: { name: id === 'int-1' ? 'Music' : 'Gaming' },
                  })),
                  error: null,
                };
              },
            };
          },
          insert: async (rows) => {
            // Insert succeeds!
            rows.forEach((r) => dbInterests.push(r.interest_id));
            return { error: null };
          },
          delete: () => ({
            eq: (_col, _val) => ({
              in: async (_inCol, ids) => {
                // If it's the rollback delete
                if (ids.includes('int-2')) {
                  rolledBackIds = ids;
                  dbInterests = dbInterests.filter((id) => !ids.includes(id));
                  return { error: null };
                }
                // Simulate delete failure on removing Music!
                return { error: { message: 'Network transport failure on delete' } };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async () => ({
      // Simulate RPC not yet migrated in database
      error: { code: 'PGRST202', message: 'Function not found' },
    }),
  };

  const { render } = createHookInstance(mockSupabase);
  let hook = render('user-123');
  await hook.refresh();
  hook = render('user-123');

  assert.deepEqual([...hook.selectedNames], ['Music']);

  // User attempts to switch Music -> Gaming.
  // Insert (Gaming) will succeed, but Delete (Music) will fail!
  const success = await hook.save(['Gaming']);

  assert.equal(success, false, 'Save should return false on partial failure');
  assert.deepEqual([...rolledBackIds], ['int-2'], 'Newly inserted interest must be rolled back');
  assert.equal(reFetched, true, 'Database must be re-queried to ensure sync');

  hook = render('user-123');
  // State must reflect the true database state (Music), NOT Gaming!
  assert.deepEqual([...hook.selectedNames], ['Music']);
});

test('save re-syncs from Supabase when insert operation fails', async () => {
  let reFetched = false;
  const mockSupabase = {
    from: (table) => {
      if (table === 'interests') {
        return {
          select: () => ({
            order: async () => ({
              data: [
                { id: 'int-1', name: 'Music' },
                { id: 'int-2', name: 'Gaming' },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'profile_interests') {
        return {
          select: (fields) => {
            if (fields === 'interest_id') {
              return {
                eq: async () => ({
                  data: [{ interest_id: 'int-1' }],
                  error: null,
                }),
              };
            }
            return {
              eq: async () => {
                reFetched = true;
                return {
                  data: [{ interest_id: 'int-1', interests: { name: 'Music' } }],
                  error: null,
                };
              },
            };
          },
          insert: async () => ({
            error: { message: 'Insert constraint failure' },
          }),
          delete: () => ({
            eq: () => ({ in: async () => ({ error: null }) }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async () => ({
      error: { code: 'PGRST202', message: 'Function not found' },
    }),
  };

  const { render } = createHookInstance(mockSupabase);
  let hook = render('user-123');
  await hook.refresh();
  hook = render('user-123');

  const success = await hook.save(['Music', 'Gaming']);
  assert.equal(success, false);
  assert.equal(reFetched, true, 'Must re-query database after insert failure');

  hook = render('user-123');
  assert.deepEqual([...hook.selectedNames], ['Music']);
});
