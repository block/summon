import type { DropdownSelectOption } from '../../components/ui.js';
import type { GhostRootInfo } from './types.js';

export function fingerprintOptionFor(fingerprint: GhostRootInfo): DropdownSelectOption {
  return {
    value: fingerprint.id,
    label: fingerprint.name ?? fingerprint.id,
    meta: fingerprintOptionMeta(fingerprint),
    swatches: fingerprint.previewColors,
    title: fingerprint.summary,
  };
}

export function fingerprintOptionMeta(fingerprint: GhostRootInfo): string | undefined {
  const tags = (fingerprint.tags ?? [])
    .filter((tag) => tag.trim().length > 0)
    .slice(0, 3);
  return tags.length > 0 ? tags.join(' · ') : undefined;
}
