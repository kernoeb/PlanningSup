import antfu from '@antfu/eslint-config'

export default antfu(
  {
    stylistic: true,
    vue: false,
    rules: {
      'no-console': 'off',
      'antfu/if-newline': 'off',
      'nonblock-statement-body-position': 'error',
      'curly': ['error', 'multi-line', 'consistent'],
      'style/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'unused-imports/no-unused-vars': 'warn',
      'no-alert': 'off',
    },
    ignores: ['apps/web-app/'],
  },
)
