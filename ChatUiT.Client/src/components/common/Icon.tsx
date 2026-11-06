import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './Icon.css';
import { PiSidebarSimple } from "react-icons/pi";
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff } from "react-icons/vsc";
import { RiSettings3Line, RiChat1Line, RiChatAiLine, RiUserLine, RiRobot2Line, RiMenuLine, RiServerLine, RiCpuLine, RiToolsLine, RiCodeBoxLine, RiPulseLine } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { MdOutlineVpnKey, MdContentCopy, MdCheck, MdRefresh, MdOutlineEdit, MdKeyboardArrowDown, MdMoreHoriz, MdAttachFile, MdSend, MdKeyboardArrowUp, MdInfoOutline, MdOutlineRemoveRedEye, MdPublic, MdOutlinePsychology, MdMoreVert, MdClose, MdOutlineInsertDriveFile, MdOutlineLightMode, MdOutlineDarkMode, MdSearch, MdAdd, MdArrowBack, MdStop, MdOutlineGridView, MdOutlineVerifiedUser, MdOutlinePeopleAlt, MdLockOutline, MdCheckCircle, MdOutlineCheckCircle, MdVisibility, MdVisibilityOff, MdOutlineImage, MdDeleteOutline, MdOutlineMail, MdOutlineEvent, MdHelpOutline, MdChevronLeft, MdChevronRight, MdOutlineSchedule, MdOutlineFilterAlt, MdOutlineShield, MdOutlineFileUpload, MdErrorOutline, MdOutlineVolumeUp, MdZoomIn, MdZoomOut, MdWrapText, MdArrowOutward, MdOpenInFull, MdCloseFullscreen } from "react-icons/md";
import { FaStar } from "react-icons/fa";
import { LuGitBranch, LuStar } from "react-icons/lu";

const iconMap = {
  sidebar: VscLayoutSidebarLeftOff,
  sidebarOpen: VscLayoutSidebarLeft,
  sidebarToggle: PiSidebarSimple,
  settings: RiSettings3Line,
  chat: RiChat1Line,
  chatNew: RiChatAiLine,
  admin: MdOutlineShield,
  user: RiUserLine,
  assistants: RiRobot2Line,
  help: GrHelpBook,
  key: MdOutlineVpnKey,
  copy: MdContentCopy,
  check: MdCheck,
  refresh: MdRefresh,
  edit: MdOutlineEdit,
  branch: LuGitBranch,
  arrowDown: MdKeyboardArrowDown,
  more: MdMoreHoriz,
  attach: MdAttachFile,
  send: MdSend,
  stop: MdStop,
  arrowUp: MdKeyboardArrowUp,
  info: MdInfoOutline,
  eye: MdOutlineRemoveRedEye,
  globe: MdPublic,
  brain: MdOutlinePsychology,
  menu: RiMenuLine,
  star: FaStar,
  trash: MdDeleteOutline,
  moreVert: MdMoreVert,
  close: MdClose,
  file: MdOutlineInsertDriveFile,
  sun: MdOutlineLightMode,
  moon: MdOutlineDarkMode,
  search: MdSearch,
  add: MdAdd,
  back: MdArrowBack,
  grid: MdOutlineGridView,
  shield: MdOutlineVerifiedUser,
  people: MdOutlinePeopleAlt,
  filter: MdOutlineFilterAlt,
  lock: MdLockOutline,
  checkCircle: MdCheckCircle,
  checkCircleOutline: MdOutlineCheckCircle,
  visible: MdVisibility,
  hidden: MdVisibilityOff,
  image: MdOutlineImage,
  starOutline: LuStar,
  server: RiServerLine,
  pulse: RiPulseLine,
  cpu: RiCpuLine,
  tools: RiToolsLine,
  code: RiCodeBoxLine,
  mail: MdOutlineMail,
  calendar: MdOutlineEvent,
  question: MdHelpOutline,
  chevronLeft: MdChevronLeft,
  chevronRight: MdChevronRight,
  clock: MdOutlineSchedule,
  upload: MdOutlineFileUpload,
  error: MdErrorOutline,
  speaker: MdOutlineVolumeUp,
  zoomIn: MdZoomIn,
  zoomOut: MdZoomOut,
  wrap: MdWrapText,
  externalLink: MdArrowOutward,
  fullView: MdOpenInFull,
  closeFullView: MdCloseFullscreen,
} as const;

export type IconName = keyof typeof iconMap;
export type IconSize = 'sm' | 'md' | 'lg';
export type IconColor = 'inherit' | 'secondary' | 'muted' | 'accent' | 'danger' | 'warning' | 'success';

interface IconProps extends LayoutProps {
  name: IconName;
  size?: IconSize;
  color?: IconColor;
  // Accessible name. Without it the icon is decorative and hidden from screen readers.
  label?: string;
  rotate?: 0 | 90 | 180 | 270;
  // Flips the icon horizontally
  mirror?: boolean;
  // Turns the icon continuously, for a working state
  spin?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** The app's icon. Every icon in the app goes through this component. */
export const Icon: React.FC<IconProps> = ({ name, size = 'sm', color = 'inherit', label, rotate = 0, mirror = false, spin = false, className, ...props }) => {
  const [style, rest] = splitLayoutProps(props);
  const IconComponent = iconMap[name];
  return (
    <IconComponent
      size={`var(--icon-${size})`}
      className={cx('icon', color !== 'inherit' && `icon--${color}`, rotate !== 0 && `icon--rotate-${rotate}`, mirror && 'icon--mirror', spin && 'icon--spin', className)}
      style={style}
      title={label}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      {...rest}
    />
  );
};
