const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

function loadProfileInfo() {
  const source = fs.readFileSync('components/profile/ProfileInfo.tsx', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const mockReact = {
    createElement: React.createElement,
    Fragment: React.Fragment,
  };

  const exports = {};
  const context = {
    exports,
    module: { exports },
    console,
    React: mockReact,
    require: (name) => {
      if (name === 'react') return mockReact;
      if (name === 'react-native') {
        return {
          StyleSheet: { create: (s) => s },
          View: 'View',
          useColorScheme: () => 'light',
        };
      }
      if (name === 'react-native-paper') {
        return { Text: 'Text' };
      }
      if (name === '@/components/ui/icon-symbol') {
        return { IconSymbol: 'IconSymbol' };
      }
      if (name === '@/constants/theme') {
        return {
          Colors: { light: { text: '#000', icon: '#888', verifiedContainer: '#eee', onVerifiedContainer: '#000' } },
          Fonts: { sans: 'System' },
        };
      }
      throw new Error(`Unexpected import in test: ${name}`);
    },
  };

  vm.runInNewContext(code, context);
  return exports.default;
}

function findChildrenByProp(element, prop, value) {
  const matches = [];
  function walk(el) {
    if (!el || typeof el !== 'object') return;
    if (el.props && el.props[prop] === value) {
      matches.push(el);
    }
    if (el.props && el.props.children) {
      React.Children.forEach(el.props.children, walk);
    }
  }
  walk(element);
  return matches;
}

function findTexts(element) {
  const texts = [];
  function walk(el) {
    if (typeof el === 'string' || typeof el === 'number') {
      texts.push(String(el));
      return;
    }
    if (!el || typeof el !== 'object') return;
    if (el.props && el.props.children) {
      React.Children.forEach(el.props.children, walk);
    }
  }
  walk(element);
  return texts;
}

test('ProfileInfo: renders dot between university and major when both are present', () => {
  const ProfileInfo = loadProfileInfo();
  const tree = ProfileInfo({
    name: 'Jack Doe',
    university: 'Louisiana Tech University',
    major: 'Computer Science',
  });

  const dots = findChildrenByProp(tree, 'testID', 'university-major-dot');
  assert.equal(dots.length, 1, 'Separator dot must be rendered when both university and major are present');

  const texts = findTexts(tree);
  assert.ok(texts.includes('Louisiana Tech University'));
  assert.ok(texts.includes('Computer Science'));
});

test('ProfileInfo: does NOT render dot when university is blank or whitespace', () => {
  const ProfileInfo = loadProfileInfo();
  const tree = ProfileInfo({
    name: 'Jack Doe',
    university: '   ',
    major: 'Computer Science',
  });

  const dots = findChildrenByProp(tree, 'testID', 'university-major-dot');
  assert.equal(dots.length, 0, 'No separator dot should be rendered when university is blank');

  const texts = findTexts(tree);
  assert.ok(texts.includes('Computer Science'));
  assert.ok(!texts.includes('Louisiana Tech University'));
});

test('ProfileInfo: does NOT render dot when major is blank or whitespace', () => {
  const ProfileInfo = loadProfileInfo();
  const tree = ProfileInfo({
    name: 'Jack Doe',
    university: 'Louisiana Tech University',
    major: '',
  });

  const dots = findChildrenByProp(tree, 'testID', 'university-major-dot');
  assert.equal(dots.length, 0, 'No separator dot should be rendered when major is blank');

  const texts = findTexts(tree);
  assert.ok(texts.includes('Louisiana Tech University'));
});

test('ProfileInfo: does NOT render dot or metaRow when both university and major are blank', () => {
  const ProfileInfo = loadProfileInfo();
  const tree = ProfileInfo({
    name: 'Jack Doe',
    university: '',
    major: '',
  });

  const dots = findChildrenByProp(tree, 'testID', 'university-major-dot');
  assert.equal(dots.length, 0, 'No separator dot when both are blank');

  const texts = findTexts(tree);
  assert.deepEqual(texts, ['Jack Doe']);
});
