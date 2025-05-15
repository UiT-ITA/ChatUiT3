import React from 'react';
import './SidebarButton.tsx.css';

interface SidebarButtonProps {
    icon: React.ReactNode;
    text: string;
    onClick: () => void;
    isNarrow: boolean; // Determines if the sidebar is in narrow mode
}

const SidebarButton = ({ icon, text, onClick, isNarrow }: SidebarButtonProps) => {
    return (
        <button className="sidebar-button" onClick={onClick} title={text}>
            <div className="icon-container">{icon}</div>
            {!isNarrow && <span className="button-text">{text}</span>}
        </button>
    );
};

export default SidebarButton;