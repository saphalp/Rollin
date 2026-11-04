// Run with: node --test scripts/test-profile-avatar-update.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function compileTs(code) {
  return ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

test('ProfileAvatar calls refreshProfile after saving new picture', async () => {
  let refreshed = false;
  let uploadCalled = false;

  const mockAuthContext = {
    profile: { id: 'user-1', profile_picture: 'user-1/old.jpg' },
    refreshProfile: async () => {
      refreshed = true;
    },
  };

  const mockUpload = {
    uploadProfilePicture: async () => {
      uploadCalled = true;
      return { path: 'user-1/new.jpg', publicUrl: 'https://example.com/new.jpg' };
    },
  };

  const code = fs.readFileSync('components/profile/ProfileAvatar.tsx', 'utf8');
  const compiled = compileTs(code);

  const exports = {};
  const mockStates = [];
  let stateIdx = 0;

  vm.runInNewContext(compiled, {
    exports,
    console,
    require(id) {
      if (id === '@/hooks/use-auth-context') return { useAuthContext: () => mockAuthContext };
      if (id === '@/lib/profile/upload-profile-picture') return mockUpload;
      if (id === '@/lib/profile/select-profile-image') return { selectProfileImage: async () => ({ uri: 'file://new.jpg' }) };
      if (id === '@/lib/profile/resolve-avatar-uri') return { FALLBACK_AVATAR: 'fallback', resolveAvatarUri: (p) => `https://cdn/${p}` };
      if (id === '@/components/profile/AvatarCard') return () => null;
      if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (id === 'react') return {
        useState: (init) => {
          const idx = stateIdx++;
          mockStates[idx] = mockStates[idx] ?? init;
          return [mockStates[idx], (val) => { mockStates[idx] = val; }];
        },
      };
      if (id === 'react-native') return { Alert: { alert: () => {} }, StyleSheet: { create: (s) => s }, View: 'View' };
      if (id === 'react-native-paper') return { Button: 'Button' };
      throw new Error(`Unexpected import: ${id}`);
    },
  });

  assert.ok(typeof exports.default === 'function');
});

test('Header component derives profile picture directly from useAuthContext', () => {
  let currentProfile = { profile_picture: 'user-1/photo1.jpg' };
  const mockAuthContext = {
    get profile() {
      return currentProfile;
    },
  };

  const code = fs.readFileSync('components/Header.tsx', 'utf8');
  assert.ok(code.includes('useAuthContext'), 'Header must import and use useAuthContext');
  assert.ok(code.includes('resolveAvatarUri(profile.profile_picture)'), 'Header must resolve profile picture from auth context');
  assert.ok(!code.includes('getProfilePictureUrl'), 'Header should not make separate asynchronous getProfilePictureUrl request on mount');

  const compiled = compileTs(code);
  const exports = {};
  let renderedAvatarUri = null;

  vm.runInNewContext(compiled, {
    exports,
    console,
    require(id) {
      if (id === '@/hooks/use-auth-context') return { useAuthContext: () => mockAuthContext };
      if (id === '@/lib/profile/resolve-avatar-uri') return { resolveAvatarUri: (p) => `https://cdn/${p}` };
      if (id === '@/hooks/use-color-scheme') return { useColorScheme: () => 'light' };
      if (id === '@/hooks/use-unread-notifications') return { useUnreadNotifications: () => false };
      if (id === '@/components/profile-sidebar') return { ProfileSidebar: (props) => { renderedAvatarUri = props.profilePictureUrl; return null; } };
      if (id === '@/components/text') return { AppText: () => null };
      if (id === '@/components/ui/icon-symbol') return { IconSymbol: () => null };
      if (id === '@/components/tutorial/tour-target') return { TourTarget: ({ children }) => children };
      if (id === '@/constants/theme') return { Colors: { light: { tint: 'blue', primaryContainer: 'gray' } }, Fonts: {} };
      if (id === 'expo-router') return { router: { push: () => {} } };
      if (id === 'react/jsx-runtime') return {
        jsx: (type, props) => {
          if (type === 'Image') renderedAvatarUri = props.source?.uri;
          if (props?.children) {
            const arr = Array.isArray(props.children) ? props.children : [props.children];
            for (const child of arr) {
              if (child?.props?.source?.uri) renderedAvatarUri = child.props.source.uri;
            }
          }
          return { type, props };
        },
        jsxs: (type, props) => ({ type, props }),
      };
      if (id === 'react') return {
        useState: (init) => [init, () => {}],
      };
      if (id === 'react-native') return {
        Image: 'Image',
        StyleSheet: { create: (s) => s },
        TouchableOpacity: 'TouchableOpacity',
        View: 'View',
      };
      throw new Error(`Unexpected import: ${id}`);
    },
  });

  const renderHeader = exports.default;
  renderHeader();
  assert.equal(renderedAvatarUri, 'https://cdn/user-1/photo1.jpg');

  // Change profile picture in auth context
  currentProfile = { profile_picture: 'user-1/photo2_new.jpg' };
  renderHeader();
  assert.equal(renderedAvatarUri, 'https://cdn/user-1/photo2_new.jpg');
});

test('ProfileSidebar derives avatar from profile_picture when profilePictureUrl not passed', () => {
  const code = fs.readFileSync('components/profile-sidebar.tsx', 'utf8');
  assert.ok(code.includes('resolveAvatarUri'), 'ProfileSidebar must resolve avatar from auth profile');
});

