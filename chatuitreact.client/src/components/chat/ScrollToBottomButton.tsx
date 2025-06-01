import React, { useState, useEffect } from 'react';
import { MdKeyboardArrowDown } from 'react-icons/md';

interface ScrollToBottomButtonProps {
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  onScrollToBottom: () => void;
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  chatContainerRef,
  onScrollToBottom,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const nearBottom = distanceFromBottom < 100;
      setIsVisible(!nearBottom);
    };

    chatContainer.addEventListener('scroll', handleScroll);
    
    // Initial check
    handleScroll();

    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [chatContainerRef]);

  return (
    <button 
      className={`scroll-to-bottom-button ${isVisible ? 'visible' : 'hidden'}`}
      onClick={onScrollToBottom}
      title="Scroll to bottom"
    >
      <MdKeyboardArrowDown size="20px" />
    </button>
  );
};

export default ScrollToBottomButton;
