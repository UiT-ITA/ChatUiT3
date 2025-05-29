import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdCloud, MdSave, MdCancel } from 'react-icons/md';
import { endpointApi, modelApi, handleApiError } from '../../services/adminApiService';
import { UserRole, EndpointDto, ModelDto } from '../../types/dtos';

const ProvidersAndModels: React.FC = () => {
  const [endpoints, setEndpoints] = useState<EndpointDto[]>([]);
  const [models, setModels] = useState<ModelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [showAddModel, setShowAddModel] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [endpointsData, modelsData] = await Promise.all([
        endpointApi.getAll(),
        modelApi.getAll()
      ]);
      
      setEndpoints(endpointsData);
      setModels(modelsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEndpoint = async (formData: FormData) => {
    const url = formData.get('url') as string;
    const apiKey = formData.get('apiKey') as string;
    const endpointType = formData.get('endpointType') as string;

    if (!url || !apiKey || !endpointType) return;

    try {
      setSaving(true);
      await endpointApi.create({ url, apiKey, endpointType });
      await loadData();
      setShowAddEndpoint(false);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateModel = async (formData: FormData) => {
    const modelName = formData.get('modelName') as string;
    const endpointId = formData.get('endpointId') as string;
    
    // Get selected roles from checkboxes
    const allowedRoles: UserRole[] = [];
    Object.values(UserRole).forEach(role => {
      if (formData.get(`role_${role}`)) {
        allowedRoles.push(role);
      }
    });

    if (!modelName || !endpointId) return;

    try {
      setSaving(true);
      await modelApi.create({ modelName, endpointId, allowedRoles });
      await loadData();
      setShowAddModel(false);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEndpoint = async (id: string, formData: FormData) => {
    const url = formData.get('url') as string;
    const apiKey = formData.get('apiKey') as string;
    const endpointType = formData.get('endpointType') as string;

    if (!url || !endpointType) return;

    try {
      setSaving(true);
      await endpointApi.update(id, { 
        id, 
        url, 
        apiKey: apiKey || 'unchanged', 
        endpointType 
      });
      await loadData();
      setEditingEndpoint(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateModel = async (id: string, formData: FormData) => {
    const modelName = formData.get('modelName') as string;
    const endpointId = formData.get('endpointId') as string;
    
    // Get selected roles from checkboxes
    const allowedRoles: UserRole[] = [];
    Object.values(UserRole).forEach(role => {
      if (formData.get(`role_${role}`)) {
        allowedRoles.push(role);
      }
    });

    if (!modelName || !endpointId) return;

    try {
      setSaving(true);
      await modelApi.update(id, { id, modelName, endpointId, allowedRoles });
      await loadData();
      setEditingModel(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    try {
      setSaving(true);
      await endpointApi.delete(id);
      await loadData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;

    try {
      setSaving(true);
      await modelApi.delete(id);
      await loadData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const getEndpointName = (endpointId: string): string => {
    const endpoint = endpoints.find(e => e.id === endpointId);
    return endpoint ? `${endpoint.endpointType}` : 'Unknown';
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div>
        <div style={{ color: '#dc3545', marginBottom: '1rem' }}>
          Error: {error}
        </div>
        <button className="admin-button" onClick={loadData} disabled={saving}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-section">
        <div className="admin-section-title">
          <MdCloud size={20} />
          Providers
          <button 
            className="admin-button" 
            onClick={() => setShowAddEndpoint(true)}
            disabled={saving || showAddEndpoint}
          >
            <MdAdd size={16} /> Add Provider
          </button>
        </div>

        {showAddEndpoint && (
          <div className="admin-card">
            <h4>Add Provider</h4>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateEndpoint(new FormData(e.currentTarget));
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Endpoint URL</label>
                  <input type="url" name="url" className="admin-input" placeholder="https://api.openai.com/v1" required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">API Key</label>
                  <input type="password" name="apiKey" className="admin-input" placeholder="Enter API key" required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Type</label>
                  <select name="endpointType" className="admin-select" required>
                    <option value="">Select type</option>
                    <option value="OpenAI">OpenAI</option>
                    <option value="AzureOpenAI">Azure OpenAI</option>
                    <option value="Anthropic">Anthropic</option>
                    <option value="LlamaCpp">Llama.cpp</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="button-group">
                <button type="submit" className="admin-button" disabled={saving}>
                  <MdSave size={16} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button 
                  type="button" 
                  className="admin-button secondary" 
                  onClick={() => setShowAddEndpoint(false)}
                  disabled={saving}
                >
                  <MdCancel size={16} /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Endpoint URL</th>
              {editingEndpoint && <th>API Key</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((endpoint) => (
              <tr key={endpoint.id}>
                {editingEndpoint === endpoint.id ? (
                  <>
                    <td>
                      <select name="endpointType" className="admin-select" defaultValue={endpoint.endpointType} required>
                        <option value="OpenAI">OpenAI</option>
                        <option value="AzureOpenAI">Azure OpenAI</option>
                        <option value="Anthropic">Anthropic</option>
                        <option value="LlamaCpp">Llama.cpp</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td>
                      <input type="url" name="url" className="admin-input" defaultValue={endpoint.url} required />
                    </td>
                    <td>
                      <input type="password" name="apiKey" className="admin-input" placeholder="Enter new API key (leave empty to keep current)" />
                    </td>
                    <td>
                      <div className="button-group">
                        <button 
                          className="admin-button" 
                          onClick={(e) => {
                            const form = (e.target as HTMLElement).closest('tr');
                            if (form) {
                              const formData = new FormData();
                              const inputs = form.querySelectorAll('input, select');
                              inputs.forEach((input: any) => {
                                formData.append(input.name, input.value);
                              });
                              handleUpdateEndpoint(endpoint.id, formData);
                            }
                          }}
                          disabled={saving}
                        >
                          <MdSave size={14} />
                        </button>
                        <button 
                          className="admin-button secondary" 
                          onClick={() => setEditingEndpoint(null)}
                          disabled={saving}
                        >
                          <MdCancel size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{endpoint.endpointType}</td>
                    <td>{endpoint.url}</td>
                    {editingEndpoint && <td></td>}
                    <td>
                      <div className="button-group">
                        <button 
                          className="admin-button secondary" 
                          onClick={() => setEditingEndpoint(endpoint.id)}
                          disabled={saving || editingEndpoint !== null}
                        >
                          <MdEdit size={14} />
                        </button>
                        <button 
                          className="admin-button danger" 
                          onClick={() => handleDeleteEndpoint(endpoint.id)}
                          disabled={saving}
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          Models
          <button 
            className="admin-button" 
            onClick={() => setShowAddModel(true)}
            disabled={saving || showAddModel || endpoints.length === 0}
          >
            <MdAdd size={16} /> Add Model
          </button>
        </div>

        {showAddModel && (
          <div className="admin-card">
            <h4>Add Model</h4>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateModel(new FormData(e.currentTarget));
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Model Name</label>
                  <input type="text" name="modelName" className="admin-input" placeholder="gpt-4" required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Provider</label>
                  <select name="endpointId" className="admin-select" required>
                    <option value="">Select provider</option>
                    {endpoints.map((endpoint) => (
                      <option key={endpoint.id} value={endpoint.id}>
                        {endpoint.endpointType} - {endpoint.url}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Allowed Roles</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {Object.values(UserRole).map((role) => (
                    <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input 
                        type="checkbox" 
                        name={`role_${role}`} 
                        defaultChecked={role !== UserRole.External}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>
              <div className="button-group">
                <button type="submit" className="admin-button" disabled={saving}>
                  <MdSave size={16} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button 
                  type="button" 
                  className="admin-button secondary" 
                  onClick={() => setShowAddModel(false)}
                  disabled={saving}
                >
                  <MdCancel size={16} /> Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Model Name</th>
              <th>Provider</th>
              <th>Allowed Roles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id}>
                {editingModel === model.id ? (
                  <>
                    <td>
                      <input type="text" name="modelName" className="admin-input" defaultValue={model.modelName} required />
                    </td>
                    <td>
                      <select name="endpointId" className="admin-select" defaultValue={model.endpointId} required>
                        {endpoints.map((endpoint) => (
                          <option key={endpoint.id} value={endpoint.id}>
                            {endpoint.endpointType} - {endpoint.url}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {Object.values(UserRole).map((role) => (
                          <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                            <input 
                              type="checkbox" 
                              name={`role_${role}`} 
                              defaultChecked={model.allowedRoles?.includes(role)}
                            />
                            {role}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="button-group">
                        <button 
                          className="admin-button" 
                          onClick={(e) => {
                            const form = (e.target as HTMLElement).closest('tr');
                            if (form) {
                              const formData = new FormData();
                              const inputs = form.querySelectorAll('input, select');
                              inputs.forEach((input: any) => {
                                if (input.type === 'checkbox') {
                                  if (input.checked) {
                                    formData.append(input.name, 'on');
                                  }
                                } else {
                                  formData.append(input.name, input.value);
                                }
                              });
                              handleUpdateModel(model.id, formData);
                            }
                          }}
                          disabled={saving}
                        >
                          <MdSave size={14} />
                        </button>
                        <button 
                          className="admin-button secondary" 
                          onClick={() => setEditingModel(null)}
                          disabled={saving}
                        >
                          <MdCancel size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{model.modelName}</td>
                    <td>{getEndpointName(model.endpointId)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {model.allowedRoles?.map(role => (
                          <span key={role} style={{ 
                            backgroundColor: '#e9ecef', 
                            padding: '0.125rem 0.375rem', 
                            borderRadius: '0.25rem', 
                            fontSize: '0.75rem',
                            color: '#495057'
                          }}>
                            {role}
                          </span>
                        )) || <span style={{ color: '#6c757d', fontSize: '0.8rem' }}>No roles assigned</span>}
                      </div>
                    </td>
                    <td>
                      <div className="button-group">
                        <button 
                          className="admin-button secondary" 
                          onClick={() => setEditingModel(model.id)}
                          disabled={saving || editingModel !== null}
                        >
                          <MdEdit size={14} />
                        </button>
                        <button 
                          className="admin-button danger" 
                          onClick={() => handleDeleteModel(model.id)}
                          disabled={saving}
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProvidersAndModels;
