//import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar: React.FC = () => {


    return (
        <aside className="sidebar">
            <nav>
                <div className="main-nav">
                    <ul>
                        <li><NavLink to="/dashboard">Dashboard</NavLink></li>
                        <li><NavLink to="/weather">Weather</NavLink></li>
                        <li><NavLink to="/test">Test</NavLink></li>
                        <li><NavLink to="/profile">Profile</NavLink></li>
                    </ul>
                </div>
            </nav>
        </aside>
    );
};

export default Sidebar;