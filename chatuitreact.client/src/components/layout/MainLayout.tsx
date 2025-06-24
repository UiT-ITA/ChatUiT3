import { useState/*, useEffect*/ } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import AppBar from './AppBar';
import { ChatList } from '../chat/ChatList';
import useMediaQuery from '../../hooks/useMediaQuery';
import useVisualViewport from '../../hooks/useVisualViewport';
import './MainLayout.css';


const MainLayout: React.FC = () => {
  const [isNarrow, setIsNarrow] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 799px)');
  const { viewportHeight, isKeyboardOpen } = useVisualViewport(isMobile);

  const renderSidebarContent = () => {
    if (location.pathname.startsWith('/help')) {
      //return <HelpChapters />;
      return <ChatList />;
    } else if (location.pathname.startsWith('/c')) {
      return <ChatList />;
    }
    return <ChatList />;
  };


  const toggleSidebar = () => {
    setIsNarrow(!isNarrow);
  };

  const handleMobileMenuClick = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNewChatClick = () => {
    navigate('/c/new');
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleMobileClose = () => {
    setIsMobileMenuOpen(false);
  };

  if (isMobile) {
    return (
      <div className="layout mobile-layout" style={{ height: `${viewportHeight}px` }}>
        {!isKeyboardOpen && (
          <AppBar 
            onMenuClick={handleMobileMenuClick}
            onNewChatClick={handleNewChatClick}
          />
        )}
        {isMobileMenuOpen && (
          <div className="mobile-backdrop" onClick={handleMobileClose} />
        )}
        <Sidebar
          onToggleSidebar={toggleSidebar}
          isNarrow={false}
          content={renderSidebarContent()}
          isMobile={isMobile}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileClose={handleMobileClose}
          isKeyboardOpen={isKeyboardOpen}
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
        content={renderSidebarContent()}
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
