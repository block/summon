import { useEffect, useState } from 'react';
import { parseModelProviders } from '../modelProviders.js';
import type { GhostRootInfo, ModelProviderInfo } from '../types.js';

export function useWorkbenchCatalogs() {
  const [ghostRoots, setGhostRoots] = useState<GhostRootInfo[]>([]);
  const [modelProviders, setModelProviders] = useState<ModelProviderInfo[]>([]);
  const [defaultModelProviderId, setDefaultModelProviderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadWorkbenchData() {
      try {
        const res = await fetch('/api/model-providers');
        if (res.ok) {
          const parsed = parseModelProviders(await res.json());
          if (active) {
            setModelProviders(parsed.providers);
            setDefaultModelProviderId(parsed.defaultProvider);
          }
        }
      } catch {
        if (active) {
          setModelProviders([]);
          setDefaultModelProviderId(null);
        }
      }
      try {
        const res = await fetch('/api/fingerprints');
        const payload = res.ok ? await res.json() as GhostRootInfo[] : [];
        if (active) setGhostRoots(Array.isArray(payload) ? payload : []);
      } catch {
        if (active) setGhostRoots([]);
      }
    }
    void loadWorkbenchData();
    return () => {
      active = false;
    };
  }, []);

  return {
    ghostRoots,
    modelProviders,
    defaultModelProviderId,
  };
}
