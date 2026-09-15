/**
 * ESLint 配置。
 *
 * 这里只开「能抓到真 bug」的规则，不做风格检查（风格由 sass/tsconfig 管）。
 * 重点是 react-hooks —— tsc 完全抓不到 useEffect 依赖写错这类问题，
 * 而那类问题表现为「偶尔不更新」「闭包拿到旧值」，极难排查。
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  env: { es2022: true, node: true },
  rules: {
    // 依赖写错的 hooks 是隐性 bug 高发区
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // 这些是真会出事的
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-debugger': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-throw-literal': 'error',
    'require-atomic-updates': 'warn',
  },
  overrides: [
    {
      // 云函数和构建脚本跑在 Node 里，允许 console
      files: ['cloudfunctions/**/*.js', 'scripts/**/*.{js,cjs,ts}'],
      env: { node: true },
      rules: { 'no-console': 'off' },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '.tmp/', '.eslintrc.cjs'],
}
