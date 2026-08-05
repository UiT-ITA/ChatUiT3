import { Outlet, useLocation } from 'react-router-dom';
import IconRail from './IconRail';
import ContextColumn from './ContextColumn';
import MainHeader from './MainHeader';
import useMediaQuery from '../../hooks/useMediaQuery';
import ToastContainer from '../common/ToastContainer';
import './MainLayout.css';

/**
 * App shell per the design: icon rail | context column | main (header + content).
 * On mobile the rail becomes a top bar and the column and main area act as a
 * list/detail pair — the section root shows the list, deeper routes show the
 * detail with a back button in the header.
 */
const MainLayout: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 800px)');
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  // Section roots ("/", "/chat", "/assistants", "/settings", "/admin") show the list;
  // anything deeper is a detail view
  const isDetail = pathParts.length >= 2;

  if (isMobile) {
    return (
      <div className="layout mobile-layout">
        <IconRail isMobile />
        <ToastContainer />
        {isDetail ? (
          <main className="main-column">
            <MainHeader isMobile />
            <Outlet />
          </main>
        ) : (
          <ContextColumn isMobile />
        )}
      </div>
    );
  }

  return (
    <div className="layout">
      <IconRail />
      <ContextColumn />
      <ToastContainer />
      <main className="main-column">
        <MainHeader />
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
