import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';

interface ScrollToBottomButtonProps {
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  onScrollToBottom: () => void;
}

const ScrollToBottomButton = ({
  chatContainerRef,
  onScrollToBottom,
}: ScrollToBottomButtonProps) => {
  const { t } = useTranslation();
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
      title={t('chat.scrollToBottom')}
    >
      <Icon name="arrowDown" size={1.25} />
    </button>
  );
};

export default ScrollToBottomButton;
