/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '.scratch',
    'public/sw.js',
    '.eslintrc.cjs',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': 'off',
    'react/prop-types': 'off',
    // Apostrophes/quotes in JSX copy are intentional; the app ships 9 locales
    // where escaping every one of them would make the strings unreadable.
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
  },
  overrides: [
    {
      files: ['*.config.js', 'scripts/**/*.mjs', 'e2e/**/*.js'],
      env: { node: true },
    },
    {
      files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
      env: { node: true },
      globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly', vi: 'readonly' },
    },
  ],
}
