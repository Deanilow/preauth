module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'standard',
    'plugin:security/recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module'
  },
  rules: {
    semi: [2, 'always']
  },
  root: true
};
