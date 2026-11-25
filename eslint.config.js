import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // .lab/ holds copies (trial runs, practice repositories) that aren't the lab's own code.
  { ignores: ['**/dist/**', '**/node_modules/**', '.lab/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Tests read untyped JSON responses; allow any there instead of inline disables, which a
    // config with noInlineConfig turns into warnings.
    files: ['api/test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['scripts/**', 'tooling/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
)
