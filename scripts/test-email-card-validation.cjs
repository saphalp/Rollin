const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

function loadEmailCard() {
  const source = fs.readFileSync('components/auth/EmailCard.tsx', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  let stateMap = new Map();
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
        return {
          Button: 'Button',
          Text: 'Text',
          TextInput: 'TextInput',
        };
      }
      if (name === '@/constants/theme') {
        return {
          Colors: { light: { text: '#000', icon: '#888', surfaceContainer: '#fff', outlineVariant: '#ccc', surface: '#fff', tint: '#007aff', onPrimary: '#fff', error: '#ff0000' } },
          Fonts: { sans: 'System' },
        };
      }
      if (name === './SignInWithGoogle') {
        return () => React.createElement('GoogleSignInButton');
      }
      throw new Error(`Unexpected import in test: ${name}`);
    },
  };

  vm.runInNewContext(code, context);

  function renderInstance(props) {
    stateIndex = 0;
    return exports.default(props);
  }

  function resetState() {
    stateMap.clear();
    stateIndex = 0;
  }

  return { render: renderInstance, resetState };
}

function findElementByType(element, typeName) {
  const matches = [];
  function walk(el) {
    if (!el || typeof el !== 'object') return;
    if (el.type === typeName || (typeof el.type === 'string' && el.type === typeName)) {
      matches.push(el);
    }
    if (el.props && el.props.children) {
      React.Children.forEach(el.props.children, walk);
    }
  }
  walk(element);
  return matches;
}

function findElementByTestId(element, testId) {
  let match = null;
  function walk(el) {
    if (!el || typeof el !== 'object') return;
    if (el.props && el.props.testID === testId) {
      match = el;
      return;
    }
    if (el.props && el.props.children) {
      React.Children.forEach(el.props.children, walk);
    }
  }
  walk(element);
  return match;
}

test('EmailCard: blocks empty email and displays required error', () => {
  const { render, resetState } = loadEmailCard();
  resetState();

  let nextCalledWith = null;
  const onNext = (val) => { nextCalledWith = val; };

  // Initial render with empty email
  let tree = render({ email: '', onNext, onLoginClick: () => {} });

  // Find Next button and click it
  const buttons = findElementByType(tree, 'Button');
  const nextButton = buttons[0];
  assert.ok(nextButton, 'Next button must exist');

  nextButton.props.onPress();

  // Re-render after state update
  tree = render({ email: '', onNext, onLoginClick: () => {} });

  assert.equal(nextCalledWith, null, 'onNext must NOT be called for empty email');
  const errorElement = findElementByTestId(tree, 'email-error-message');
  assert.ok(errorElement, 'Error message must be rendered');
  assert.equal(errorElement.props.children, 'Please enter your email address.');
});

test('EmailCard: blocks whitespace-only email', () => {
  const { render, resetState } = loadEmailCard();
  resetState();

  let nextCalledWith = null;
  const onNext = (val) => { nextCalledWith = val; };

  let tree = render({ email: '   ', onNext, onLoginClick: () => {} });
  const buttons = findElementByType(tree, 'Button');
  buttons[0].props.onPress();

  tree = render({ email: '   ', onNext, onLoginClick: () => {} });

  assert.equal(nextCalledWith, null, 'onNext must NOT be called for whitespace email');
  const errorElement = findElementByTestId(tree, 'email-error-message');
  assert.ok(errorElement, 'Error message must be rendered');
  assert.equal(errorElement.props.children, 'Please enter your email address.');
});

test('EmailCard: blocks malformed emails (missing @, missing domain, missing tld)', () => {
  const invalidEmails = ['plainaddress', 'user@', '@domain.com', 'user@domain', 'user@.com'];

  for (const invalid of invalidEmails) {
    const { render, resetState } = loadEmailCard();
    resetState();

    let nextCalledWith = null;
    const onNext = (val) => { nextCalledWith = val; };

    let tree = render({ email: invalid, onNext, onLoginClick: () => {} });
    const buttons = findElementByType(tree, 'Button');
    buttons[0].props.onPress();

    tree = render({ email: invalid, onNext, onLoginClick: () => {} });

    assert.equal(nextCalledWith, null, `onNext must NOT be called for invalid email: "${invalid}"`);
    const errorElement = findElementByTestId(tree, 'email-error-message');
    assert.ok(errorElement, `Error message must be rendered for "${invalid}"`);
    assert.equal(errorElement.props.children, 'Please enter a valid email address.');
  }
});

test('EmailCard: accepts valid email, normalizes case, and proceeds to next step', () => {
  const { render, resetState } = loadEmailCard();
  resetState();

  let nextCalledWith = null;
  const onNext = (val) => { nextCalledWith = val; };

  let tree = render({ email: 'Student@LaTech.EDU', onNext, onLoginClick: () => {} });
  const buttons = findElementByType(tree, 'Button');
  buttons[0].props.onPress();

  assert.equal(nextCalledWith, 'student@latech.edu', 'onNext must be called with normalized lowercase email');
  tree = render({ email: 'Student@LaTech.EDU', onNext, onLoginClick: () => {} });
  const errorElement = findElementByTestId(tree, 'email-error-message');
  assert.equal(errorElement, null, 'No error message should be displayed for valid email');
});

test('EmailCard: clears error message as soon as user types new text', () => {
  const { render, resetState } = loadEmailCard();
  resetState();

  let tree = render({ email: '', onNext: () => {}, onLoginClick: () => {} });
  const buttons = findElementByType(tree, 'Button');
  buttons[0].props.onPress();

  // Re-render: error is visible
  tree = render({ email: '', onNext: () => {}, onLoginClick: () => {} });
  assert.ok(findElementByTestId(tree, 'email-error-message'));

  // User types into TextInput
  const inputs = findElementByType(tree, 'TextInput');
  inputs[0].props.onChangeText('a');

  // Re-render: error is cleared
  tree = render({ email: '', onNext: () => {}, onLoginClick: () => {} });
  assert.equal(findElementByTestId(tree, 'email-error-message'), null, 'Error must be cleared on typing');
});
