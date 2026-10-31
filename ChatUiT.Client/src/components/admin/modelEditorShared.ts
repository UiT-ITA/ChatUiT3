import { useEffect, useState } from 'react';
import { getEndpointDeployments, getModelCatalog } from '../../services/adminService';
import type {
  CatalogModelDto,
  EndpointDeploymentDto,
  EndpointType,
  ModelDto,
  UserRole,
} from '../../types/admin';
import type { ModelType } from '../../types/modelModels';
import type { ModelComboboxOption } from './ModelCombobox';

/** The roles, catalog and deployment lookups every model type's editor shares. */

export const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

type CatalogEntryOf<T extends ModelType> = Extract<CatalogModelDto, { type: T }>;

/** The catalog entries of one model type. Empty until loaded, and when the fetch fails: the catalog only prefills. */
export function useModelCatalog<T extends ModelType>(type: T): CatalogEntryOf<T>[] {
  const [catalog, setCatalog] = useState<CatalogModelDto[]>([]);

  useEffect(() => {
    getModelCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  return catalog.filter((entry): entry is CatalogEntryOf<T> => entry.type === type);
}

/** The deployments listed for an endpoint. `loaded` is false while they load; `items` is empty when the endpoint cannot list them. */
export function useEndpointDeployments(endpointId: string): { loaded: boolean; items: EndpointDeploymentDto[] } {
  const [deployments, setDeployments] = useState<{ endpointId: string; items: EndpointDeploymentDto[] }>({ endpointId: '', items: [] });

  useEffect(() => {
    if (!endpointId) return;
    let cancelled = false;
    getEndpointDeployments(endpointId)
      .then(items => { if (!cancelled) setDeployments({ endpointId, items }); })
      .catch(() => { if (!cancelled) setDeployments({ endpointId, items: [] }); });
    return () => { cancelled = true; };
  }, [endpointId]);

  const loaded = deployments.endpointId === endpointId;
  return { loaded, items: loaded ? deployments.items : [] };
}

/** The endpoint's deployments, or the catalog entries for its type when it lists none. Each is marked when a model already uses it. */
export function modelIdOptions(
  deployments: { loaded: boolean; items: EndpointDeploymentDto[] },
  catalog: CatalogModelDto[],
  endpointType: EndpointType | undefined,
  models: ModelDto[] | undefined,
  endpointId: string,
): ModelComboboxOption[] {
  const options = !deployments.loaded
    ? []
    : deployments.items.length > 0
      ? deployments.items.map(d => ({ value: d.name, detail: d.model !== d.name ? d.model : undefined }))
      : catalog.filter(c => c.provider === endpointType).map(c => ({ value: c.modelId, detail: c.displayName }));
  return options.map(o => ({ ...o, added: models?.some(m => m.endpointId === endpointId && m.modelId.toLowerCase() === o.value.toLowerCase()) ?? false }));
}

/**
 * The catalog entry a model id points at: for a listed deployment, the entry for the model it
 * runs; without a list, the entry whose id equals the typed value. None while the deployments load.
 */
export function catalogEntryForModelId<T extends CatalogModelDto>(
  value: string,
  deployments: { loaded: boolean; items: EndpointDeploymentDto[] },
  catalog: T[],
): T | undefined {
  if (!deployments.loaded) return undefined;
  const find = (id: string) => catalog.find(c => c.modelId.toLowerCase() === id.toLowerCase());
  if (deployments.items.length === 0) return find(value);
  const deployment = deployments.items.find(d => d.name.toLowerCase() === value.toLowerCase());
  return deployment ? find(deployment.model) : undefined;
}
