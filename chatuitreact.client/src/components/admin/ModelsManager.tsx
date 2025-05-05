import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import authService from '../../services/authService';
import { AiModel, AiModelType, AiModelEndpoint } from '../../types/aiModels';
import './AdminComponents.css';

const ModelsManager: React.FC = () => {
  const [models, setModels] = useState<AiModel[]>([]);
  const [endpoints, setEndpoints] = useState<AiModelEndpoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentModel, setCurrentModel] = useState<AiModel>({
    id: '',
    name: '',
    description: '',
    modelId: '',
    modelType: AiModelType.OpenAI,
    endpoint: { id: '', url: '', apiKey: '' },
    capabilities: {
      supportsVision: false,
      supportsReasoning: false,
      supportsFunctionCalling: false,
      supportsCodeInterpreter: false,
      maxContextLength: 16000,
      maxOutputLength: 4000
    }
  });

  useEffect(() => {
    loadModels();
    loadEndpoints();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get access token first to make sure we're authenticated
      const token = await authService.getAccessToken();
      if (!token) {
        setError('Authentication token not available. Please sign in again.');
        setLoading(false);
        return;
      }
      
      const data = await adminService.getAllModels();
      setModels(data);
    } catch (err: any) {
      setError(`Failed to load models: ${err.message || 'Unknown error'}`);
      console.error('Error loading models:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEndpoints = async () => {
    try {
      // Get access token first to make sure we're authenticated
      const token = await authService.getAccessToken();
      if (!token) {
        console.error('Authentication token not available');
        return;
      }
      
      const data = await adminService.getAllEndpoints();
      setEndpoints(data);
    } catch (err: any) {
      console.error('Failed to load endpoints:', err);
    }
  };

  const resetForm = () => {
    setCurrentModel({
      id: '',
      name: '',
      description: '',
      modelId: '',
      modelType: AiModelType.OpenAI,
      endpoint: { id: '', url: '', apiKey: '' },
      capabilities: {
        supportsVision: false,
        supportsReasoning: false,
        supportsFunctionCalling: false,
        supportsCodeInterpreter: false,
        maxContextLength: 16000,
        maxOutputLength: 4000
      }
    });
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'endpointId') {
      setCurrentModel({
        ...currentModel,
        endpoint: {
          ...currentModel.endpoint,
          id: value
        }
      });
    } else if (name.startsWith('capabilities.')) {
      const capabilityName = name.split('.')[1];
      let capabilityValue: any = value;
      
      // Handle boolean values for checkboxes
      if (e.target.type === 'checkbox') {
        const checkbox = e.target as HTMLInputElement;
        capabilityValue = checkbox.checked;
      }
      
      // Handle number values
      if (capabilityName === 'maxContextLength' || capabilityName === 'maxOutputLength') {
        capabilityValue = parseInt(value);
      }
      
      setCurrentModel({
        ...currentModel,
        capabilities: {
          ...currentModel.capabilities,
          [capabilityName]: capabilityValue
        }
      });
    } else {
      setCurrentModel({ ...currentModel, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    
    // Validate form fields
    if (!currentModel.name.trim()) {
      setError('Model name is required');
      return;
    }
    
    if (!currentModel.modelId.trim()) {
      setError('Model ID is required');
      return;
    }
    
    // Make sure we have a valid endpoint selected
    if (!currentModel.endpoint || !currentModel.endpoint.id) {
      setError('Please select a valid endpoint');
      return;
    }
    
    try {
      // Prepare model data for submission
      
      if (isEditing) {
        await adminService.updateModel(currentModel.id, currentModel);
      } else {
        await adminService.createModel(currentModel);
      }
      
      resetForm();
      loadModels();
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error';
      setError(`Failed to ${isEditing ? 'update' : 'create'} model: ${errorMessage}`);
      console.error(err);
    }
  };

  const handleEdit = (model: AiModel) => {
    setCurrentModel(model);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this model?')) {
      try {
        await adminService.deleteModel(id);
        loadModels();
      } catch (err) {
        setError('Failed to delete model. Please try again.');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading models...</div>;
  }

  return (
    <div className="admin-component">
      <h3>Manage Models</h3>
      
      {error && <div className="admin-error">{error}</div>}
      
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Model Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={currentModel.name}
              onChange={handleInputChange}
              required
              placeholder="Model Name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="modelId">Model ID:</label>
            <input
              type="text"
              id="modelId"
              name="modelId"
              value={currentModel.modelId}
              onChange={handleInputChange}
              required
              placeholder="gpt-4-turbo, Claude-3, etc."
            />
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={currentModel.description}
            onChange={handleInputChange}
            rows={3}
            placeholder="Enter model description"
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="modelType">Model Type:</label>
            <select
              id="modelType"
              name="modelType"
              value={currentModel.modelType}
              onChange={handleInputChange}
              required
            >
              <option value={AiModelType.AzureOpenAI}>Azure OpenAI</option>
              <option value={AiModelType.OpenAI}>OpenAI</option>
              <option value={AiModelType.Anthropic}>Anthropic</option>
              <option value={AiModelType.LlamaCpp}>Llama CPP</option>
              <option value={AiModelType.Other}>Other</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="endpointId">Endpoint:</label>
            <select
              id="endpointId"
              name="endpointId"
              value={currentModel.endpoint.id}
              onChange={handleInputChange}
              required
            >
              <option value="">Select an endpoint</option>
              {endpoints.map(endpoint => (
                <option key={endpoint.id} value={endpoint.id}>
                  {endpoint.url}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <h4>Capabilities</h4>
        
        <div className="form-row">
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="supportsVision"
              name="capabilities.supportsVision"
              checked={currentModel.capabilities.supportsVision}
              onChange={handleInputChange}
            />
            <label htmlFor="supportsVision">Supports Vision</label>
          </div>
          
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="supportsReasoning"
              name="capabilities.supportsReasoning"
              checked={currentModel.capabilities.supportsReasoning}
              onChange={handleInputChange}
            />
            <label htmlFor="supportsReasoning">Supports Reasoning</label>
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="supportsFunctionCalling"
              name="capabilities.supportsFunctionCalling"
              checked={currentModel.capabilities.supportsFunctionCalling}
              onChange={handleInputChange}
            />
            <label htmlFor="supportsFunctionCalling">Supports Function Calling</label>
          </div>
          
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="supportsCodeInterpreter"
              name="capabilities.supportsCodeInterpreter"
              checked={currentModel.capabilities.supportsCodeInterpreter}
              onChange={handleInputChange}
            />
            <label htmlFor="supportsCodeInterpreter">Supports Code Interpreter</label>
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="maxContextLength">Max Context Length:</label>
            <input
              type="number"
              id="maxContextLength"
              name="capabilities.maxContextLength"
              value={currentModel.capabilities.maxContextLength}
              onChange={handleInputChange}
              min="1"
              step="1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="maxOutputLength">Max Output Length:</label>
            <input
              type="number"
              id="maxOutputLength"
              name="capabilities.maxOutputLength"
              value={currentModel.capabilities.maxOutputLength}
              onChange={handleInputChange}
              min="1"
              step="1"
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {isEditing ? 'Update Model' : 'Add Model'}
          </button>
          
          {isEditing && (
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      
      <div className="admin-list">
        <h4>Existing Models</h4>
        
        {models.length === 0 ? (
          <p>No models found. Add one to get started.</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-header">
              <div className="col">Name</div>
              <div className="col">Model ID</div>
              <div className="col">Endpoint</div>
              <div className="col">Actions</div>
            </div>
            
            {models.map((model) => (
              <div key={model.id} className="admin-table-row">
                <div className="col">{model.name}</div>
                <div className="col">{model.modelId}</div>
                <div className="col">{model.endpoint?.url}</div>
                <div className="col actions">
                  <button 
                    onClick={() => handleEdit(model)} 
                    className="btn-small"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(model.id)} 
                    className="btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelsManager;
