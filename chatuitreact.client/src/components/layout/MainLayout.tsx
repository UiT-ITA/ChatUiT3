import { useState/*, useEffect*/ } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatList } from '../chat/ChatList';
import './MainLayout.css';


const MainLayout: React.FC = () => {
  const [isNarrow, setIsNarrow] = useState(false);
  const location = useLocation();

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
