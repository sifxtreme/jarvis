module.exports = {
  parserOptions: {
    parser: 'babel-eslint'
  },
  env: {
    browser: true,
    node: true,
    jest: true
  },
  globals: {
    expect: true
  },
  extends: ['plugin:vue/essential', 'plugin:prettier/recommended', 'eslint:recommended'],
  plugins: ['vue', 'prettier'],
  rules: {
    'vue/max-attributes-per-line': 'off',
    'prettier/prettier': [
      // customizing prettier rules (not many of them are customizable)
      'error',
      {
        singleQuote: true,
        semi: false,
        tabWidth: 2
      }
    ],
    'no-console': 0
  }
}
