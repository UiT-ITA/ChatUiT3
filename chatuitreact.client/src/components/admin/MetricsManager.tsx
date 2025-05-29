import React, { useState } from 'react';
import { MdAnalytics, MdTrendingUp, MdAccessTime, MdPeople } from 'react-icons/md';

const MetricsManager: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');

  const usageData = [
    { model: 'GPT-4', requests: 1247, tokens: 2840000, cost: 142.50 },
    { model: 'GPT-3.5 Turbo', requests: 3891, tokens: 1950000, cost: 65.00 },
    { model: 'Claude 3 Sonnet', requests: 892, tokens: 1120000, cost: 89.60 },
    { model: 'GPT-4 (Azure)', requests: 567, tokens: 890000, cost: 76.30 }
  ];

  const topUsers = [
    { username: 'john.doe', requests: 234, tokens: 450000 },
    { username: 'jane.smith', requests: 189, tokens: 320000 },
    { username: 'bob.wilson', requests: 156, tokens: 280000 },
    { username: 'alice.brown', requests: 134, tokens: 210000 },
    { username: 'charlie.davis', requests: 98, tokens: 180000 }
  ];

  const recentActivity = [
    { time: '10:23 AM', user: 'john.doe', action: 'Chat completed', model: 'GPT-4' },
    { time: '10:18 AM', user: 'jane.smith', action: 'New chat started', model: 'Claude 3' },
    { time: '10:15 AM', user: 'bob.wilson', action: 'Assistant changed', model: 'GPT-3.5' },
    { time: '10:12 AM', user: 'alice.brown', action: 'Chat completed', model: 'GPT-4' },
    { time: '10:08 AM', user: 'charlie.davis', action: 'File uploaded', model: 'GPT-4' }
  ];

  return (
    <div>
      <div className="admin-section">
        <div className="admin-section-title">
          <MdAnalytics size={20} />
          System Overview
          <select 
            className="admin-select" 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            style={{ width: 'auto', marginLeft: 'auto' }}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
        <div className="metrics-grid">
          <div className="metrics-card">
            <h3>Total Requests</h3>
            <p className="value">6,597</p>
          </div>
          <div className="metrics-card">
            <h3>Total Tokens</h3>
            <p className="value">6.8M</p>
          </div>
          <div className="metrics-card">
            <h3>Total Cost</h3>
            <p className="value">$373.40</p>
          </div>
          <div className="metrics-card">
            <h3>Active Users</h3>
            <p className="value">147</p>
          </div>
          <div className="metrics-card">
            <h3>Avg Response Time</h3>
            <p className="value">2.3s</p>
          </div>
          <div className="metrics-card">
            <h3>Success Rate</h3>
            <p className="value">98.7%</p>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          <MdTrendingUp size={20} />
          Model Usage Statistics
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Requests</th>
              <th>Tokens Used</th>
              <th>Est. Cost</th>
              <th>Avg Response Time</th>
            </tr>
          </thead>
          <tbody>
            {usageData.map((item, index) => (
              <tr key={index}>
                <td>{item.model}</td>
                <td>{item.requests.toLocaleString()}</td>
                <td>{(item.tokens / 1000000).toFixed(1)}M</td>
                <td>${item.cost.toFixed(2)}</td>
                <td>{(Math.random() * 2 + 1).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        <div className="admin-section">
          <div className="admin-section-title">
            <MdPeople size={20} />
            Top Users by Usage
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Requests</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((user, index) => (
                <tr key={index}>
                  <td>{user.username}</td>
                  <td>{user.requests}</td>
                  <td>{(user.tokens / 1000).toFixed(0)}K</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-section">
          <div className="admin-section-title">
            <MdAccessTime size={20} />
            Recent Activity
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Model</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((activity, index) => (
                <tr key={index}>
                  <td>{activity.time}</td>
                  <td>{activity.user}</td>
                  <td>{activity.action}</td>
                  <td>{activity.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          Performance Metrics
        </div>
        <div className="metrics-grid">
          <div className="metrics-card">
            <h3>Peak Concurrent Users</h3>
            <p className="value">23</p>
          </div>
          <div className="metrics-card">
            <h3>System Uptime</h3>
            <p className="value">99.8%</p>
          </div>
          <div className="metrics-card">
            <h3>Memory Usage</h3>
            <p className="value">2.4GB</p>
          </div>
          <div className="metrics-card">
            <h3>CPU Usage</h3>
            <p className="value">34%</p>
          </div>
          <div className="metrics-card">
            <h3>Error Rate</h3>
            <p className="value">0.3%</p>
          </div>
          <div className="metrics-card">
            <h3>Cache Hit Rate</h3>
            <p className="value">87.2%</p>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-title">
          Export Data
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="admin-button">Export Usage Report (CSV)</button>
          <button className="admin-button secondary">Export User Analytics (JSON)</button>
          <button className="admin-button secondary">Export System Logs</button>
          <button className="admin-button secondary">Generate Monthly Report</button>
        </div>
      </div>
    </div>
  );
};

export default MetricsManager;
