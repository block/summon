import { useCallback, useEffect, useState } from 'react';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import { loadSavedSurfaces, writeSavedSurfaces } from '../savedSurfaces.js';

export function useSavedSurfaces() {
  const [savedSurfaces, setSavedSurfaces] = useState<SurfaceEnvelope[]>([]);

  useEffect(() => {
    setSavedSurfaces(loadSavedSurfaces());
  }, []);

  const updateSavedSurfaces = useCallback((items: SurfaceEnvelope[]) => {
    writeSavedSurfaces(items);
    setSavedSurfaces(loadSavedSurfaces());
  }, []);

  return {
    savedSurfaces,
    updateSavedSurfaces,
  };
}
