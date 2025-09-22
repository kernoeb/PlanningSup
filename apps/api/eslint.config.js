import antfu from '@antfu/eslint-config'

export default antfu({
  stylistic: true,
  jsx: true,
  typescript: true,
  vue: false,
  rules: {
    'no-console': 'off',
    'antfu/if-newline': 'off',
    'nonblock-statement-body-position': 'error',
    'curly': ['error', 'multi-line', 'consistent'],
    'style/brace-style': ['error', '1tbs', { allowSingleLine: false }],
    'unused-imports/no-unused-vars': 'warn',
    'unused-imports/no-unused-imports': 'warn',
    'jsonc/sort-keys': 'error',
    'antfu/no-top-level-await': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'perfectionist/sort-imports': 'warn',
  },
  ignores: [
    'dist',
    'drizzle',
    'node_modules',
    'coverage',
    'build',
    'public',
    'temp',
  ],
})
