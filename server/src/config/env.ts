import 'dotenv/config';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const commaSeparated = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
  .pipe(z.array(z.string().url()).min(1, 'must list at least one origin URL'));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  APP_URL: z.string().url(),
  CLIENT_ORIGINS: commaSeparated,

  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(1000).default(10),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(0).max(600_000).default(30_000),

  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),
  CHAT_MODEL: z.string().min(1).default('gpt-4o-mini'),
  EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  CLASSIFIER_MODEL: z.string().min(1).default('gpt-4o-mini'),

  QDRANT_URL: z.string().url().optional(),
  QDRANT_API_KEY: z.string().min(1).optional(),
  QDRANT_COLLECTION: z.string().min(1).default('rag_notebook_chunks'),

  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().min(1).default('rag-notebook'),

  INNGEST_EVENT_KEY: z
    .string()
    .min(1)
    .refine(
      (v) => !/[\s/?#]/.test(v),
      'must be a single URL path segment (no "/", "?", "#" or spaces)',
    )
    .optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  INNGEST_DEV: z.union([z.literal('0'), z.literal('1')]).optional(),

  LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
  LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
  LANGFUSE_BASE_URL: z.string().url().default('https://cloud.langfuse.com'),

  MEM0_API_KEY: z.string().min(1).optional(),
  TAVILY_API_KEY: z.string().min(1).optional(),
  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  YOUTUBE_API_KEY: z.string().min(1).optional(),

  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),

  RATE_LIMIT_REDIS_URL: z.string().url().optional(),
});

const ResolvedEnvSchema = EnvSchema.superRefine((data, ctx) => {
  const isDev =
    data.INNGEST_DEV !== undefined ? data.INNGEST_DEV === '1' : data.NODE_ENV !== 'production';
  if (isDev) return;
  if (data.INNGEST_EVENT_KEY === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['INNGEST_EVENT_KEY'],
      message: 'is required when Inngest runs in cloud mode (NODE_ENV=production or INNGEST_DEV=0)',
    });
  }
  if (data.INNGEST_SIGNING_KEY === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['INNGEST_SIGNING_KEY'],
      message: 'is required when Inngest runs in cloud mode (NODE_ENV=production or INNGEST_DEV=0)',
    });
  }
}).transform((data) => ({
  ...data,
  INNGEST_DEV:
    data.INNGEST_DEV !== undefined ? data.INNGEST_DEV === '1' : data.NODE_ENV !== 'production',
}));

export type Env = z.infer<typeof ResolvedEnvSchema>;

function formatIssues(err: z.ZodError): string {
  return err.issues
    .map((issue) => {
      const pathStr = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  - ${pathStr}: ${issue.message}`;
    })
    .join('\n');
}

function loadEnv(): Env {
  const result = ResolvedEnvSchema.safeParse(process.env);
  if (!result.success) {
    process.stderr.write('\n[config/env] Environment validation failed. Fix these and retry:\n');
    process.stderr.write(`${formatIssues(result.error)}\n\n`);
    process.exit(1);
  }
  return Object.freeze(result.data);
}

export const env: Env = loadEnv();
