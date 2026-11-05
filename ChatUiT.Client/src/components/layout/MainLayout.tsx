import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import IconRail from './IconRail';
import ContextColumn from './ContextColumn';
import MainHeader from './MainHeader';
import ChatSurface from '../chat/ChatSurface';
import useMediaQuery from '../../hooks/useMediaQuery';
import Toasts from './Toasts';
import { AppShell, AppShellMain, AppShellSidebar } from './AppShell';
import { MOBILE, SIDEBAR_COLLAPSED } from '../common/breakpoints';
import { parseRoute } from '../../utils/routes';

/**
 * App shell: icon rail | context column | main (header + content).
 * On mobile the rail is a top bar, and the context column and the main column show one at a
 * time: the section root shows the list, deeper routes show the detail with the header's back
 * button and title in the top bar. "/" shows a new chat, and "/chat" the chat list.
 *
 * Every viewport renders the same tree. Mobile only changes which columns are visible.
 */
const MainLayout: React.FC = () => {
  const isMobile = useMediaQuery(MOBILE);
  const autoCollapsed = useMediaQuery(SIDEBAR_COLLAPSED);
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const route = parseRoute(useLocation().pathname);

  // Collapsed: the context column is hidden and shows over the main column while the pointer is on the rail or the column
  const sidebarCollapsed = !isMobile && (autoCollapsed || collapsed);
  const toggleSidebar = () => {
    setCollapsed(value => !value);
    setPeek(false);
  };

  return (
    <AppShell mobile={isMobile} view={route.view}>
      <AppShellSidebar onMouseEnter={() => setPeek(true)} onMouseLeave={() => setPeek(false)}>
        <IconRail isMobile={isMobile} />
        <ContextColumn isMobile={isMobile} collapsed={sidebarCollapsed} peek={sidebarCollapsed && peek} />
      </AppShellSidebar>
      <Toasts />
      <AppShellMain>
        <MainHeader
          isMobile={isMobile}
          sidebarCollapsed={collapsed}
          onToggleSidebar={isMobile || autoCollapsed ? undefined : toggleSidebar}
        />
        <ChatSurface hidden={route.section !== 'chats'} />
        <Outlet />
      </AppShellMain>
    </AppShell>
  );
};

export default MainLayout;
