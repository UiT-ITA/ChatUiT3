import React from 'react';
import Button from '../common/Button';
import IconButton, { type IconButtonProps } from '../common/IconButton';
import { Icon, type IconName } from '../common/Icon';
import { NavListContext } from '../common/navListStyle';
import PageTitleBar from '../common/PageTitleBar';
import { cx } from '../common/layout';
import './AppShell.css';

interface AppShellProps {
  // Narrow screens: the rail is a top bar and only one of the side column and the main column shows
  mobile: boolean;
  // Which of the pair shows on narrow screens: the list in the side column, or the detail in the main column
  view: 'list' | 'detail';
  children?: React.ReactNode;
}

/** The app frame: icon rail, side column and main column. */
export const AppShell: React.FC<AppShellProps> = ({ mobile, view, children }) => (
  <div className={cx('app-shell', mobile && 'app-shell--mobile', `app-shell--${view}`)}>{children}</div>
);

interface AppShellSidebarProps {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: React.ReactNode;
}

/** Groups the rail and the side column for hover, without a box of its own. */
export const AppShellSidebar: React.FC<AppShellSidebarProps> = ({ onMouseEnter, onMouseLeave, children }) => (
  <div className="app-shell__sidebar" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>{children}</div>
);

/** The main column: the header, then the content. */
export const AppShellMain: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <main className="app-shell__main">{children}</main>
);

/** The thin header at the top of the main column. */
export const AppHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <header className="app-header">{children}</header>
);

/** The title in the main column header, cut with an ellipsis. */
export const AppHeaderTitle: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="app-header__title t-title">{children}</div>
);

interface AppHeaderCrumbProps {
  onClick: () => void;
  children?: React.ReactNode;
}

/** A breadcrumb back to the list of an open edit page, followed by a separator. */
export const AppHeaderCrumb: React.FC<AppHeaderCrumbProps> = ({ onClick, children }) => (
  <>
    <Button variant="ghost" shrink minWidth="0" className="app-header__crumb" onClick={onClick}>
      {children}
    </Button>
    <Icon name="chevronRight" size="sm" color="muted" className="app-header__crumb-sep" />
  </>
);

interface AppHeaderStatusProps {
  title?: string;
  children?: React.ReactNode;
}

/** A short state in the header, such as the save state of an open edit page. */
export const AppHeaderStatus: React.FC<AppHeaderStatusProps> = ({ title, children }) => (
  <span className="app-header__status t-hint" title={title}>{children}</span>
);

/* ---------- Icon rail ---------- */

interface RailProps {
  // Shows the rail as a top bar
  mobile: boolean;
  ref?: React.Ref<HTMLElement>;
  children?: React.ReactNode;
}

const RailContext = React.createContext({ mobile: false });

/** The narrow column of section buttons, a top bar on narrow screens. */
export const Rail: React.FC<RailProps> = ({ mobile, ref, children }) => (
  <RailContext.Provider value={{ mobile }}>
    <nav ref={ref} className={cx('app-rail', mobile && 'app-rail--mobile')}>{children}</nav>
  </RailContext.Provider>
);

interface RailSealProps {
  src: string;
  alt: string;
  title?: string;
}

/** The brand seal at the start of the rail. */
export const RailSeal: React.FC<RailSealProps> = ({ src, alt, title }) => (
  <img className="app-rail__seal" src={src} alt={alt} title={title} />
);

/** A small fixed gap between rail items. */
export const RailGap: React.FC = () => <div className="app-rail__gap" />;

/** Pushes the following rail items to the far end. */
export const RailSpacer: React.FC = () => <div className="app-rail__spacer" />;

interface RailButtonProps {
  icon: IconName;
  label: string;
  active: boolean;
  onClick: () => void;
}

/** A rail section button. Its label shows as a tooltip to its right on the side rail, and under it on the top bar. */
export const RailButton: React.FC<RailButtonProps> = ({ icon, label, active, onClick }) => {
  const { mobile } = React.useContext(RailContext);
  return (
    <IconButton iconSize="lg" icon={icon} label={label} tooltipPlacement={mobile ? 'bottom' : 'right'} active={active} activeFill="strong" onClick={onClick} />
  );
};

/** The rail's menu button: while active it shows the main text colour without a filled tile. */
export const RailMenuButton: React.FC<Omit<IconButtonProps, 'activeFill'>> = (props) => (
  <IconButton {...props} activeFill="none" />
);

/** The user's initials in a filled square, for the profile button. */
export const RailAvatar: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <span className="app-rail__avatar t-label">{children}</span>
);

interface RailMenuHeaderProps {
  name: React.ReactNode;
  email?: React.ReactNode;
}

/** The signed-in user's name and email at the top of the rail menu. */
export const RailMenuHeader: React.FC<RailMenuHeaderProps> = ({ name, email }) => (
  <div className="app-rail__menu-header">
    <div className="t-body-strong">{name}</div>
    {email && <div className="app-rail__menu-email t-caption">{email}</div>}
  </div>
);

/* ---------- Side column ---------- */

interface SideColumnProps {
  // The full-width list view of a narrow screen
  mobile: boolean;
  // Hidden, and shown over the main column while peek is true
  collapsed?: boolean;
  peek?: boolean;
  children?: React.ReactNode;
}

/** The list panel between the rail and the main column. */
export const SideColumn: React.FC<SideColumnProps> = ({ mobile, collapsed = false, peek = false, children }) => (
  <NavListContext.Provider value={{ mobileList: mobile }}>
    <aside className={cx('side-column', mobile && 'side-column--mobile', collapsed && 'side-column--collapsed', peek && 'side-column--peek')}>
      {children}
    </aside>
  </NavListContext.Provider>
);

interface SideColumnHeaderProps {
  title: React.ReactNode;
  count?: number;
}

/** The section name and its number of entries at the top of the side column. */
export const SideColumnHeader: React.FC<SideColumnHeaderProps> = ({ title, count }) => (
  <div className="side-column__header">
    <div className="t-overline">{title}</div>
    {count !== undefined && <div className="side-column__count t-meta">{count}</div>}
  </div>
);

interface SideColumnPageHeadProps {
  title: React.ReactNode;
  intro?: React.ReactNode;
}

/** The page title, accent bar and intro above the list in the mobile list view. */
export const SideColumnPageHead: React.FC<SideColumnPageHeadProps> = ({ title, intro }) => (
  <div className="side-column__page-head">
    <div className="side-column__page-title">
      <h1 className="t-page-title">{title}</h1>
    </div>
    <PageTitleBar mb="md" />
    {intro && <p className="side-column__intro t-body">{intro}</p>}
  </div>
);

/** The search field above the list. */
export const SideColumnSearch: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="side-column__search">{children}</div>
);

/** The scrolling list area of the side column. */
export const SideColumnScroll: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="side-column__scroll">{children}</div>
);

/** A muted note in the list, such as "Loading". */
export const SideColumnNote: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="side-column__note t-ui-plain">{children}</div>
);

/** A group label above list rows, such as Today or Yesterday. */
export const SideColumnGroupLabel: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="side-column__group-label t-group-label">{children}</div>
);

interface SideColumnEmptyProps {
  icon: IconName;
  title: React.ReactNode;
  hint?: React.ReactNode;
}

/** An empty list: an icon over a short note. */
export const SideColumnEmpty: React.FC<SideColumnEmptyProps> = ({ icon, title, hint }) => (
  <div className="side-column__empty">
    <Icon name={icon} size="md" color="muted" />
    <span className="side-column__empty-title t-ui">{title}</span>
    {hint && <span className="t-ui-plain">{hint}</span>}
  </div>
);

/** The entries of an open group, indented under it. */
export const SideColumnChildren: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="side-column__children">{children}</div>
);
