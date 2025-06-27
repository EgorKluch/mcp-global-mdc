module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'error',
    'no-console': 'off', // Allow console for MCP server logging
    'no-undef': 'error',
  },
}; 