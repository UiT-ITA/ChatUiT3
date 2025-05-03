import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <nav>
        <ul>
          <li><NavLink to="/dashboard">Dashboard</NavLink></li>
          <li><NavLink to="/weather">Weather</NavLink></li>
          <li><NavLink to="/test">Test</NavLink></li>
          <li><NavLink to="/profile">Profile</NavLink></li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;