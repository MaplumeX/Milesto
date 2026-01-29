module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: [
    'dist/',
    'dist-electron/',
    'release/',
    'release-temp/',
    'node_modules/',
    'docs/design/prototype interface/',
  ],
  rules: {
    // React Refresh is mainly for dev ergonomics; keep it non-blocking.
    'react-refresh/only-export-components': 'off',
  },
}
