import type { ProtocolLine } from '@summon-internal/engine';
import { SurfaceGenerationSession } from './session.js';
import type {
  SurfaceGenerationInput,
  SurfaceGenerationSummary,
} from './types.js';

export async function runSurfaceGeneration(
  input: SurfaceGenerationInput,
  emit: (line: ProtocolLine) => void | Promise<void>,
): Promise<SurfaceGenerationSummary> {
  const session = new SurfaceGenerationSession(input, emit);
  await session.writeStartupLines();
  if (await session.blockPreflightIssueIfNeeded()) {
    return session.finalize();
  }
  await session.consumeProvider();
  return session.finalize();
}
