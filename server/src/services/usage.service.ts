import { listUsageForUser } from '@/repository/usage.repo.js';

export const DEFAULT_USAGE_WINDOW_DAYS = 30;

export interface UsageDay {
  date: string;
  promptTokens: number;
  completionTokens: number;
  embeddingTokens: number;
  messageCount: number;
}

export interface UsageSummary {
  days: UsageDay[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    embeddingTokens: number;
    messageCount: number;
  };
}

function isoDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function getUsageSummary(
  userId: string,
  windowDays: number = DEFAULT_USAGE_WINDOW_DAYS,
): Promise<UsageSummary> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - windowDays + 1);

  const rows = await listUsageForUser(userId, isoDate(since));

  const days: UsageDay[] = rows.map((r) => ({
    date: r.date,
    promptTokens: 0,
    completionTokens: Number(r.completionTokens),
    embeddingTokens: Number(r.embeddingTokens),
    messageCount: r.requestCount,
  }));

  const totals = days.reduce(
    (acc, d) => {
      acc.promptTokens += d.promptTokens;
      acc.completionTokens += d.completionTokens;
      acc.embeddingTokens += d.embeddingTokens;
      acc.messageCount += d.messageCount;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, embeddingTokens: 0, messageCount: 0 },
  );

  return { days, totals };
}
