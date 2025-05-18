import './Sidebar.css';
import SidebarButton from './SidebarButton';
import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { PiSidebarSimple } from "react-icons/pi";
import { RiSettings3Line, RiChatAiLine, RiChatSettingsLine, RiAdminLine, RiUserLine } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { TbMessageCircleSearch } from "react-icons/tb";
import { MdOutlineVpnKey } from "react-icons/md";

import { useAuth } from '../../contexts/AuthContext';
import { ChatList } from '../chat/ChatList';

interface SidebarProps {
    onToggleSidebar: () => void;
    isNarrow: boolean;
    className?: string;
}

const Sidebar = ({ onToggleSidebar, isNarrow, className }: SidebarProps) => {
    const navigate = useNavigate();
    const { isAdmin, isAuthenticated, login, logout } = useAuth();

    return (
        <div className={`sidebar ${isNarrow ? 'narrow' : 'wide'} ${className || ''}`}>
            <div className="sidebar-top">
                <button className="icon-button sidebar-toggle" onClick={onToggleSidebar} title={isNarrow ? 'Expand sidebar' : 'Collapse sidebar'}>
                    <PiSidebarSimple size={"24px"} />
                </button>
                <div className="sidebar-spacer" />
                <button className="icon-button" onClick={() => console.log('Search clicked')} title="Search">
                    <TbMessageCircleSearch size={"24px"} />
                </button>
                <NavLink to="/c/new" className="icon-button" title="New chat">
                    <RiChatAiLine size={"24px"} />
                </NavLink>
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-content">
                <nav className="sidebar-nav">
                    <ChatList />
                </nav>
            </div>

            <div className="sidebar-divider" />
            <div className="sidebar-bottom">
                <SidebarButton
                    icon={<GrHelpBook size={24} />}
                    text="Help"
                    onClick={() => navigate('/help')}
                    isNarrow={isNarrow}
                />

                <SidebarButton
                    icon={<RiChatSettingsLine size={24} />}
                    text="Chat Settings"
                    onClick={() => console.log('Chat settings clicked')}
                    isNarrow={isNarrow}
                />

                <SidebarButton
                    icon={<RiSettings3Line size={24} />}
                    text="Settings"
                    onClick={() => console.log('Settings clicked')}
                    isNarrow={isNarrow}
                />

                {isAdmin && (
                    <SidebarButton
                        icon={<RiAdminLine size={24} />}
                        text="Admin"
                        onClick={() => navigate('/admin')}
                        isNarrow={isNarrow}
                    />
                )}

                <SidebarButton
                    icon={<RiUserLine size={24} />}
                    text="Account"
                    onClick={() => navigate('/profile')}
                    isNarrow={isNarrow}
                />

                {isAuthenticated ? (
                    <SidebarButton
                        icon={<MdOutlineVpnKey size={24} />}
                        text="Log out"
                        onClick={logout}
                        isNarrow={isNarrow}
                    />
                ) : (
                    <SidebarButton
                        icon={<MdOutlineVpnKey size={24} />}
                        text="Log in"
                        onClick={login}
                        isNarrow={isNarrow}
                    />
                )}
            </div>
        </div>
    );
};

export default Sidebar;
