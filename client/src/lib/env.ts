/**
 * Runtime-validated environment variables. Import from here everywhere.
 * Nothing else in the app reads `process.env`.
 */
import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_CONTRACT_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/, "expected semver x.y.z"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  CLERK_SECRET_KEY: z.string().min(1),
});

const isServer = typeof window === "undefined";

// Next inlines NEXT_PUBLIC_* at build time only via literal `process.env.X` references,
// so the map must list them explicitly rather than iterating.
const publicRaw = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_CONTRACT_VERSION: process.env.NEXT_PUBLIC_CONTRACT_VERSION,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
};

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid ${label} environment variables:\n${issues}`);
  }
  return result.data;
}

const publicEnv = parse(clientSchema, publicRaw, "public");
const serverEnv = isServer
  ? parse(serverSchema, { CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY }, "server")
  : ({} as z.infer<typeof serverSchema>);

  export const env = { ...publicEnv, ...serverEnv };
export type Env = typeof env;
