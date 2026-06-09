import type { ProtocolLine } from '@summon-internal/engine';

type WritableEvent = 'drain' | 'error' | 'close';
type WritableListener = (...args: unknown[]) => void;

export interface ProtocolLineWritableTarget {
  write(chunk: string): boolean;
  once(event: WritableEvent, listener: WritableListener): unknown;
  off?(event: WritableEvent, listener: WritableListener): unknown;
  removeListener?(event: WritableEvent, listener: WritableListener): unknown;
  writableEnded?: boolean;
  destroyed?: boolean;
}

export interface ProtocolLineWriterOptions {
  signal?: AbortSignal;
}

export function createProtocolLineWriter(
  target: ProtocolLineWritableTarget,
  options: ProtocolLineWriterOptions = {},
): (line: ProtocolLine) => Promise<void> {
  let queue = Promise.resolve();

  return (line) => {
    const payload = `${JSON.stringify(line)}\n`;
    const write = queue.then(() => writePayload(target, payload, options.signal));
    queue = write.catch(() => {});
    return write;
  };
}

async function writePayload(
  target: ProtocolLineWritableTarget,
  payload: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  assertWritable(target, signal);
  let acceptsMore = false;
  try {
    acceptsMore = target.write(payload);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
  assertWritable(target, signal);
  if (acceptsMore) return;
  await waitForDrain(target, signal);
}

function waitForDrain(
  target: ProtocolLineWritableTarget,
  signal: AbortSignal | undefined,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      removeListener(target, 'drain', onDrain);
      removeListener(target, 'error', onError);
      removeListener(target, 'close', onClose);
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (fn: () => void) => {
      cleanup();
      fn();
    };
    const onDrain = () => finish(resolve);
    const onError = (err: unknown) => finish(() => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
    const onClose = () => finish(() => {
      reject(new Error('Protocol line writable closed before drain'));
    });
    const onAbort = () => finish(() => {
      reject(abortError(signal));
    });

    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    if (target.destroyed || target.writableEnded) {
      reject(new Error('Protocol line writable is closed'));
      return;
    }

    target.once('drain', onDrain);
    target.once('error', onError);
    target.once('close', onClose);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    if (target.destroyed || target.writableEnded) {
      onClose();
    }
  });
}

function assertWritable(
  target: ProtocolLineWritableTarget,
  signal: AbortSignal | undefined,
): void {
  if (signal?.aborted) throw abortError(signal);
  if (target.destroyed || target.writableEnded) {
    throw new Error('Protocol line writable is closed');
  }
}

function removeListener(
  target: ProtocolLineWritableTarget,
  event: WritableEvent,
  listener: WritableListener,
): void {
  if (target.off) {
    target.off(event, listener);
    return;
  }
  target.removeListener?.(event, listener);
}

function abortError(signal: AbortSignal | undefined): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error('Protocol line write aborted');
  error.name = 'AbortError';
  return error;
}
