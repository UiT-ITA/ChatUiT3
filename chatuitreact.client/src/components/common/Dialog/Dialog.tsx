import React, { useState, useEffect, createContext, useContext } from 'react';
import { Icon, IconName } from '../Icon';
import './Dialog.css';

// Context for managing dialog state
interface DialogContextType {
  activePageId: string | null;
  setActivePageId: (id: string) => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog');
  }
  return context;
};

// Main Dialog component
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'small' | 'medium' | 'large' | 'xl';
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  preventBodyScroll?: boolean;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  size = 'large',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  preventBodyScroll = true,
  children
}) => {
  const [activePageId, setActivePageId] = useState<string | null>(null);

  // Analyze children to determine layout
  const childrenArray = React.Children.toArray(children);
  const dialogPages = childrenArray.filter(
    child => React.isValidElement(child) && child.type === DialogPage
  ) as React.ReactElement<DialogPageProps>[];
  const dialogButtons = childrenArray.filter(
    child => React.isValidElement(child) && child.type === DialogButton
  ) as React.ReactElement<DialogButtonProps>[];
  const otherChildren = childrenArray.filter(
    child => !React.isValidElement(child) || 
    (child.type !== DialogPage && child.type !== DialogButton)
  );

  const hasSidebar = dialogPages.length >= 2;
  const hasFooter = dialogButtons.length > 0;

  // Set initial active page
  useEffect(() => {
    if (isOpen && dialogPages.length > 0 && !activePageId) {
      const firstPage = dialogPages[0];
      if (firstPage) {
        setActivePageId(firstPage.props.id);
      }
    }
  }, [isOpen, dialogPages.length, activePageId]);

  // Handle body scroll
  useEffect(() => {
    if (isOpen && preventBodyScroll) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, preventBodyScroll]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  const renderContent = () => {
    if (hasSidebar) {
      // Render active page content
      const activePage = dialogPages.find(page => page.props.id === activePageId);
      return activePage ? activePage.props.children : null;
    } else {
      // Render all non-button children
      return otherChildren;
    }
  };

  return (
    <DialogContext.Provider value={{ activePageId, setActivePageId }}>
      <div className="dialog-overlay" onClick={handleOverlayClick}>
        <div className={`dialog-container dialog-size-${size}`} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="dialog-header">
            <h2 className="dialog-title">{title}</h2>
            <button className="dialog-close-button" onClick={onClose}>
              <Icon name="close" size={1.5} />
            </button>
          </div>

          {/* Content */}
          <div className={`dialog-content ${hasSidebar ? 'with-sidebar' : ''}`}>
            {hasSidebar && (
              <div className="dialog-sidebar">
                {dialogPages.map((page) => {
                  const { id, label, icon } = page.props;
                  return (
                    <button
                      key={id}
                      className={`dialog-sidebar-button ${activePageId === id ? 'active' : ''}`}
                      onClick={() => setActivePageId(id)}
                    >
                      {icon && <Icon name={icon} size={1.2} />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="dialog-main">
              {renderContent()}
            </div>
          </div>

          {/* Footer */}
          {hasFooter && (
            <div className="dialog-footer">
              {dialogButtons}
            </div>
          )}
        </div>
      </div>
    </DialogContext.Provider>
  );
};

// DialogPage component
interface DialogPageProps {
  id: string;
  label: string;
  icon?: IconName;
  children: React.ReactNode;
}

export const DialogPage: React.FC<DialogPageProps> = ({ children }) => {
  // This component's children are rendered by the Dialog component
  // The component itself is just a marker for the Dialog to detect
  return <>{children}</>;
};

// DialogButton component
interface DialogButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const DialogButton: React.FC<DialogButtonProps> = ({
  variant = 'secondary',
  onClick,
  disabled = false,
  loading = false,
  children
}) => {
  return (
    <button
      className={`dialog-button dialog-button-${variant}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
};
