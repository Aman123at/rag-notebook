import js from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const REPOSITORY_LAYER = [
  '@/repository/*',
  '@/repository/**',
  '**/repository/*',
  '**/repository/**',
];

const SERVICE_SDKS = [
  '@clerk/express',
  '@langfuse/*',
  '@mendable/firecrawl-js',
  '@qdrant/js-client-rest',
  '@tavily/core',
  'cloudinary',
  'googleapis',
  'ioredis',
  'mem0ai',
  'openai',
  'razorpay',
  'svix',
];

const noRepositoryLayer = {
  group: REPOSITORY_LAYER,
  message:
    'A route must not import a repository. Go through a service (CLAUDE.md Law 4, one-way rule).',
};

const noExpress = {
  group: ['express', 'express/*'],
  message:
    'A service must not import express. Keep transport concerns in src/http/ (CLAUDE.md Law 4).',
};

const noServiceSdk = {
  allowTypeImports: true,
  group: SERVICE_SDKS,
  message:
    'Third-party service SDKs are called only from src/integrations/ via a named wrapper (CLAUDE.md Law 4).',
};

const boundaryRules = (patterns) => ({
  'no-restricted-imports': 'off',
  '@typescript-eslint/no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'drizzle/**',
      'contract/dist/**',
      'evals/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      perfectionist,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'error',
      'perfectionist/sort-imports': [
        'error',
        {
          type: 'natural',
          order: 'asc',
          newlinesBetween: 1,
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'unknown'],
          internalPattern: ['^@/.*'],
        },
      ],
      'perfectionist/sort-named-imports': ['error', { type: 'natural', order: 'asc' }],
      'perfectionist/sort-exports': ['error', { type: 'natural', order: 'asc' }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs,ts}', 'tests/**/*.{ts,tsx}', 'vitest.config.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/routes/**/*.ts'],
    rules: boundaryRules([noRepositoryLayer]),
  },
  {
    files: ['src/services/**/*.ts'],
    rules: boundaryRules([noExpress, noServiceSdk]),
  },
  {
    files: [
      'src/repository/**/*.ts',
      'src/retrieval/**/*.ts',
      'src/ingestion/**/*.ts',
      'src/inngest/**/*.ts',
    ],
    rules: boundaryRules([noServiceSdk]),
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
