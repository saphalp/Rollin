const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function loadModule(file, customMocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const exports = {};
  const context = {
    exports,
    module: { exports },
    console,
    Buffer,
    setTimeout,
    clearTimeout,
    fetch: customMocks.fetch || globalThis.fetch,
    Response: globalThis.Response,
    require: (name) => {
      if (customMocks[name]) return customMocks[name];
      if (name === 'base64-arraybuffer') return require('base64-arraybuffer');
      throw new Error(`Unexpected import in test: ${name}`);
    },
  };

  vm.runInNewContext(code, context);
  return exports;
}

test('getAssetArrayBuffer handles pre-populated base64 with and without data URL prefix', async () => {
  const mod = loadModule('lib/profile/upload-profile-picture.ts', {
    '@/lib/supabase': { supabase: {} },
  });

  const sampleBase64 = Buffer.from('hello-world-banner').toString('base64');
  
  // Clean base64
  const buf1 = await mod.getAssetArrayBuffer({ uri: 'file://img.jpg', base64: sampleBase64 });
  assert.equal(Buffer.from(buf1).toString(), 'hello-world-banner');

  // With data URL prefix
  const buf2 = await mod.getAssetArrayBuffer({ uri: 'file://img.jpg', base64: `data:image/jpeg;base64,${sampleBase64}` });
  assert.equal(Buffer.from(buf2).toString(), 'hello-world-banner');
});

test('getAssetArrayBuffer falls back to URI when base64 is missing (Android scenario)', async () => {
  const fileContent = 'android-native-cropped-banner';
  const fileBase64 = Buffer.from(fileContent).toString('base64');

  const mod = loadModule('lib/profile/upload-profile-picture.ts', {
    '@/lib/supabase': { supabase: {} },
    'expo-file-system/legacy': {
      readAsStringAsync: async (uri, opts) => {
        assert.equal(uri, 'content://media/external/images/12345');
        assert.equal(opts.encoding, 'base64');
        return fileBase64;
      },
    },
  });

  // asset has NO base64 (standard Android photo picker / crop result)
  const buf = await mod.getAssetArrayBuffer({
    uri: 'content://media/external/images/12345',
    base64: undefined,
  });

  assert.equal(Buffer.from(buf).toString(), fileContent);
});

test('getAssetArrayBuffer falls back to fetch when FileSystem fails', async () => {
  const fileContent = 'fetch-fallback-image-data';
  const uint8 = Uint8Array.from(Buffer.from(fileContent));

  const mod = loadModule('lib/profile/upload-profile-picture.ts', {
    '@/lib/supabase': { supabase: {} },
    'expo-file-system/legacy': {
      readAsStringAsync: async () => { throw new Error('Native FS unavailable'); },
    },
    'expo-file-system': {},
    fetch: async (uri) => {
      assert.equal(uri, 'file:///cache/cropped.jpg');
      return {
        arrayBuffer: async () => uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength),
      };
    },
  });

  const buf = await mod.getAssetArrayBuffer({
    uri: 'file:///cache/cropped.jpg',
    base64: null,
  });

  assert.equal(Buffer.from(buf).toString(), fileContent);
});

test('getAssetArrayBuffer throws clear error when neither base64 nor URI can be read', async () => {
  const mod = loadModule('lib/profile/upload-profile-picture.ts', {
    '@/lib/supabase': { supabase: {} },
    'expo-file-system/legacy': {
      readAsStringAsync: async () => { throw new Error('File not found'); },
    },
    'expo-file-system': {},
    fetch: async () => { throw new Error('Network error'); },
  });

  await assert.rejects(
    () => mod.getAssetArrayBuffer({ uri: '', base64: '' }),
    /The selected image does not contain upload data/
  );
});

test('uploadCoverPicture successfully saves image without requiring asset.base64', async () => {
  let uploadedPath = null;
  let uploadedBuffer = null;
  let updatedRecord = null;
  let removedPath = null;

  const mockSupabase = {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'jack-user-id' } },
        error: null,
      }),
    },
    from: (table) => {
      assert.equal(table, 'profiles');
      return {
        select: (field) => {
          assert.equal(field, 'cover_picture');
          return {
            eq: (_idCol, _idVal) => ({
              single: async () => ({
                data: { cover_picture: 'jack-user-id/cover-old123.jpg' },
                error: null,
              }),
            }),
          };
        },
        update: (values) => {
          updatedRecord = values;
          return {
            eq: (_idCol, _idVal) => ({
              select: () => ({
                single: async () => ({
                  data: { id: 'jack-user-id' },
                  error: null,
                }),
              }),
            }),
          };
        },
      };
    },
    storage: {
      from: (bucket) => {
        assert.equal(bucket, 'avatars');
        return {
          upload: async (path, body, _options) => {
            uploadedPath = path;
            uploadedBuffer = body;
            return { data: { path }, error: null };
          },
          remove: async (paths) => {
            removedPath = paths[0];
            return { error: null };
          },
          getPublicUrl: (path) => ({
            data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/avatars/${path}` },
          }),
        };
      },
    },
  };

  const imageContent = 'banner-pixels-for-android';
  const mod = loadModule('lib/profile/upload-profile-picture.ts', {
    '@/lib/supabase': { supabase: mockSupabase },
    'expo-file-system/legacy': {
      readAsStringAsync: async () => Buffer.from(imageContent).toString('base64'),
    },
  });

  // Android asset without base64
  const asset = {
    uri: 'content://media/external/images/999',
    mimeType: 'image/jpeg',
  };

  const result = await mod.uploadCoverPicture(asset);

  assert.ok(uploadedPath.startsWith('jack-user-id/cover-'));
  assert.ok(uploadedPath.endsWith('.jpg'));
  assert.equal(Buffer.from(uploadedBuffer).toString(), imageContent);
  assert.equal(updatedRecord.cover_picture, uploadedPath);
  assert.equal(removedPath, 'jack-user-id/cover-old123.jpg');
  assert.equal(result.path, uploadedPath);
  assert.ok(result.publicUrl.includes(uploadedPath));
});
