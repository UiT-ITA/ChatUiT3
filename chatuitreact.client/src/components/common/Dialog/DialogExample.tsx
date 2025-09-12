import React, { useState } from 'react';
import { Dialog, DialogPage, DialogButton } from './index';
import './DialogExample.css';

interface DialogExampleProps {
  isOpen?: boolean;
  onClose?: () => void;
}

// Example component demonstrating all Dialog usage patterns
export const DialogExample: React.FC<DialogExampleProps> = ({ 
  isOpen = true, 
  onClose = () => {} 
}) => {
  const [simpleDialogOpen, setSimpleDialogOpen] = useState(false);
  const [sidebarDialogOpen, setSidebarDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [complexDialogOpen, setComplexDialogOpen] = useState(false);

  return (
    <>
      {/* Main Dialog Examples Modal */}
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Dialog System Examples"
        size="medium"
      >
        <div className="dialog-example-container">
          <p className="dialog-example-description">
            Click the buttons below to see different dialog patterns in action:
          </p>
          
          {/* Example buttons */}
          <button 
            onClick={() => setSimpleDialogOpen(true)}
            className="dialog-example-button"
          >
            Simple Dialog
          </button>
          
          <button 
            onClick={() => setSidebarDialogOpen(true)}
            className="dialog-example-button"
          >
            Sidebar Dialog
          </button>
          
          <button 
            onClick={() => setActionDialogOpen(true)}
            className="dialog-example-button"
          >
            Dialog with Actions
          </button>
          
          <button 
            onClick={() => setComplexDialogOpen(true)}
            className="dialog-example-button"
          >
            Complex Dialog
          </button>
        </div>
        
        <DialogButton variant="secondary" onClick={onClose}>
          Close
        </DialogButton>
      </Dialog>

      {/* Simple Dialog - no sidebar, no actions */}
      <Dialog
        isOpen={simpleDialogOpen}
        onClose={() => setSimpleDialogOpen(false)}
        title="Simple Dialog"
        size="medium"
      >
        <div className="dialog-example-section">
          <h3>Simple Content</h3>
          <p>This is a simple dialog with just content. No sidebar or action buttons.</p>
          <p>It automatically sizes itself and provides a clean, consistent look.</p>
        </div>
      </Dialog>

      {/* Sidebar Dialog - multiple pages, no actions */}
      <Dialog
        isOpen={sidebarDialogOpen}
        onClose={() => setSidebarDialogOpen(false)}
        title="Settings Example"
        size="large"
      >
        <DialogPage id="appearance" label="Appearance" icon="settings">
          <div className="dialog-example-section">
            <h3>Appearance Settings</h3>
            <p>Theme, colors, and visual preferences would go here.</p>
            <div className="dialog-example-form-group">
              <label className="dialog-example-inline-label">
                Theme:
                <select className="dialog-example-select">
                  <option>Light</option>
                  <option>Dark</option>
                  <option>Auto</option>
                </select>
              </label>
            </div>
          </div>
        </DialogPage>
        
        <DialogPage id="account" label="Account" icon="user">
          <div className="dialog-example-section">
            <h3>Account Settings</h3>
            <p>User profile and account management options.</p>
            <div className="dialog-example-form-group">
              <label className="dialog-example-inline-label">
                Username:
                <input 
                  type="text" 
                  placeholder="Enter username"
                  className="dialog-example-input"
                />
              </label>
            </div>
          </div>
        </DialogPage>
        
        <DialogPage id="privacy" label="Privacy" icon="admin">
          <div className="dialog-example-section">
            <h3>Privacy Settings</h3>
            <p>Data handling and privacy controls.</p>
            <div className="dialog-example-checkbox-group">
              <label className="dialog-example-checkbox-label">
                <input type="checkbox" className="dialog-example-checkbox" />
                Enable analytics
              </label>
            </div>
          </div>
        </DialogPage>
      </Dialog>

      {/* Action Dialog - content with action buttons */}
      <Dialog
        isOpen={actionDialogOpen}
        onClose={() => setActionDialogOpen(false)}
        title="Confirm Action"
        size="small"
      >
        <div className="dialog-example-warning">
          <h3>Delete Item</h3>
          <p>Are you sure you want to delete this item? This action cannot be undone.</p>
        </div>
        
        <DialogButton 
          variant="secondary" 
          onClick={() => setActionDialogOpen(false)}
        >
          Cancel
        </DialogButton>
        
        <DialogButton 
          variant="danger" 
          onClick={() => {
            alert('Item deleted!');
            setActionDialogOpen(false);
          }}
        >
          Delete
        </DialogButton>
      </Dialog>

      {/* Complex Dialog - sidebar + actions */}
      <Dialog
        isOpen={complexDialogOpen}
        onClose={() => setComplexDialogOpen(false)}
        title="Create Assistant"
        size="large"
      >
        <DialogPage id="details" label="Details" icon="user">
          <div className="dialog-example-section">
            <h3>Assistant Details</h3>
            <div className="dialog-example-form-columns">
              <div className="dialog-example-form-group">
                <label>Name:</label>
                <input 
                  type="text" 
                  placeholder="Assistant name"
                  className="dialog-example-input"
                />
              </div>
              <div className="dialog-example-form-group">
                <label>Description:</label>
                <textarea 
                  placeholder="Describe your assistant"
                  className="dialog-example-textarea"
                />
              </div>
            </div>
          </div>
        </DialogPage>
        
        <DialogPage id="model" label="Model" icon="brain">
          <div className="dialog-example-section">
            <h3>Model Configuration</h3>
            <div className="dialog-example-form-columns">
              <div className="dialog-example-form-group">
                <label>Model:</label>
                <select className="dialog-example-select">
                  <option>GPT-4</option>
                  <option>GPT-3.5</option>
                  <option>Claude</option>
                </select>
              </div>
              <div className="dialog-example-form-group">
                <label className="dialog-example-inline-label">
                  Temperature:
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1" 
                    defaultValue="0.7"
                    className="dialog-example-range"
                  />
                </label>
              </div>
            </div>
          </div>
        </DialogPage>
        
        <DialogPage id="tools" label="Tools" icon="settings">
          <div className="dialog-example-section">
            <h3>Available Tools</h3>
            <div className="dialog-example-checkbox-group">
              <label className="dialog-example-checkbox-label">
                <input type="checkbox" className="dialog-example-checkbox" />
                Web Search
              </label>
              <label className="dialog-example-checkbox-label">
                <input type="checkbox" className="dialog-example-checkbox" />
                Code Execution
              </label>
              <label className="dialog-example-checkbox-label">
                <input type="checkbox" className="dialog-example-checkbox" />
                File Analysis
              </label>
            </div>
          </div>
        </DialogPage>
        
        <DialogButton 
          variant="secondary" 
          onClick={() => setComplexDialogOpen(false)}
        >
          Cancel
        </DialogButton>
        
        <DialogButton 
          variant="primary" 
          onClick={() => {
            alert('Assistant created!');
            setComplexDialogOpen(false);
          }}
        >
          Create Assistant
        </DialogButton>
      </Dialog>
    </>
  );
};
