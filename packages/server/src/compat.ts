import type { ProtocolLine } from '@summon/engine';
import { runSurfaceGeneration } from './runner.js';
import type {
  GenerateSurfaceInput,
  GenerationSummary,
} from './types.js';

export async function* generateSurfaceStream(
  input: GenerateSurfaceInput,
): AsyncGenerator<ProtocolLine, GenerationSummary, void> {
  const queue: ProtocolLine[] = [];
  let wake: (() => void) | null = null;
  let done = false;
  let summary: GenerationSummary | null = null;
  let thrown: unknown;
  const wakeConsumer = () => {
    if (!wake) return;
    wake();
    wake = null;
  };
  const runner = runSurfaceGeneration(input, (line) => {
    queue.push(line);
    wakeConsumer();
  })
    .then((nextSummary) => {
      summary = nextSummary;
    })
    .catch((err) => {
      thrown = err;
    })
    .finally(() => {
      done = true;
      wakeConsumer();
    });

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
      continue;
    }
    yield queue.shift()!;
  }

  await runner;
  if (thrown) throw thrown;
  return summary!;
}
