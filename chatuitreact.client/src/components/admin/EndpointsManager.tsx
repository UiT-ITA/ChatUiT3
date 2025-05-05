import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import authService from '../../services/authService';
import { AiModelEndpoint } from '../../types/aiModels';
import './AdminComponents.css';

const EndpointsManager: React.FC = () => {
  const [endpoints, setEndpoints] = useState<AiModelEndpoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<AiModelEndpoint>({
    id: '',
    url: '',
    apiKey: ''
  });

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
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
      
      const data = await adminService.getAllEndpoints();
      setEndpoints(data);
    } catch (err: any) {
      setError(`Failed to load endpoints: ${err.message || 'Unknown error'}`);
      console.error('Error loading endpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentEndpoint({ ...currentEndpoint, [name]: value });
  };

  const resetForm = () => {
    setCurrentEndpoint({ id: '', url: '', apiKey: '' });
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate required fields
    if (!currentEndpoint.url.trim()) {
      setError('Endpoint URL is required');
      return;
    }
    
    if (!currentEndpoint.apiKey.trim()) {
      setError('API Key is required');
      return;
    }
    
    try {
      // Process endpoint data for submission
      
      if (isEditing) {
        await adminService.updateEndpoint(currentEndpoint.id, currentEndpoint);
      } else {
        await adminService.createEndpoint(currentEndpoint);
      }
      resetForm();
      loadEndpoints();
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error';
      setError(`Failed to ${isEditing ? 'update' : 'create'} endpoint: ${errorMessage}`);
      console.error(err);
    }
  };

  const handleEdit = (endpoint: AiModelEndpoint) => {
    setCurrentEndpoint(endpoint);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this endpoint?')) {
      try {
        await adminService.deleteEndpoint(id);
        loadEndpoints();
      } catch (err) {
        setError('Failed to delete endpoint. Please try again.');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading endpoints...</div>;
  }

  return (
    <div className="admin-component">
      <h3>Manage Endpoints</h3>
      
      {error && <div className="admin-error">{error}</div>}
      
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-group">
          <label htmlFor="url">URL:</label>
          <input
            type="text"
            id="url"
            name="url"
            value={currentEndpoint.url}
            onChange={handleInputChange}
            required
            placeholder="https://api.example.com/v1"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="apiKey">API Key:</label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            value={currentEndpoint.apiKey}
            onChange={handleInputChange}
            required
            placeholder="Enter API key"
          />
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {isEditing ? 'Update Endpoint' : 'Add Endpoint'}
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
        <h4>Existing Endpoints</h4>
        
        {endpoints.length === 0 ? (
          <p>No endpoints found. Add one to get started.</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-header">
              <div className="col">URL</div>
              <div className="col">Actions</div>
            </div>
            
            {endpoints.map((endpoint) => (
              <div key={endpoint.id} className="admin-table-row">
                <div className="col">{endpoint.url}</div>
                <div className="col actions">
                  <button 
                    onClick={() => handleEdit(endpoint)} 
                    className="btn-small"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(endpoint.id)} 
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

export default EndpointsManager;
