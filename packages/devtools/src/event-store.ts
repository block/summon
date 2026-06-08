import type { DevtoolsEvent, DevtoolsEventKind } from './types.js';

export interface EventStoreOptions {
  /** Max events to retain. Older events are dropped FIFO. Default: 500. */
  bufferSize?: number;
}

/**
 * Capped, subscribable ring buffer of {@link DevtoolsEvent}s. Producers (host,
 * engine, policy) push; consumers (a panel, a test assertion) subscribe and
 * read snapshots. Listeners fire synchronously after every push and clear so a
 * panel can re-render off the same tick that produced the event.
 */
export interface EventStore {
  push: (event: DevtoolsEvent) => void;
  /** Returns a fresh array (oldest first) so callers can treat it as immutable. */
  snapshot: () => DevtoolsEvent[];
  /** Returns just events of a given kind — useful for tests that want one signal. */
  filter: <K extends DevtoolsEventKind>(
    kind: K,
  ) => Extract<DevtoolsEvent, { kind: K }>[];
  /** Register a listener; returns the unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
  size: () => number;
}

export function createEventStore(options: EventStoreOptions = {}): EventStore {
  const bufferSize = Math.max(1, options.bufferSize ?? 500);
  const events: DevtoolsEvent[] = [];
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) {
      try {
        listener();
      } catch (err) {
        // A throwing listener must not poison the store. Log and move on.
        // eslint-disable-next-line no-console
        console.error('[summon devtools] listener threw:', err);
      }
    }
  }

  return {
    push(event) {
      events.push(event);
      if (events.length > bufferSize) {
        events.splice(0, events.length - bufferSize);
      }
      notify();
    },
    snapshot() {
      return events.slice();
    },
    filter(kind) {
      return events.filter((e) => e.kind === kind) as Extract<
        DevtoolsEvent,
        { kind: typeof kind }
      >[];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      if (events.length === 0) return;
      events.length = 0;
      notify();
    },
    size() {
      return events.length;
    },
  };
}
