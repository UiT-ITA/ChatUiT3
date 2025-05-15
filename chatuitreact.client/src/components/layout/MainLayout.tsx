import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import './MainLayout.tsx.css';


const MainLayout: React.FC = () => {
    const [isNarrow, setIsNarrow] = useState(false);
    const [isWideScreen, setIsWideScreen] = useState(window.innerWidth > 768);

    const toggleSidebar = () => {
        setIsNarrow(!isNarrow);
    };

    // const handleNewChat = () => { // No longer needed, Sidebar uses NavLink
    //   console.log('New chat requested');
    // };

    useEffect(() => {
        const handleResize = () => {
            setIsWideScreen(window.innerWidth > 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className={`layout ${isNarrow ? 'narrow-sidebar' : 'wide-sidebar'}`}>
            <Sidebar
                onToggleSidebar={toggleSidebar}
                isNarrow={isNarrow}
            />
            <div className="content-area">
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
