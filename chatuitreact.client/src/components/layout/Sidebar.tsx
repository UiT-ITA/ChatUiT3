import './Sidebar.tsx.css';
import SidebarButton from './SidebarButton';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { PiSidebarSimple } from "react-icons/pi";
import { RiSettings3Line, RiChatAiLine, RiChatSettingsLine, RiAdminLine, RiUserLine } from 'react-icons/ri'; // RiChatHistoryLine removed as it's not used
import { GrHelpBook } from "react-icons/gr";
import { TbMessageCircleSearch } from "react-icons/tb";
import { getChats, type Chat as ChatType } from '../../services/mockChatService'; // Import service and type
import { MdOutlineVpnKey } from "react-icons/md";

import { useAuth } from '../../contexts/AuthContext';


interface SidebarProps {
    onToggleSidebar: () => void;
    // onNewChat is handled by NavLink to /c/new now
    isNarrow: boolean;
    className?: string;
}

// Define a type for the chat items we'll store in state for the sidebar
type SidebarChatItem = Pick<ChatType, 'id' | 'title'>;

const Sidebar = ({ onToggleSidebar, isNarrow, className }: SidebarProps) => {
    const [chatHistory, setChatHistory] = useState<SidebarChatItem[]>([]);
    const location = useLocation(); // To re-fetch chats when navigation occurs (e.g. new chat created)
    const navigate = useNavigate(); // For programmatic navigation

    const { isAdmin, isAuthenticated, login, logout } = useAuth();

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768 && !isNarrow) {
                onToggleSidebar();
            } else if (window.innerWidth > 768 && isNarrow) {
                onToggleSidebar();
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isNarrow, onToggleSidebar]);

    useEffect(() => {
        // Fetch chats from the service
        const chats = getChats();
        setChatHistory(chats);
        // This effect will re-run if the location changes, which happens when ChatPage navigates
        // after creating a new chat. This ensures the sidebar updates.
    }, [location.pathname]);
    

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
                {/* "New Chat" button now uses NavLink */}
                <NavLink to="/c/new" className="icon-button" title="New chat">
                    <RiChatAiLine size={"24px"} />
                </NavLink>
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-content">
                <nav className="sidebar-nav">
                    {chatHistory.length > 0 && (
                        <div className="nav-section">
                            <h3 className="section-title">Recent Chats</h3>
                            <ul>
                                {chatHistory.map(chat => (
                                    <li key={chat.id}>
                                        <NavLink
                                            to={`/c/${chat.id}`}
                                            className={({ isActive }) => isActive ? "chat-link active" : "chat-link"}
                                            title={chat.title}
                                        >
                                            {isNarrow ? chat.title.substring(0, 1).toUpperCase() : chat.title}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* You can add more sections like "Yesterday", "Previous 7 Days" etc. later if needed */}
                </nav>
            </div>

            <div className="sidebar-divider" />
            <div className="sidebar-bottom"> {/* Bottom section for the settings button */}
                {/* Help button (redirect to user manual) */}
                <SidebarButton
                    icon={<GrHelpBook size={24} />}
                    text="Help"
                    onClick={() => navigate('/help')}
                    isNarrow={isNarrow}
                />

                {/* Settings for the current chat */}
                <SidebarButton
                    icon={<RiChatSettingsLine size={24} />}
                    text="Chat Settings"
                    onClick={() => console.log('Chat settings clicked')}
                    isNarrow={isNarrow}
                />

                {/* Settings for the app */}
                <SidebarButton
                    icon={<RiSettings3Line size={24} />}
                    text="Settings"
                    onClick={() => console.log('Settings clicked')}
                    isNarrow={isNarrow}
                />

                {/* Admin settings - Only show if userIsAdmin is true*/}
                {isAdmin && (
                    <SidebarButton
                        icon={<RiAdminLine size={24} />}
                        text="Admin"
                        onClick={() => navigate('/admin')}
                        isNarrow={isNarrow}
                    />
                )}

                {/* Account login/logout */}
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
