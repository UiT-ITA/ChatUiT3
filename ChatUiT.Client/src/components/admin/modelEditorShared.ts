import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEndpointDeployments, getModelCatalog } from '../../services/adminService';
import { adminEndpointsSignal, adminModelsSignal, loadAdminData } from '../../services/adminDataService';
import type {
  CatalogModelDto,
  EndpointDeploymentDto,
  EndpointDto,
  EndpointType,
  ModelDto,
  UserRole,
} from '../../types/admin';
import { ALL_ROLES } from '../../types/admin';
import { useEditorForm } from '../../hooks/useEditorForm';
import { useBusy } from '../../hooks/useBusy';
import type { ModelType } from '../../types/modelModels';

/** A model id the model id field offers. */
export interface ModelIdOption {
  value: string;
  detail?: string;
  // Marks an option that already exists as a saved model
  added?: boolean;
}

/** The catalog entry type of one model type. */
export type CatalogEntryOf<T extends ModelType> = Extract<CatalogModelDto, { type: T }>;

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
): ModelIdOption[] {
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

/** The fields every model type's form has. */
export interface BaseModelForm {
  modelId: string;
  modelName: string;
  description: string;
  endpointId: string;
  allowedRoles: UserRole[];
}

/** The shared fields for a model, or the defaults for a new one. */
export function baseModelForm(model: ModelDto | undefined, endpoints: EndpointDto[]): BaseModelForm {
  return {
    modelId: model?.modelId ?? '',
    modelName: model?.modelName ?? '',
    description: model?.description ?? '',
    // A new model starts on the first endpoint. An existing model whose endpoint was deleted starts empty, so the admin must pick one.
    endpointId: model
      ? (endpoints.some(ep => ep.id === model.endpointId) ? model.endpointId : '')
      : (endpoints[0]?.id ?? ''),
    // A new model is available to everyone; an existing one keeps exactly the roles
    // it was saved with, so opening the form can never widen access on its own.
    allowedRoles: model ? (model.allowedRoles ?? []) : [...ALL_ROLES],
  };
}

interface ModelEditorOptions<M extends ModelDto, F extends BaseModelForm, T extends ModelType> {
  // The id of the model being edited; none for a new model
  editId?: string;
  type: T;
  isType: (model: ModelDto) => model is M;
  // The form's values for a model, or the defaults for a new one
  formFor: (model: M | undefined, endpoints: EndpointDto[]) => F;
  // The fields a catalog entry fills in
  fromCatalog: (entry: CatalogEntryOf<T>) => Partial<F>;
}

/** The form, the stored model, the catalog and the save flow every model type's editor shares. */
export function useModelEditor<M extends ModelDto, F extends BaseModelForm, T extends ModelType>({ editId, type, isType, formFor, fromCatalog }: ModelEditorOptions<M, F, T>) {
  const navigate = useNavigate();
  const models = adminModelsSignal.value;
  const endpoints = adminEndpointsSignal.value ?? [];
  const stored = editId ? models?.find(m => m.id === editId) : undefined;
  const model = stored && isType(stored) ? stored : undefined;

  const { form, set, setForm, dirty } = useEditorForm(() => formFor(model, endpoints), [model, endpoints.length]);
  // The catalog entry last applied, or '' for custom values; cleared when the form resets
  const [preset, setPreset] = useState({ id: '', model, endpointCount: endpoints.length });
  const presetId = preset.model === model && preset.endpointCount === endpoints.length ? preset.id : '';
  const setPresetId = (id: string) => setPreset({ id, model, endpointCount: endpoints.length });
  const [saving, runSave] = useBusy();
  const catalog = useModelCatalog(type);
  const deployments = useEndpointDeployments(form.endpointId);

  // A change to a value the catalog fills in: the values are custom from then on
  const setCustom = (patch: Partial<F>) => {
    set(patch);
    setPresetId('');
  };

  // Overwrites the entry's fields. Model id, name and description are filled only when empty; the endpoint is never touched.
  const applyCatalogEntry = (entry: CatalogEntryOf<T>, currentModelId: string) => {
    setPresetId(entry.modelId);
    setForm(prev => ({
      ...prev,
      ...fromCatalog(entry),
      modelId: currentModelId || entry.modelId,
      modelName: prev.modelName || entry.displayName,
      description: prev.description || entry.description,
    }));
  };

  // Saves with send, reloads the admin data and returns to the model list
  const save = (send: () => Promise<unknown>) => runSave(async () => {
    await send();
    await loadAdminData(true);
    navigate('/admin/models');
  });

  return { editId, models, endpoints, model, form, set, setCustom, presetId, setPresetId, catalog, deployments, applyCatalogEntry, saving, save, dirty };
}
