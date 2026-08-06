import { Outlet, useLocation } from 'react-router-dom';
import IconRail from './IconRail';
import ContextColumn from './ContextColumn';
import MainHeader from './MainHeader';
import ChatSurface from '../chat/ChatSurface';
import useMediaQuery from '../../hooks/useMediaQuery';
import ToastContainer from '../common/ToastContainer';
import './MainLayout.css';

/**
 * App shell per the design: icon rail | context column | main (header + content).
 * On mobile the rail becomes a top bar and the column and main area act as a
 * list/detail pair — the section root shows the list, deeper routes show the
 * detail with a back button in the header.
 *
 * One tree for every viewport: mobile only changes which columns are *visible*,
 * via classes on the root. Branching on width would give the two viewports
 * different tree shapes, so crossing the breakpoint would unmount the main column
 * and take every opened chat with it.
 *
 * For the same reason the chat surface is mounted here rather than behind a route:
 * routing swaps route elements out, and opened chats must survive that.
 */
const MainLayout: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 800px)');
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  // Section roots ("/", "/chat", "/assistants", "/settings", "/admin") show the list;
  // anything deeper is a detail view
  const isDetail = pathParts.length >= 2;
  // Chat routes render nothing through the outlet — ChatSurface below is the chat UI.
  const isChatRoute = pathParts.length === 0 || pathParts[0] === 'chat';

  return (
    <div
      className={`layout ${isMobile ? 'mobile-layout' : ''} ${isDetail ? 'show-detail' : 'show-list'}`}
    >
      <IconRail isMobile={isMobile} />
      <ContextColumn isMobile={isMobile} />
      <ToastContainer />
      <main className="main-column">
        <MainHeader isMobile={isMobile} />
        <ChatSurface hidden={!isChatRoute} />
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
