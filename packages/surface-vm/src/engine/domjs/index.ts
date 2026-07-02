// Host-side glue for the domjs engine. Produces the virtual module map that
// `mountSurface` / `createVmRunner` consume, hiding the VM-internal module
// specifiers from callers.

import {
  DOMJS_CORE_MODULE_ID,
  DOMJS_CORE_SOURCE,
  DOMJS_FACADE_MODULE_ID,
  DOMJS_FACADE_SOURCE,
} from './runtime-source.generated.js';
import { parseSurfaceHtml, type HtmlTemplateNode, type ParseSurfaceHtmlOptions } from './html-parser.js';

const BOOTSTRAP_MODULE_ID = 'surface-vm:domjs-bootstrap';
const SURFACE_BOOTSTRAP_MODULE_ID = 'surface-vm:surface-document-bootstrap';
const TEMPLATE_MODULE_ID = 'surface-vm:surface-document-template';
const ENTRY_PATH = '/main.js';

// The public host-bridge specifier the model imports from. Generated surfaces
// write `import { callTool, getState, onState } from "host-bridge:summon"`, so
// the domjs module map must resolve it (the Arrow path supplies the same
// specifier). We re-export the host capability glue from the domjs core so both
// the ambient globals installed by the bootstrap and explicit imports resolve
// to the identical implementation.
const HOST_BRIDGE_MODULE_ID = 'host-bridge:summon';
const HOST_BRIDGE_SOURCE = `
export { callTool, getState, onState, emit, output } from '${DOMJS_CORE_MODULE_ID}';
`;

// The bootstrap installs the facade as ambient globals (`document`, `region`,
// `state`) so model code can use them without imports, imports the entry's
// default export, and mounts it. Authoring this way matches the fluent dialect:
// the model writes plain DOM code and `export default root`.
const BOOTSTRAP_SOURCE = `
import { document, region, state, reactive } from '${DOMJS_FACADE_MODULE_ID}';
import { mount, output, emit, callTool, getState, onState } from '${DOMJS_CORE_MODULE_ID}';

globalThis.document = document;
globalThis.region = region;
globalThis.state = state;
globalThis.reactive = reactive;
globalThis.output = output;
globalThis.callTool = callTool;
globalThis.getState = getState;
globalThis.onState = onState;

// A build-phase error (e.g. the model used an unsupported API at module top
// level) must surface as a protocol error message, not crash the runner boot.
try {
  const entry = await import('${ENTRY_PATH}');
  mount(entry.default);
} catch (e) {
  emit({ type: 'error', error: String(e && e.message ? e.message : e) });
}
`;


const SURFACE_BOOTSTRAP_SOURCE = `
import { document, region, state, reactive } from '${DOMJS_FACADE_MODULE_ID}';
import { mount, output, emit, callTool, getState, onState } from '${DOMJS_CORE_MODULE_ID}';
import { template } from '${TEMPLATE_MODULE_ID}';

globalThis.document = document;
globalThis.region = region;
globalThis.state = state;
globalThis.reactive = reactive;
globalThis.output = output;
globalThis.callTool = callTool;
globalThis.getState = getState;
globalThis.onState = onState;

function build(node) {
  if (node.kind === 'text') return document.createTextNode(node.text);
  const el = document.createElement(node.tag);
  for (const [name, value] of Object.entries(node.attrs || {})) el.setAttribute(name, value);
  for (const child of node.children || []) el.append(build(child));
  return el;
}

try {
  const root = document.createDocumentFragment();
  for (const child of template) root.append(build(child));
  document.__setRoot(root);
  if (__SURFACE_HAS_BEHAVIOR__) {
    await import('${ENTRY_PATH}');
  }
  mount(root);
} catch (e) {
  emit({ type: 'error', error: String(e && e.message ? e.message : e) });
}
`;

export interface BuildDomjsModulesOptions {
  /** The model-authored entry source (imperative HTML/JS, `export default root`). */
  entry: string;
}

export interface BuildSurfaceDocumentModulesOptions {
  /** Inert Surface Document structure. Parsed safely on the host; never via innerHTML/browser DOM. */
  html: string;
  /** Optional behavior module run after the template is installed as document root. */
  behaviorEntry?: string;
  /** Optional parser caps for tests/embedders; defaults are conservative. */
  parseOptions?: ParseSurfaceHtmlOptions;
}

export interface DomjsModules {
  modules: Record<string, string>;
  entryPath: string;
}

function templateModuleSource(nodes: HtmlTemplateNode[]): string {
  return `export const template = ${JSON.stringify(nodes)};`;
}

function surfaceBootstrapSource(hasBehavior: boolean): string {
  return SURFACE_BOOTSTRAP_SOURCE.replace('__SURFACE_HAS_BEHAVIOR__', hasBehavior ? 'true' : 'false');
}

export function buildDomjsModules(options: BuildDomjsModulesOptions): DomjsModules {
  return {
    modules: {
      [DOMJS_CORE_MODULE_ID]: DOMJS_CORE_SOURCE,
      [DOMJS_FACADE_MODULE_ID]: DOMJS_FACADE_SOURCE,
      [HOST_BRIDGE_MODULE_ID]: HOST_BRIDGE_SOURCE,
      [BOOTSTRAP_MODULE_ID]: BOOTSTRAP_SOURCE,
      [ENTRY_PATH]: options.entry,
    },
    // The runner imports the entry path; we route boot through the bootstrap
    // module instead so globals are installed before the entry evaluates.
    entryPath: BOOTSTRAP_MODULE_ID,
  };
}


export function buildSurfaceDocumentModules(options: BuildSurfaceDocumentModulesOptions): DomjsModules {
  const template = parseSurfaceHtml(options.html, options.parseOptions);
  const modules: Record<string, string> = {
    [DOMJS_CORE_MODULE_ID]: DOMJS_CORE_SOURCE,
    [DOMJS_FACADE_MODULE_ID]: DOMJS_FACADE_SOURCE,
    [HOST_BRIDGE_MODULE_ID]: HOST_BRIDGE_SOURCE,
    [TEMPLATE_MODULE_ID]: templateModuleSource(template),
    [SURFACE_BOOTSTRAP_MODULE_ID]: surfaceBootstrapSource(options.behaviorEntry !== undefined),
  };
  if (options.behaviorEntry !== undefined) modules[ENTRY_PATH] = options.behaviorEntry;
  return { modules, entryPath: SURFACE_BOOTSTRAP_MODULE_ID };
}
