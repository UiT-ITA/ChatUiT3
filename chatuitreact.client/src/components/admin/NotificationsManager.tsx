import React, { useState } from 'react';
import { MdAdd, MdEdit, MdDelete, MdNotifications, MdAnnouncement } from 'react-icons/md';

const NotificationsManager: React.FC = () => {
  const [notifications] = useState([
    { 
      id: '1', 
      title: 'System Maintenance', 
      message: 'Scheduled maintenance window on Sunday 2AM-4AM', 
      type: 'warning',
      active: true,
      created: '2024-03-15'
    },
    { 
      id: '2', 
      title: 'New Features Available', 
      message: 'Check out the new AI assistants we\'ve added!', 
      type: 'info',
      active: true,
      created: '2024-03-14'
    },
    { 
      id: '3', 
      title: 'Welcome Message', 
      message: 'Welcome to ChatUiT! Get started by creating your first chat.', 
      type: 'success',
      active: false,
      created: '2024-03-10'
    }
  ]);

  const [messageOfTheDay, setMessageOfTheDay] = useState(
    'Welcome to ChatUiT! Experience the power of AI conversations.'
  );

  const handleAddNotification = () => {
    console.log('Add notification clicked');
  };

  const handleEditNotification = (id: string) => {
    console.log('Edit notification:', id);
  };

  const handleDeleteNotification = (id: string) => {
    console.log('Delete notification:', id);
  };

  const handleUpdateMotd = () => {
    console.log('Update message of the day:', messageOfTheDay);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning': return '#ff9800';
      case 'error': return '#dc3545';
      case 'success': return '#28a745';
      default: return '#175ddc';
    }
  };

  return (
    <div>
      <div className="admin-section">
        <div className="admin-section-title">
          <MdAnnouncement size={20} />
          Message of the Day
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Current Message</label>
          <textarea 
            className="admin-textarea" 
            value={messageOfTheDay}
            onChange={(e) => setMessageOfTheDay(e.target.value)}
            style={{ minHeight: '80px' }}
          />
        </div>
        <button className="admin-button" onClick={handleUpdateMotd}>
          Update Message of the Day
        </button>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          <MdNotifications size={20} />
          System Notifications
          <button className="admin-button" onClick={handleAddNotification}>
            <MdAdd size={16} /> Create Notification
          </button>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Message</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td>{notification.title}</td>
                <td>
                  <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {notification.message}
                  </div>
                </td>
                <td>
                  <span 
                    style={{ 
                      color: getTypeColor(notification.type),
                      fontWeight: 500
                    }}
                  >
                    {notification.type}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${notification.active ? 'active' : 'inactive'}`}>
                    {notification.active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td>{notification.created}</td>
                <td>
                  <div className="button-group">
                    <button 
                      className="admin-button secondary" 
                      onClick={() => handleEditNotification(notification.id)}
                    >
                      <MdEdit size={14} />
                    </button>
                    <button 
                      className="admin-button danger" 
                      onClick={() => handleDeleteNotification(notification.id)}
                    >
                      <MdDelete size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          Create New Notification
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Title</label>
            <input type="text" className="admin-input" placeholder="Enter notification title" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Type</label>
            <select className="admin-select">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="success">Success</option>
            </select>
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Message</label>
          <textarea 
            className="admin-textarea" 
            placeholder="Enter notification message..."
            style={{ minHeight: '100px' }}
          />
        </div>
        <div className="admin-form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" defaultChecked />
            <span className="admin-form-label" style={{ margin: 0 }}>Active</span>
          </label>
        </div>
        <button className="admin-button">Create Notification</button>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          Notification Settings
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="admin-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" defaultChecked />
              <span className="admin-form-label" style={{ margin: 0 }}>Show notifications on login</span>
            </label>
          </div>
          <div className="admin-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" defaultChecked />
              <span className="admin-form-label" style={{ margin: 0 }}>Enable email notifications</span>
            </label>
          </div>
          <div className="admin-form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" />
              <span className="admin-form-label" style={{ margin: 0 }}>Auto-dismiss after 24 hours</span>
            </label>
          </div>
        </div>
        <button className="admin-button">Save Settings</button>
      </div>
    </div>
  );
};

export default NotificationsManager;
