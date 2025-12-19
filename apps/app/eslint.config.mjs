import antfu from '@antfu/eslint-config'

export default antfu(
  {
    stylistic: true,
    rules: {
      'vue/attributes-order': ['error', {
        alphabetical: true,
      }],
      'vue/component-name-in-template-casing': ['error', 'PascalCase', {
        registeredComponentsOnly: true,
      }],
      'no-console': 'off',
      'antfu/if-newline': 'off',
      'nonblock-statement-body-position': 'error',
      'curly': ['error', 'multi-line', 'consistent'],
      'style/brace-style': ['error', '1tbs', { allowSingleLine: false }],
      'unused-imports/no-unused-vars': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'vue/custom-event-name-casing': ['error', 'camelCase', { ignores: ['/^[a-z]+(?:-[a-z]+)*:[a-z]+(?:-[a-z]+)*$/u'] }],
      'jsonc/sort-keys': 'error',
      'unicorn/prefer-node-protocol': 'off',
    },
    ignores: ['src-tauri/**'],
  },
)
