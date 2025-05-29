import React, { useState } from 'react';
import { MdAdd, MdEdit, MdDelete, MdPerson, MdAdminPanelSettings } from 'react-icons/md';

const UsersManager: React.FC = () => {
  const [users] = useState([
    { 
      id: '1', 
      username: 'john.doe', 
      email: 'john.doe@example.com', 
      role: 'user',
      lastActive: '2024-03-15',
      status: 'active'
    },
    { 
      id: '2', 
      username: 'jane.smith', 
      email: 'jane.smith@example.com', 
      role: 'admin',
      lastActive: '2024-03-16',
      status: 'active'
    },
    { 
      id: '3', 
      username: 'bob.wilson', 
      email: 'bob.wilson@example.com', 
      role: 'user',
      lastActive: '2024-03-10',
      status: 'inactive'
    }
  ]);

  const handleAddUser = () => {
    console.log('Add user clicked');
  };

  const handleEditUser = (id: string) => {
    console.log('Edit user:', id);
  };

  const handleDeleteUser = (id: string) => {
    console.log('Delete user:', id);
  };

  const handleToggleRole = (id: string) => {
    console.log('Toggle role for user:', id);
  };

  return (
    <div>
      <div className="admin-section">
        <div className="admin-section-title">
          <MdPerson size={20} />
          User Management
          <button className="admin-button" onClick={handleAddUser}>
            <MdAdd size={16} /> Add User
          </button>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Last Active</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {user.role === 'admin' && <MdAdminPanelSettings size={16} />}
                    {user.role}
                  </div>
                </td>
                <td>{user.lastActive}</td>
                <td>
                  <span className={`status-badge ${user.status}`}>
                    {user.status}
                  </span>
                </td>
                <td>
                  <div className="button-group">
                    <button 
                      className="admin-button secondary" 
                      onClick={() => handleToggleRole(user.id)}
                      title={`Make ${user.role === 'admin' ? 'user' : 'admin'}`}
                    >
                      <MdAdminPanelSettings size={14} />
                    </button>
                    <button 
                      className="admin-button secondary" 
                      onClick={() => handleEditUser(user.id)}
                    >
                      <MdEdit size={14} />
                    </button>
                    <button 
                      className="admin-button danger" 
                      onClick={() => handleDeleteUser(user.id)}
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
          Add New User
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Username</label>
            <input type="text" className="admin-input" placeholder="Enter username" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Email</label>
            <input type="email" className="admin-input" placeholder="Enter email address" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Role</label>
            <select className="admin-select">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Password</label>
          <input type="password" className="admin-input" placeholder="Enter password" />
        </div>
        <button className="admin-button">Create User</button>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          User Statistics
        </div>
        <div className="metrics-grid">
          <div className="metrics-card">
            <h3>Total Users</h3>
            <p className="value">247</p>
          </div>
          <div className="metrics-card">
            <h3>Active Users</h3>
            <p className="value">189</p>
          </div>
          <div className="metrics-card">
            <h3>Admin Users</h3>
            <p className="value">12</p>
          </div>
          <div className="metrics-card">
            <h3>New This Month</h3>
            <p className="value">23</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersManager;
