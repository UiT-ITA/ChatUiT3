import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Icon.css';
import { PiSidebarSimple } from "react-icons/pi";
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff  } from "react-icons/vsc";
import { RiSettings3Line, RiChat1Line, RiChatAiLine, RiAdminLine, RiUserLine, RiRobot2Line, RiMenuLine, RiServerLine, RiCpuLine, RiToolsLine, RiCodeBoxLine } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { MdOutlineVpnKey, MdContentCopy, MdCheck, MdRefresh, MdEdit, MdCallSplit, MdKeyboardArrowDown, MdMoreHoriz, MdAttachFile, MdSend, MdKeyboardArrowUp, MdInfo, MdRemoveRedEye, MdPublic, MdPsychology, MdMoreVert, MdClose, MdInsertDriveFile, MdOutlineLightMode, MdOutlineDarkMode, MdSearch, MdAdd, MdArrowBack, MdStop, MdGridView, MdOutlineVerifiedUser, MdOutlinePeopleAlt, MdFilterList, MdLock, MdPushPin, MdOutlinePushPin, MdVisibility, MdVisibilityOff, MdImage } from "react-icons/md";
import { FaStar, FaRegStar, FaTrash } from "react-icons/fa";

const iconMap = {
  sidebar:  VscLayoutSidebarLeftOff, // Not in use
  sidebarOpen: VscLayoutSidebarLeft, // Not in use
  sidebarToggle: PiSidebarSimple,
  settings: RiSettings3Line,
  chat: RiChat1Line,
  chatNew: RiChatAiLine,
  admin: RiAdminLine,
  user: RiUserLine,
  assistants: RiRobot2Line,
  help: GrHelpBook,
  key: MdOutlineVpnKey,
  copy: MdContentCopy,
  check: MdCheck,
  refresh: MdRefresh,
  edit: MdEdit,
  branch: MdCallSplit,
  arrowDown: MdKeyboardArrowDown,
  more: MdMoreHoriz,
  attach: MdAttachFile,
  send: MdSend,
  stop: MdStop,
  arrowUp: MdKeyboardArrowUp,
  info: MdInfo,
  eye: MdRemoveRedEye,
  globe: MdPublic,
  brain: MdPsychology,
  menu: RiMenuLine,
  star: FaStar,
  trash: FaTrash,
  moreVert: MdMoreVert,
  close: MdClose,
  file: MdInsertDriveFile,
  sun: MdOutlineLightMode,
  moon: MdOutlineDarkMode,
  search: MdSearch,
  add: MdAdd,
  back: MdArrowBack,
  grid: MdGridView,
  shield: MdOutlineVerifiedUser,
  people: MdOutlinePeopleAlt,
  filter: MdFilterList,
  lock: MdLock,
  pin: MdPushPin,
  pinOutline: MdOutlinePushPin,
  visible: MdVisibility,
  hidden: MdVisibilityOff,
  image: MdImage,
  starOutline: FaRegStar,
  server: RiServerLine,
  cpu: RiCpuLine,
  tools: RiToolsLine,
  code: RiCodeBoxLine,
} as const;

export type IconName = keyof typeof iconMap;
export type IconSize = 'xs' | 'small' | 'medium' | 'large' | 'xl';
export type IconColor = 'inherit' | 'secondary' | 'muted' | 'accent' | 'danger' | 'warning' | 'success';

interface IconProps extends LayoutProps {
  name: IconName;
  size?: IconSize;
  color?: IconColor;
  // Accessible name. Without it the icon is decorative and hidden from screen readers.
  label?: string;
  rotate?: 0 | 90 | 180 | 270;
  // Turns the icon continuously, for a working state
  spin?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** The app's icon. Every icon in the app goes through this component. */
export const Icon: React.FC<IconProps> = ({ name, size = 'medium', color = 'inherit', label, rotate = 0, spin = false, className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const IconComponent = iconMap[name];
  return (
    <IconComponent
      size={`var(--icon-${size})`}
      className={cx('icon', color !== 'inherit' && `icon--${color}`, rotate !== 0 && `icon--rotate-${rotate}`, spin && 'icon--spin', className)}
      style={style}
      title={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      {...rest}
    />
  );
};
