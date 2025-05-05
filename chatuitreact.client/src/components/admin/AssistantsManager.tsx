import React, { useState, useEffect } from 'react';
import { adminService, AiAssistant } from '../../services/adminService';
import authService from '../../services/authService';
import { AiModel } from '../../types/aiModels';
import './AdminComponents.css';

const AssistantsManager: React.FC = () => {
  const [assistants, setAssistants] = useState<AiAssistant[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentAssistant, setCurrentAssistant] = useState<AiAssistant>({
    id: '',
    name: '',
    description: '',
    systemPrompt: '',
    model: {
      id: '',
      name: '',
      description: '',
      modelId: '',
      modelType: 'OpenAI',
      endpoint: { id: '', url: '', apiKey: '' },
      capabilities: {
        supportsVision: false,
        supportsReasoning: false,
        supportsFunctionCalling: false,
        supportsCodeInterpreter: false,
        maxContextLength: 16000,
        maxOutputLength: 4000
      }
    },
    modelSettings: {
      temperature: 0.7,
      maxTokens: 4000,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      reasoningEffort: '0' // Using numeric values for enum
    },
    tools: [],
    isSystemCreated: true,
    ownerId: 'System',
    sharedWithUserIds: [],
    preloadedDocumentIds: []
  });

  useEffect(() => {
    loadAssistants();
    loadModels();
  }, []);

  const loadAssistants = async () => {
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
      
      const data = await adminService.getAllSystemAssistants();
      setAssistants(data);
    } catch (err: any) {
      setError(`Failed to load assistants: ${err.message || 'Unknown error'}`);
      console.error('Error loading assistants:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    try {
      // Get access token first to make sure we're authenticated
      const token = await authService.getAccessToken();
      if (!token) {
        console.error('Authentication token not available');
        return;
      }
      
      const data = await adminService.getAllModels();
      setModels(data);
    } catch (err: any) {
      console.error('Failed to load models:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'modelId') {
      const selectedModel = models.find(m => m.id === value);
      if (selectedModel) {
        setCurrentAssistant({
          ...currentAssistant,
          model: selectedModel
        });
      }
    } else if (name.startsWith('modelSettings.')) {
      const settingName = name.split('.')[1];
      let settingValue: any = value;
      
      // Convert numeric settings to numbers
      if (settingName !== 'reasoningEffort') {
        settingValue = parseFloat(value);
      }
      
      setCurrentAssistant({
        ...currentAssistant,
        modelSettings: {
          ...currentAssistant.modelSettings,
          [settingName]: settingValue
        }
      });
    } else {
      setCurrentAssistant({ ...currentAssistant, [name]: value });
    }
  };

  const resetForm = () => {
    setCurrentAssistant({
      id: '',
      name: '',
      description: '',
      systemPrompt: '',
      model: {
        id: '',
        name: '',
        description: '',
        modelId: '',
        modelType: 'OpenAI',
        endpoint: { id: '', url: '', apiKey: '' },
        capabilities: {
          supportsVision: false,
          supportsReasoning: false,
          supportsFunctionCalling: false,
          supportsCodeInterpreter: false,
          maxContextLength: 16000,
          maxOutputLength: 4000
        }
      },
      modelSettings: {
        temperature: 0.7,
        maxTokens: 4000,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        reasoningEffort: '0'  // Using numeric values for enum
      },
      tools: [],
      isSystemCreated: true,
      ownerId: 'System',
      sharedWithUserIds: [],
      preloadedDocumentIds: []
    });
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError(null);
    
    // Validate form fields
    if (!currentAssistant.name.trim()) {
      setError('Assistant name is required');
      return;
    }
    
    if (!currentAssistant.model || !currentAssistant.model.id) {
      setError('Please select a valid model');
      return;
    }
    
    try {
      // Create a clean, minimal version of the assistant
      const assistantToSubmit = {
        ...currentAssistant,
        // Ensure these properties are properly initialized
        description: currentAssistant.description || '',
        systemPrompt: currentAssistant.systemPrompt || '',
        modelSettings: {
          temperature: parseFloat(currentAssistant.modelSettings.temperature.toString()) || 0.7,
          maxTokens: parseInt(currentAssistant.modelSettings.maxTokens.toString()) || 4000,
          topP: parseFloat(currentAssistant.modelSettings.topP.toString()) || 1.0,
          frequencyPenalty: parseFloat(currentAssistant.modelSettings.frequencyPenalty.toString()) || 0.0,
          presencePenalty: parseFloat(currentAssistant.modelSettings.presencePenalty.toString()) || 0.0,
          reasoningEffort: currentAssistant.modelSettings.reasoningEffort || '0'
        },
        tools: currentAssistant.tools || [],
        sharedWithUserIds: currentAssistant.sharedWithUserIds || [],
        preloadedDocumentIds: currentAssistant.preloadedDocumentIds || []
      };
      
      // Process assistant data for submission
      
      if (isEditing) {
        await adminService.updateAssistant(assistantToSubmit.id, assistantToSubmit);
      } else {
        try {
          // Match C# property naming conventions (Pascal case)
          const requestBody = {
            Name: assistantToSubmit.name,
            Description: assistantToSubmit.description,
            SystemPrompt: assistantToSubmit.systemPrompt,
            ModelId: assistantToSubmit.model.id,
            ModelSettings: {
              Temperature: assistantToSubmit.modelSettings.temperature,
              MaxTokens: assistantToSubmit.modelSettings.maxTokens,
              TopP: assistantToSubmit.modelSettings.topP,
              FrequencyPenalty: assistantToSubmit.modelSettings.frequencyPenalty,
              PresencePenalty: assistantToSubmit.modelSettings.presencePenalty,
              ReasoningEffort: parseInt(assistantToSubmit.modelSettings.reasoningEffort as string)
            },
            ToolIds: [],
            SharedWithUserIds: [],
            PreloadedDocumentIds: []
          };
          
          
          const response = await fetch('/api/admin/assistants', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await authService.getAccessToken()}`
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
          }
          
          await response.json();
        } catch (apiError: any) {
          console.error('API error:', apiError);
          setError(`API Error: ${apiError.message}`);
          return;
        }
      }
      
      resetForm();
      loadAssistants();
    } catch (err: any) {
      const errorMessage = err.message || 'Unknown error';
      setError(`Failed to ${isEditing ? 'update' : 'create'} assistant: ${errorMessage}`);
      console.error(err);
    }
  };

  const handleEdit = (assistant: AiAssistant) => {
    // Convert reasoningEffort to string if it's a number
    const updatedAssistant = {
      ...assistant,
      modelSettings: {
        ...assistant.modelSettings,
        reasoningEffort: assistant.modelSettings.reasoningEffort.toString()
      }
    };
    
    setCurrentAssistant(updatedAssistant);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this assistant?')) {
      try {
        await adminService.deleteAssistant(id);
        loadAssistants();
      } catch (err) {
        setError('Failed to delete assistant. Please try again.');
        console.error(err);
      }
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading assistants...</div>;
  }

  return (
    <div className="admin-component">
      <h3>Manage System Assistants</h3>
      
      {error && <div className="admin-error">{error}</div>}
      
      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Assistant Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={currentAssistant.name}
              onChange={handleInputChange}
              required
              placeholder="Assistant Name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="model">Model:</label>
            <select
              id="modelId"
              name="modelId"
              value={currentAssistant.model.id}
              onChange={handleInputChange}
              required
            >
              <option value="">Select a model</option>
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.modelId})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={currentAssistant.description}
            onChange={handleInputChange}
            rows={2}
            placeholder="Enter assistant description"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="systemPrompt">System Prompt:</label>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            value={currentAssistant.systemPrompt}
            onChange={handleInputChange}
            rows={5}
            placeholder="Enter system prompt for this assistant"
          />
        </div>
        
        <h4>Model Settings</h4>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="modelSettings.temperature">Temperature:</label>
            <input
              type="number"
              id="modelSettings.temperature"
              name="modelSettings.temperature"
              value={currentAssistant.modelSettings.temperature}
              onChange={handleInputChange}
              min="0"
              max="2"
              step="0.1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="modelSettings.maxTokens">Max Tokens:</label>
            <input
              type="number"
              id="modelSettings.maxTokens"
              name="modelSettings.maxTokens"
              value={currentAssistant.modelSettings.maxTokens}
              onChange={handleInputChange}
              min="1"
              step="1"
            />
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="modelSettings.topP">Top P:</label>
            <input
              type="number"
              id="modelSettings.topP"
              name="modelSettings.topP"
              value={currentAssistant.modelSettings.topP}
              onChange={handleInputChange}
              min="0"
              max="1"
              step="0.01"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="modelSettings.reasoningEffort">Reasoning Effort:</label>
            <select
              id="modelSettings.reasoningEffort"
              name="modelSettings.reasoningEffort"
              value={currentAssistant.modelSettings.reasoningEffort}
              onChange={handleInputChange}
            >
              <option value="0">None</option>
              <option value="1">Low</option>
              <option value="2">Medium</option>
              <option value="3">High</option>
            </select>
          </div>
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="modelSettings.frequencyPenalty">Frequency Penalty:</label>
            <input
              type="number"
              id="modelSettings.frequencyPenalty"
              name="modelSettings.frequencyPenalty"
              value={currentAssistant.modelSettings.frequencyPenalty}
              onChange={handleInputChange}
              min="-2"
              max="2"
              step="0.1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="modelSettings.presencePenalty">Presence Penalty:</label>
            <input
              type="number"
              id="modelSettings.presencePenalty"
              name="modelSettings.presencePenalty"
              value={currentAssistant.modelSettings.presencePenalty}
              onChange={handleInputChange}
              min="-2"
              max="2"
              step="0.1"
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {isEditing ? 'Update Assistant' : 'Add Assistant'}
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
        <h4>Existing System Assistants</h4>
        
        {assistants.length === 0 ? (
          <p>No system assistants found. Add one to get started.</p>
        ) : (
          <div className="admin-table">
            <div className="admin-table-header">
              <div className="col">Name</div>
              <div className="col">Model</div>
              <div className="col">Description</div>
              <div className="col">Actions</div>
            </div>
            
            {assistants.map((assistant) => (
              <div key={assistant.id} className="admin-table-row">
                <div className="col">{assistant.name}</div>
                <div className="col">{assistant.model.name}</div>
                <div className="col">{assistant.description}</div>
                <div className="col actions">
                  <button 
                    onClick={() => handleEdit(assistant)} 
                    className="btn-small"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(assistant.id)} 
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

export default AssistantsManager;
