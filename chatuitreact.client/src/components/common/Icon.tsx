// import { PiSidebarSimple, PiSidebarSimpleFill } from "react-icons/pi";
import { VscLayoutSidebarLeft, VscLayoutSidebarLeftOff  } from "react-icons/vsc";
import { RiSettings3Line, RiChatAiLine, RiAdminLine, RiUserLine, RiRobot2Line } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { MdOutlineVpnKey, MdContentCopy, MdCheck, MdRefresh, MdEdit, MdCallSplit, MdKeyboardArrowDown, MdMoreHoriz, MdAttachFile, MdSend, MdKeyboardArrowUp, MdInfo, MdRemoveRedEye, MdPublic, MdPsychology } from "react-icons/md";

const iconMap = {
  sidebar:  VscLayoutSidebarLeftOff,
  sidebarOpen: VscLayoutSidebarLeft,
  settings: RiSettings3Line,
  chat: RiChatAiLine,
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
  arrowUp: MdKeyboardArrowUp,
  info: MdInfo,
  eye: MdRemoveRedEye,
  globe: MdPublic,
  brain: MdPsychology,
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
