// Run with: node --test scripts/test-university-selection.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadModule(file, mocks = {}) {
  const exports = {};
  const code = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  vm.runInNewContext(compiled, {
    exports,
    console,
    require(id) {
      if (mocks[id]) return mocks[id];
      if (id === '@/lib/supabase') return { supabase: mocks.supabase };
      if (id === '@/lib/university') return mocks.universityModule;
      throw new Error(`Unexpected import in test: ${id}`);
    },
  });

  return exports;
}

test('resolveProfileUniversity prioritizes verified university from getCurrentUniversity', async () => {
  const supabase = {
    rpc: async (fn) => {
      if (fn === 'current_university') {
        return { data: [{ id: 'latech', name: 'Louisiana Tech University' }], error: null };
      }
      return { data: null, error: null };
    },
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  const result = await universityModule.resolveProfileUniversity('Harvard University');
  assert.equal(result, 'Louisiana Tech University');
});

test('resolveProfileUniversity returns empty string when requested name is empty/whitespace', async () => {
  const supabase = {
    rpc: async (fn) => ({ data: null, error: null }),
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  const result = await universityModule.resolveProfileUniversity('   ');
  assert.equal(result, '');
});

test('resolveProfileUniversity finds university in main university_directory', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from: (table) => {
      assert.equal(table, 'university_directory');
      return {
        select: () => ({
          eq: (field, val) => ({
            maybeSingle: async () => {
              if (val === 'Stanford University') {
                return { data: { name: 'Stanford University' }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
      };
    },
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  const result = await universityModule.resolveProfileUniversity('Stanford University');
  assert.equal(result, 'Stanford University');
});

test('resolveProfileUniversity falls back to universities table when not in directory', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from: (table) => {
      if (table === 'university_directory') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      }
      if (table === 'universities') {
        return {
          select: () => ({
            eq: (field, val) => ({
              maybeSingle: async () => {
                if (val === 'Louisiana Tech University') {
                  return { data: { name: 'Louisiana Tech University' }, error: null };
                }
                return { data: null, error: null };
              },
            }),
            ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  const result = await universityModule.resolveProfileUniversity('Louisiana Tech University');
  assert.equal(result, 'Louisiana Tech University');
});

test('resolveProfileUniversity falls back to universities table when university_directory query errors', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from: (table) => {
      if (table === 'university_directory') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                return { data: null, error: { message: 'relation "public.university_directory" does not exist' } };
              },
            }),
            ilike: () => ({
              maybeSingle: async () => {
                return { data: null, error: { message: 'relation "public.university_directory" does not exist' } };
              },
            }),
          }),
        };
      }
      if (table === 'universities') {
        return {
          select: () => ({
            eq: (field, val) => ({
              maybeSingle: async () => {
                if (val === 'University of Louisiana Monroe') {
                  return { data: { name: 'University of Louisiana Monroe' }, error: null };
                }
                return { data: null, error: null };
              },
            }),
            ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  const result = await universityModule.resolveProfileUniversity('University of Louisiana Monroe');
  assert.equal(result, 'University of Louisiana Monroe');
});

test('resolveProfileUniversity resolves short_name from universities fallback table', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from: (table) => {
      if (table === 'university_directory') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      }
      if (table === 'universities') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            ilike: (field, val) => ({
              maybeSingle: async () => {
                if (field === 'short_name' && val === 'LA Tech') {
                  return { data: { name: 'Louisiana Tech University' }, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  const result = await universityModule.resolveProfileUniversity('LA Tech');
  assert.equal(result, 'Louisiana Tech University');
});

test('resolveProfileUniversity throws error when university not found in directory or fallback', async () => {
  const supabase = {
    rpc: async () => ({ data: null, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        ilike: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  };

  const universityModule = loadModule('lib/university.ts', { supabase });
  await assert.rejects(
    () => universityModule.resolveProfileUniversity('Fictional College of Magic'),
    /Please select a university from the list\./
  );
});

test('completeProfile saves university resolved from fallback table', async () => {
  let updatedRow = null;
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }),
    },
    from: (table) => {
      assert.equal(table, 'profiles');
      return {
        update: (values) => {
          updatedRow = values;
          return {
            eq: (field, val) => {
              assert.equal(field, 'id');
              assert.equal(val, 'user-123');
              return {
                select: () => ({
                  single: async () => ({ data: { id: 'user-123', ...updatedRow }, error: null }),
                }),
              };
            },
          };
        },
      };
    },
  };

  const universityModule = {
    resolveProfileUniversity: async (name) => {
      if (name === 'Louisiana Tech University') return 'Louisiana Tech University';
      throw new Error('Please select a university from the list.');
    },
  };

  const completeProfileModule = loadModule('lib/profile/complete-profile.ts', {
    supabase,
    universityModule,
  });

  const saved = await completeProfileModule.completeProfile({
    fullName: 'Jane Doe',
    university: 'Louisiana Tech University',
    major: 'Computer Science',
  });

  assert.equal(saved.full_name, 'Jane Doe');
  assert.equal(saved.university, 'Louisiana Tech University');
  assert.equal(saved.major, 'Computer Science');
  assert.equal(saved.profile_completed, true);
});

