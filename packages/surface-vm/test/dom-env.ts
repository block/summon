// Shared DOM environment for renderer tests. happy-dom gives us a real-enough
// document/Element/Event without a browser. Imported for side effects.

import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });

const g = globalThis as unknown as Record<string, unknown>;
g.window = window;
g.document = window.document;
g.Element = window.Element;
g.Node = window.Node;
g.Comment = window.Comment;
g.Event = window.Event;
g.MouseEvent = window.MouseEvent;
g.KeyboardEvent = window.KeyboardEvent;
g.HTMLElement = window.HTMLElement;

export function resetDocument(): void {
  window.document.body.innerHTML = '';
}

export function makeMount(): Element {
  resetDocument();
  const root = window.document.createElement('div');
  window.document.body.append(root);
  return root;
}
