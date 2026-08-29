import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0';
process.env['LOG_LEVEL'] = 'silent';
process.env['APP_URL'] = 'http://localhost:3000';
process.env['CLIENT_ORIGINS'] = 'http://localhost:5173';
process.env['DATABASE_URL'] = 'postgres://postgres:postgres@localhost:5432/rag_notebook_test';

const usersRepo = await import('../src/repository/users.repo.js');
const workspacesRepo = await import('../src/repository/workspaces.repo.js');
const limits = await import('../src/services/entitlements/limits.js');
const { estimateTokens } = await import('../src/services/entitlements/tokens.js');
const { AppError } = await import('../src/errors/AppError.js');
const contract = await import('../src/contract/index.js');

type UserRow = Awaited<ReturnType<typeof usersRepo.findUserById>>;

function mkUser(planTier: 'FREE' | 'PRO' | 'CUSTOM'): NonNullable<UserRow> {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    clerkUserId: 'clerk_x',
    email: 'x@example.com',
    displayName: null,
    signUpType: null,
    planTier,
    assignedTokens: null,
    usedTokensEmbedding: 0n,
    usedTokensCompletion: 0n,
    isActive: true,
    isBlocked: false,
    blockedAt: null,
    blockedReason: null,
    planUpdatedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

async function expectAppError(
  p: Promise<unknown>,
  code: string,
): Promise<InstanceType<typeof AppError>> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    const app = err as InstanceType<typeof AppError>;
    expect(app.code).toBe(code);
    return app;
  }
  throw new Error(`expected AppError(${code}), got no throw`);
}

beforeEach(() => {
  vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser('FREE'));
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('countWords', () => {
  const cases: Array<[string, string, number]> = [
    ['empty string', '', 0],
    ['single word', 'hello', 1],
    ['two words with repeated whitespace', 'hello    world', 2],
    ['leading and trailing whitespace', '   hello  ', 1],
    ['punctuation ignored', 'hello, world!', 2],
    ['contractions kept as one', "don't stop", 2],
    ['numbers count', 'room 101', 2],
    ['CJK: one glyph = one word (5 hanzi)', '你好世界呀', 5],
    ['mixed CJK + latin', 'hello 世界', 3],
    ['emoji do not count', 'hello 🌍 world 🚀🚀', 2],
    ['only whitespace', '   \t\n  ', 0],
    ['only emoji', '🚀🚀🚀', 0],
    ['unicode accents kept as one word', 'café résumé', 2],
    ['long: 5000 boundary', `${'w '.repeat(5000)}`.trim(), 5000],
  ];
  it.each(cases)('%s', (_label, input, expected) => {
    expect(limits.countWords(input)).toBe(expected);
  });
});

describe('estimateTokens', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTokens('')).toBe(0);
  });
  it('applies chars/4 * 1.15 heuristic', () => {
    expect(estimateTokens('x'.repeat(100))).toBe(29);

    expect(estimateTokens('x')).toBe(2);

    expect(estimateTokens('xxxx')).toBe(2);
  });
});

describe('upgradeUrl', () => {
  it('is derived from APP_URL and points at /billing/upgrade', () => {
    expect(limits.upgradeUrl()).toBe('http://localhost:3000/billing/upgrade');
  });
});

const FREE = contract.FREE_PLAN_LIMITS;
const PRO = contract.PRO_PLAN_LIMITS;

describe('assertCanCreateWorkspace', () => {
  it.each([
    ['FREE', 'FREE' as const, FREE.maxWorkspaces! - 1, false],
    ['FREE at boundary', 'FREE' as const, FREE.maxWorkspaces!, true],
    ['FREE over', 'FREE' as const, FREE.maxWorkspaces! + 3, true],
    ['PRO under', 'PRO' as const, PRO.maxWorkspaces! - 1, false],
    ['PRO at boundary', 'PRO' as const, PRO.maxWorkspaces!, true],
    ['PRO over', 'PRO' as const, PRO.maxWorkspaces! + 5, true],
  ])('%s', async (_label, plan, currentCount, shouldThrow) => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser(plan));
    vi.spyOn(usersRepo, 'countWorkspacesForUser').mockResolvedValue(currentCount);
    if (shouldThrow) {
      const err = await expectAppError(limits.assertCanCreateWorkspace('u'), 'PLAN_LIMIT_EXCEEDED');
      const details = err.details as { limit: number; current: number; plan: string };
      expect(details.limit).toBe(plan === 'FREE' ? FREE.maxWorkspaces : PRO.maxWorkspaces);
      expect(details.current).toBe(currentCount);
      expect(details.plan).toBe(plan);
    } else {
      await expect(limits.assertCanCreateWorkspace('u')).resolves.toBeUndefined();
    }
  });

  it('CUSTOM never enforces', async () => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser('CUSTOM'));
    vi.spyOn(usersRepo, 'countWorkspacesForUser').mockResolvedValue(999_999);
    await expect(limits.assertCanCreateWorkspace('u')).resolves.toBeUndefined();
  });
});

describe('assertCanAddSource', () => {
  function mockWorkspace(sourceCount: number): void {
    vi.spyOn(workspacesRepo, 'findWorkspaceForUser').mockResolvedValue({
      id: 'w',
      userId: 'u',
      name: 'ws',
      description: null,
      sourceCount,
      deletedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }

  it.each([
    ['FREE under', 'FREE' as const, FREE.maxSourcesPerWorkspace! - 2, 1, false],
    ['FREE at boundary', 'FREE' as const, FREE.maxSourcesPerWorkspace! - 1, 1, false],
    ['FREE hits boundary', 'FREE' as const, FREE.maxSourcesPerWorkspace!, 1, true],
    ['FREE over via count', 'FREE' as const, FREE.maxSourcesPerWorkspace! - 1, 2, true],
  ])('%s', async (_label, plan, currentCount, addN, shouldThrow) => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser(plan));
    mockWorkspace(currentCount);
    if (shouldThrow) {
      const err = await expectAppError(
        limits.assertCanAddSource('u', 'w', addN),
        'PLAN_LIMIT_EXCEEDED',
      );
      const details = err.details as { limit: number; current: number };
      expect(details.limit).toBe(FREE.maxSourcesPerWorkspace);
      expect(details.current).toBe(currentCount);
    } else {
      await expect(limits.assertCanAddSource('u', 'w', addN)).resolves.toBeUndefined();
    }
  });

  it('PRO is unlimited (skips workspace lookup)', async () => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser('PRO'));
    const spy = vi.spyOn(workspacesRepo, 'findWorkspaceForUser');
    await expect(limits.assertCanAddSource('u', 'w', 1_000_000)).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('zero-or-negative count is a no-op even at boundary', async () => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser('FREE'));
    const spy = vi.spyOn(workspacesRepo, 'findWorkspaceForUser');
    await expect(limits.assertCanAddSource('u', 'w', 0)).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('missing workspace throws NOT_FOUND', async () => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser('FREE'));
    vi.spyOn(workspacesRepo, 'findWorkspaceForUser').mockResolvedValue(null);
    await expectAppError(limits.assertCanAddSource('u', 'w', 1), 'NOT_FOUND');
  });
});

describe('assertPromptLength', () => {
  it.each([
    ['FREE 1 word', 'FREE' as const, 'hi', false],
    ['FREE at 5000', 'FREE' as const, `${'w '.repeat(FREE.maxPromptWords!)}`.trim(), false],
    ['FREE over 5000', 'FREE' as const, `${'w '.repeat(FREE.maxPromptWords! + 1)}`.trim(), true],
    ['PRO huge', 'PRO' as const, `${'w '.repeat(1_000_000)}`, false],
  ])('%s', async (_label, plan, content, shouldThrow) => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser(plan));
    if (shouldThrow) {
      await expectAppError(limits.assertPromptLength('u', content), 'PLAN_LIMIT_EXCEEDED');
    } else {
      await expect(limits.assertPromptLength('u', content)).resolves.toBeUndefined();
    }
  });
});

describe('assertFileSize', () => {
  it.each([
    ['FREE under', 'FREE' as const, FREE.maxFileBytes - 1, false],
    ['FREE at boundary', 'FREE' as const, FREE.maxFileBytes, false],
    ['FREE over', 'FREE' as const, FREE.maxFileBytes + 1, true],
    ['PRO under', 'PRO' as const, PRO.maxFileBytes - 1, false],
    ['PRO at boundary', 'PRO' as const, PRO.maxFileBytes, false],
    ['PRO over', 'PRO' as const, PRO.maxFileBytes + 1, true],
  ])('%s', async (_label, plan, bytes, shouldThrow) => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser(plan));
    if (shouldThrow) {
      await expectAppError(limits.assertFileSize('u', bytes), 'PLAN_LIMIT_EXCEEDED');
    } else {
      await expect(limits.assertFileSize('u', bytes)).resolves.toBeUndefined();
    }
  });
});

describe('assertPlaylistSize', () => {
  it.each([
    ['FREE under', 'FREE' as const, FREE.maxPlaylistVideos - 1, false],
    ['FREE at boundary', 'FREE' as const, FREE.maxPlaylistVideos, false],
    ['FREE over', 'FREE' as const, FREE.maxPlaylistVideos + 1, true],
    ['PRO under', 'PRO' as const, PRO.maxPlaylistVideos - 1, false],
    ['PRO at boundary', 'PRO' as const, PRO.maxPlaylistVideos, false],
    ['PRO over', 'PRO' as const, PRO.maxPlaylistVideos + 1, true],
  ])('%s', async (_label, plan, videos, shouldThrow) => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(mkUser(plan));
    if (shouldThrow) {
      await expectAppError(limits.assertPlaylistSize('u', videos), 'PLAN_LIMIT_EXCEEDED');
    } else {
      await expect(limits.assertPlaylistSize('u', videos)).resolves.toBeUndefined();
    }
  });
});

describe('missing user', () => {
  it('every assertion throws NOT_FOUND when the user is unknown', async () => {
    vi.spyOn(usersRepo, 'findUserById').mockResolvedValue(null);
    await expectAppError(limits.assertCanCreateWorkspace('u'), 'NOT_FOUND');
    await expectAppError(limits.assertCanAddSource('u', 'w', 1), 'NOT_FOUND');
    await expectAppError(limits.assertPromptLength('u', 'hi'), 'NOT_FOUND');
    await expectAppError(limits.assertFileSize('u', 1), 'NOT_FOUND');
    await expectAppError(limits.assertPlaylistSize('u', 1), 'NOT_FOUND');
  });
});

describe('no numeric limit is hardcoded outside the contract', () => {
  it('the entitlements module re-uses PLAN_LIMITS', () => {
    const l = limits.limitsForTier('FREE');
    expect('maxWorkspaces' in l && l.maxWorkspaces).toBe(FREE.maxWorkspaces);
  });
});
