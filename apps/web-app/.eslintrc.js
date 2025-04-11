module.exports = {
  root: true,
  env: {
    browser: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: 'latest'
  },
  extends: [
    'eslint:recommended',
    'standard',
    'plugin:vue/recommended',
    'plugin:nuxt/recommended'
  ],
  plugins: [
  ],
  // add your custom rules here
  rules: {
    'vue/multi-word-component-names': 'off',
    curly: 'off',
    'no-console': 'off'
  }
}
