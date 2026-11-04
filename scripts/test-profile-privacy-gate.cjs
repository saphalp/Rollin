const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

function loadPrivacyGate({ currentUserId, customRpc, customFrom }) {
  const source = fs.readFileSync('components/profile/ProfilePrivacyGate.tsx', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const rpcCalls = [];
  const fromCalls = [];

  const mockSupabase = {
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      if (customRpc) return customRpc(name, params);
      return { data: [{ id: params.target_id, full_name: 'Test', profile_picture: null, is_private: false, can_view: true }], error: null };
    },
    from: (table) => {
      fromCalls.push(table);
      if (customFrom) return customFrom(table);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: currentUserId } } } }),
      getUser: async () => ({ data: { user: { id: currentUserId } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };

  const stateMap = new Map();
  let stateIndex = 0;

  const mockReact = {
    createElement: React.createElement,
    Fragment: React.Fragment,
    useState: (initial) => {
      const idx = ++stateIndex;
      if (!stateMap.has(idx)) {
        stateMap.set(idx, typeof initial === 'function' ? initial() : initial);
      }
      const setter = (val) => {
        const next = typeof val === 'function' ? val(stateMap.get(idx)) : val;
        stateMap.set(idx, next);
      };
      return [stateMap.get(idx), setter];
    },
    useRef: (val) => ({ current: val }),
    useCallback: (fn) => fn,
    useEffect: (fn) => {
      fn();
    },
  };

  const exports = {};
  const context = {
    exports,
    module: { exports },
    console,
    React: mockReact,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout,
    require: (name) => {
      if (name === 'react') return mockReact;
      if (name === 'react-native') {
        return {
          ActivityIndicator: 'ActivityIndicator',
          AppState: { addEventListener: () => ({ remove: () => {} }) },
          Pressable: 'Pressable',
          View: 'View',
        };
      }
      if (name === '@/components/text') return { AppText: 'AppText' };
      if (name === '@/hooks/use-auth-context') return { useAuthContext: () => ({ claims: { sub: currentUserId } }) };
      if (name === '@/lib/account-center') return { subscribeAccountChanges: () => () => {} };
      if (name === '@/lib/profile/resolve-avatar-uri') return { resolveAvatarUri: (uri) => uri };
      if (name === '@/lib/supabase') return { supabase: mockSupabase };
      if (name === 'expo-router') return { useFocusEffect: (cb) => cb() };
      if (name === './AvatarCard') return () => 'AvatarCard';
      if (name === './ProfileActionBar') return () => 'ProfileActionBar';
      throw new Error(`Unexpected import in test: ${name}`);
    },
  };

  vm.runInNewContext(code, context);

  function render(userId, children) {
    stateIndex = 0;
    return exports.ProfilePrivacyGate({ userId, children });
  }

  return { render, rpcCalls, fromCalls };
}

test('ProfilePrivacyGate: logged-in user viewing own profile bypasses privacy check entirely', async () => {
  const ownUserId = 'user-abc-123';
  let rpcAttempted = false;

  const { render, rpcCalls, fromCalls } = loadPrivacyGate({
    currentUserId: ownUserId,
    customRpc: async () => {
      rpcAttempted = true;
      // If RPC is called, simulate failure to prove bypass protects the user
      throw new Error('Database/network failure');
    },
  });

  const children = React.createElement('div', null, 'My Profile Content');
  const result = render(ownUserId, children);

  // Assert children was rendered directly in Fragment
  assert.equal(result.type, React.Fragment);
  assert.equal(result.props.children, children);

  // Assert no network or database calls were made for privacy check
  assert.equal(rpcAttempted, false, 'RPC should not be called for own profile');
  assert.equal(rpcCalls.length, 0, 'No RPC calls should be initiated');
  assert.equal(fromCalls.length, 0, 'No follows table lookups should be initiated');
});

test('ProfilePrivacyGate: logged-in user viewing own profile is never blocked even if privacy is on', async () => {
  const ownUserId = 'user-private-999';

  const { render, rpcCalls } = loadPrivacyGate({
    currentUserId: ownUserId,
    customRpc: async () => {
      return {
        data: [{ id: ownUserId, full_name: 'Private Me', profile_picture: null, is_private: true, can_view: false }],
        error: null,
      };
    },
  });

  const children = React.createElement('div', null, 'Private Profile Details');
  const result = render(ownUserId, children);

  // Must render children, not private message or loading spinner
  assert.equal(result.type, React.Fragment);
  assert.equal(result.props.children, children);
  assert.equal(rpcCalls.length, 0);
});

test('ProfilePrivacyGate: viewing another user triggers access check', async () => {
  const currentUserId = 'user-viewer';
  const targetUserId = 'user-target';

  const { render, rpcCalls } = loadPrivacyGate({
    currentUserId,
    customRpc: async (name, params) => {
      return {
        data: [{ id: params.target_id, full_name: 'Target User', profile_picture: null, is_private: false, can_view: true }],
        error: null,
      };
    },
  });

  const children = React.createElement('div', null, 'Target Profile Content');
  // First render for other user initiates check
  render(targetUserId, children);

  // Assert RPC was called with target_id
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'rollin_profile_access');
  assert.equal(rpcCalls[0].params.target_id, targetUserId);
});

test('UserProfile: short-circuits ProfilePrivacyGate when viewing own profile', async () => {
  const ownUserId = 'user-xyz-456';
  const source = fs.readFileSync('components/profile/UserProfile.tsx', 'utf8');
  
  // Verify that UserProfile imports and uses useAuthContext
  assert.match(source, /import\s+{\s*useAuthContext\s*}\s*from\s+["']@\/hooks\/use-auth-context["']/);
  
  // Verify that UserProfile checks isOwnProfile and renders UserProfileContent directly
  assert.match(source, /const\s+isOwnProfile\s*=\s*!!currentUserId\s*&&\s*!!userId\s*&&\s*currentUserId\s*===\s*userId/);
  assert.match(source, /if\s*\(isOwnProfile\)\s*\{\s*return\s*<UserProfileContent\s+userId=\{userId\}\s*\/>;\s*\}/);
});
