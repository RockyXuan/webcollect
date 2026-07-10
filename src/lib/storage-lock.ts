const processLockTails = new Map<string, Promise<void>>();

async function withProcessLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const previous = processLockTails.get(name) || Promise.resolve();
  let release!: () => void;
  const ticket = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => ticket);
  processLockTails.set(name, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (processLockTails.get(name) === tail) {
      processLockTails.delete(name);
    }
  }
}

export async function withStorageLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const lockName = `webcollect:${name}`;
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(lockName, () => withProcessLock(lockName, operation));
  }
  return withProcessLock(lockName, operation);
}
