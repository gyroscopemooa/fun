import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['**/fixtures/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
