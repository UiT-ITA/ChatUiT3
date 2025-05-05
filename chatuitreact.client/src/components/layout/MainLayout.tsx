import React from 'react';
import { Outlet } from 'react-router-dom';
//import { useAuth } from '../../contexts/AuthContext';
import AppBar from './AppBar';
import Sidebar from './Sidebar';
import './MainLayout.css';

const MainLayout: React.FC = () => {
    //const { isAuthenticated } = useAuth();

    return (
        <div className="layout-container">
            {/* App Bar - always visible */}
            <AppBar />

            <div className="content-wrapper">
                {/* Sidebar component */}
                <Sidebar />

                {/* Main Content Area */}
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;