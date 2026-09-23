module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/domain/**' },
      { type: 'application', pattern: 'src/application/**' },
      { type: 'adapters', pattern: 'src/adapters/**' },
      { type: 'config', pattern: 'src/config/**' },
      { type: 'main', pattern: 'src/main.ts' },
    ],
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
    'boundaries/element-types': [
      2,
      {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: ['domain'] },
          { from: 'application', allow: ['domain', 'application'] },
          { from: 'adapters', allow: ['domain', 'application', 'adapters', 'config'] },
          { from: 'config', allow: ['config'] },
          { from: 'main', allow: ['domain', 'application', 'adapters', 'config'] },
        ],
      },
    ],
  },
};
