import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar: React.FC = () => {
    const { isAdmin } = useAuth();

    return (
        <aside className="sidebar">
            <nav>
                <div className="main-nav">
                    <ul>
                        <li><NavLink to="/dashboard">Dashboard</NavLink></li>
                        <li><NavLink to="/weather">Weather</NavLink></li>
                        <li><NavLink to="/test">Test</NavLink></li>
                        <li><NavLink to="/profile">Profile</NavLink></li>
                        
                        {/* Only show Admin link if user has admin role */}
                        {isAdmin && (
                            <li><NavLink to="/admin">Admin</NavLink></li>
                        )}
                    </ul>
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;
