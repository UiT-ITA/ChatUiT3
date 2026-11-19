import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createResizableController, Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import IconRail from './IconRail';
import ContextColumn from './ContextColumn';
import MainHeader from './MainHeader';
import ChatSurface from '../chat/ChatSurface';
import useMediaQuery from '../../hooks/useMediaQuery';
import Toasts from './Toasts';
import { AppShell, AppShellMain, AppShellSidebar } from './AppShell';
import { MOBILE, SIDEBAR_COLLAPSED } from '../common/breakpoints';
import { parseRoute } from '../../utils/routes';
import { sizeToken } from '../../utils/cssTokens';
import { layoutStorage } from '../../utils/layoutStorage';

const SIDE_PANEL = 'context-column';

/**
 * App shell: icon rail | context column | main (header + content).
 * The context column is a resizable panel: drag its edge, or press Enter or double-click it to collapse it. Its width is saved.
 * Medium screens collapse it. Collapsed, it shows over the main column while the pointer is on the rail or the column.
 * On mobile the rail is a top bar, and the context column and the main column show one at a
 * time: the section root shows the list, deeper routes show the detail with the header's back
 * button and title in the top bar. "/" shows a new chat, and "/chat" the chat list.
 *
 * Every viewport renders the same tree. Mobile only changes which columns are visible.
 */
const MainLayout: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery(MOBILE);
  const autoCollapsed = useMediaQuery(SIDEBAR_COLLAPSED);
  const [sidebar] = useState(createResizableController);
  // Whether the context column is collapsed, read from the group after each layout change and once it restores a saved layout
  const layoutChanged = useRef<() => void>(undefined);
  const collapsed = useSyncExternalStore(
    useCallback((listener: () => void) => {
      layoutChanged.current = listener;
      return () => { layoutChanged.current = undefined; };
    }, []),
    () => sidebar.isCollapsed(SIDE_PANEL),
  );
  // The user's own choice, restored when the screen is wide again
  const userCollapsed = useRef<boolean | null>(null);
  // Saves the layout only while the screen is wide enough not to collapse the sidebar itself
  const [storage] = useState(() => layoutStorage(() => !window.matchMedia(SIDEBAR_COLLAPSED).matches));
  // The sidebar's sizes, read from their tokens once
  const [sizes] = useState(() => ({ default: sizeToken('--context-column-width'), min: sizeToken('--size-xs'), max: sizeToken('--size-md') }));
  const [peek, setPeek] = useState(false);
  const route = parseRoute(useLocation().pathname);

  useEffect(() => {
    userCollapsed.current ??= sidebar.isCollapsed(SIDE_PANEL);
    if (autoCollapsed) sidebar.collapse(SIDE_PANEL);
    else if (!userCollapsed.current) sidebar.expand(SIDE_PANEL);
  }, [autoCollapsed, sidebar]);

  const sidebarCollapsed = !isMobile && collapsed;
  const hover = { onMouseEnter: () => setPeek(true), onMouseLeave: () => setPeek(false) };
  const toggleSidebar = () => {
    if (collapsed) sidebar.expand(SIDE_PANEL);
    else sidebar.collapse(SIDE_PANEL);
    setPeek(false);
  };

  return (
    <AppShell mobile={isMobile} view={route.view}>
      <AppShellSidebar {...hover}>
        <IconRail isMobile={isMobile} />
      </AppShellSidebar>
      <Toasts />
      <Resizable
        controller={sidebar}
        autoSaveId="app-sidebar"
        storage={storage}
        disabled={isMobile}
        className="app-shell__panels"
        onLayoutChange={() => {
          layoutChanged.current?.();
          if (!autoCollapsed) userCollapsed.current = sidebar.isCollapsed(SIDE_PANEL);
        }}
      >
        <ResizablePanel
          id={SIDE_PANEL}
          defaultSize={sizes.default}
          minSize={sizes.min}
          maxSize={sizes.max}
          collapsible
          collapsedSize="1px"
          className="app-shell__side-panel"
          {...hover}
        >
          <ContextColumn isMobile={isMobile} collapsed={sidebarCollapsed} peek={sidebarCollapsed && peek} />
        </ResizablePanel>
        <ResizableHandle aria-label={t('sidebar.resizeSidebar')} className="resize-handle" disabled={autoCollapsed} />
        <ResizablePanel id="main-column" className="app-shell__main-panel">
          <AppShellMain>
            <MainHeader
              isMobile={isMobile}
              sidebarCollapsed={collapsed}
              onToggleSidebar={isMobile || autoCollapsed ? undefined : toggleSidebar}
            />
            <ChatSurface hidden={route.section !== 'chats'} />
            <Outlet />
          </AppShellMain>
        </ResizablePanel>
      </Resizable>
    </AppShell>
  );
};

export default MainLayout;
