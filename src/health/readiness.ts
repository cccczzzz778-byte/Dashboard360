export type ReadinessChecks = {
  database: () => Promise<boolean>;
  redis?: () => Promise<boolean>;
};

export type ReadinessState = {
  ok: boolean;
  database: boolean;
  redis: boolean | null;
};

async function withTimeout(check: () => Promise<boolean>, timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race<boolean>([
      Promise.resolve().then(check).then(Boolean).catch(() => false),
      new Promise<boolean>(resolve => {
        timer = setTimeout(() => resolve(false), timeoutMs);
        timer.unref?.();
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkReadiness(checks: ReadinessChecks, timeoutMs = 1000): Promise<ReadinessState> {
  const database = await withTimeout(checks.database, timeoutMs);
  const redis = checks.redis ? await withTimeout(checks.redis, timeoutMs) : null;
  return {
    ok: database && (redis === null || redis === true),
    database,
    redis
  };
}
