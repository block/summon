/**
 * Endpoint binding — the trusted shape of a host-owned network call that an
 * intent fires. Turns the ad-hoc "set loading, fetch, catch, push" ceremony
 * into a declared contract: validate args, call fetch with an AbortSignal,
 * surface loading/data/error under a named triple of state keys.
 *
 * The sandbox never sees any of this. It only emits the intent and reads
 * the resulting state keys.
 */

import type { IntentHandler } from './policy-engine.js';

export interface EndpointStateKeys {
  /** State flag set to true while the request is in flight, false otherwise. */
  loading: string;
  /** State key where the successful result is written (null until success). */
  data: string;
  /** State key where any error message is written (null on success). */
  error: string;
}

export interface EndpointBinding<In, Out> {
  /**
   * Parse the raw args the sandbox emitted. Throw with a user-facing message
   * to reject — the error surfaces through the `error` state key.
   */
  parseArgs: (raw: Record<string, unknown>) => In;
  /**
   * Run the request. Receives an AbortSignal — pass it to fetch so superseded
   * dispatches (under `concurrency: 'latest'`) actually cancel at the socket.
   */
  fetch: (input: In, signal: AbortSignal) => Promise<Out>;
  /** Which state keys the binding writes. */
  stateKeys: EndpointStateKeys;
  /**
   * Optional patch merged in alongside `{loading: true, data: null, error: null}`
   * at dispatch start. Use for echoing the input back into state (e.g. the
   * search query) so the UI can render it before results arrive.
   */
  onStart?: (input: In) => Record<string, unknown>;
  /**
   * 'latest' (default) aborts any in-flight request when a new one fires —
   * good for type-ahead and re-clicks where only the freshest answer matters.
   * 'drop' ignores new dispatches while one is in flight — good for expensive
   * idempotent calls where duplicate work is waste.
   */
  concurrency?: 'latest' | 'drop';
  /**
   * Optional — called with the error message when parseArgs throws or fetch
   * rejects. Runs before the error is pushed into state. Use for host-side
   * dev logs; the sandbox-facing error surface is the `error` state key.
   */
  onError?: (message: string) => void;
}

/**
 * Build an IntentHandler from an endpoint binding. The returned handler
 * manages loading/error state, concurrency, and AbortSignal wiring; the
 * caller only supplies the parse, fetch, and state-key shape.
 */
export function bindEndpoint<In, Out>(
  binding: EndpointBinding<In, Out>
): IntentHandler {
  const { stateKeys, concurrency = 'latest' } = binding;
  let inflight: AbortController | null = null;

  return async ({ args, push }) => {
    let input: In;
    try {
      input = binding.parseArgs(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      binding.onError?.(message);
      push({
        [stateKeys.loading]: false,
        [stateKeys.data]: null,
        [stateKeys.error]: message,
      });
      return;
    }

    if (inflight) {
      if (concurrency === 'drop') return;
      inflight.abort();
    }

    const controller = new AbortController();
    inflight = controller;

    push({
      [stateKeys.loading]: true,
      [stateKeys.data]: null,
      [stateKeys.error]: null,
      ...binding.onStart?.(input),
    });

    try {
      const result = await binding.fetch(input, controller.signal);
      if (controller.signal.aborted) return;
      push({
        [stateKeys.loading]: false,
        [stateKeys.data]: result,
        [stateKeys.error]: null,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      binding.onError?.(message);
      push({
        [stateKeys.loading]: false,
        [stateKeys.error]: message,
      });
    } finally {
      if (inflight === controller) inflight = null;
    }
  };
}
