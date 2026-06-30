// surface-vm: a dialect-agnostic, capability-safe sandbox runtime.
//
// M0 surface: the wire protocol (the product) and the QuickJS runner (the
// boundary). The host renderer (protocol -> DOM) and the domjs engine
// (HTML/JS -> protocol) arrive in later milestones.

export * from './protocol.js';
export { createVmRunner } from './host/runner.js';
export type { VmRunner, VmRunnerOptions } from './host/runner.js';
export { HostRenderer } from './host/renderer.js';
export type { HostRendererOptions } from './host/renderer.js';
export { mountSurface } from './host/mount.js';
export type { MountSurfaceOptions, MountedSurface } from './host/mount.js';
export { buildDomjsModules } from './engine/domjs/index.js';
export type { BuildDomjsModulesOptions, DomjsModules } from './engine/domjs/index.js';
