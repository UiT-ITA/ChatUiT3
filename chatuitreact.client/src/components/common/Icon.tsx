import { PiSidebarSimple } from "react-icons/pi";
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff  } from "react-icons/vsc";
import { RiSettings3Line, RiChat1Line, RiChatAiLine, RiAdminLine, RiUserLine, RiRobot2Line, RiMenuLine } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { MdOutlineVpnKey, MdContentCopy, MdCheck, MdRefresh, MdEdit, MdCallSplit, MdKeyboardArrowDown, MdMoreHoriz, MdAttachFile, MdSend, MdKeyboardArrowUp, MdInfo, MdRemoveRedEye, MdPublic, MdPsychology, MdMoreVert, MdClose, MdInsertDriveFile, MdOutlineLightMode, MdOutlineDarkMode, MdSearch, MdAdd, MdArrowBack, MdStop, MdGridView, MdOutlineVerifiedUser, MdOutlinePeopleAlt, MdFilterList } from "react-icons/md";
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
  starOutline: FaRegStar,
} as const;

interface IconProps {
  name: keyof typeof iconMap;
  size?: number;
  className?: string;
  title?: string;
}

export const Icon = ({ name, size = 1.5, className, title }: IconProps) => {
  const IconComponent = iconMap[name];
  return <IconComponent size={`${size}rem`} className={className} title={title} />;
};

export type IconName = keyof typeof iconMap;
