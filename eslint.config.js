// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/**'],
  },
  {
    rules: {
      // Flags the common "fetch data on mount" effect pattern used throughout
      // this app; downgraded to a warning until those effects are refactored.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
