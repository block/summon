import { parseSurfaceEnvelope, type SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import { maxSavedSurfaces, savedSurfacesKey } from './constants.js';

export function loadSavedSurfaces(): SurfaceEnvelope[] {
  try {
    const raw = window.localStorage.getItem(savedSurfacesKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const envelope = parseSurfaceEnvelope(item);
          return envelope ? [envelope] : [];
        })
      : [];
  } catch {
    return [];
  }
}

export function writeSavedSurfaces(items: SurfaceEnvelope[]) {
  window.localStorage.setItem(savedSurfacesKey, JSON.stringify(items.slice(0, maxSavedSurfaces)));
}
