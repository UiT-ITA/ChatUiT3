import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppBar from './AppBar';
import useMediaQuery from '../../hooks/useMediaQuery';
import './MainLayout.css';


const MainLayout: React.FC = () => {
  const [isNarrow, setIsNarrow] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 799px)');



  const toggleSidebar = () => {
    setIsNarrow(!isNarrow);
  };

  const handleMobileMenuClick = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNewChatClick = () => {
    navigate('/chat/new');
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleMobileClose = () => {
    setIsMobileMenuOpen(false);
  };

  if (isMobile) {
    return (
      <div className="layout mobile-layout">
        <AppBar 
          onMenuClick={handleMobileMenuClick}
          onNewChatClick={handleNewChatClick}
        />
        {isMobileMenuOpen && (
          <div className="mobile-backdrop" onClick={handleMobileClose} />
        )}
        <Sidebar
          onToggleSidebar={toggleSidebar}
          isNarrow={false}
          isMobile={isMobile}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileClose={handleMobileClose}
        />
        <div className="content-area">
          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

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
