import { useState, useEffect } from 'react';

const useVisualViewport = (isMobile: boolean) => {
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!isMobile || !window.visualViewport) {
      setViewportHeight(window.innerHeight);
      setIsKeyboardOpen(false);
      return;
    }

    const handleViewportChange = () => {
      console.log('Window height:', window.innerHeight);
      console.log('Viewport height:', window.visualViewport?.height);
      console.log('Height difference:', window.innerHeight - (window.visualViewport?.height || 0));
      console.log('Is keyboard open:', isKeyboardOpen);


      const newHeight = window.visualViewport!.height;
      const heightDifference = window.innerHeight - newHeight;
      
      setViewportHeight(newHeight);
      setIsKeyboardOpen(heightDifference > 100); // Threshold for keyboard detection
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    return () => {
      window.visualViewport!.removeEventListener('resize', handleViewportChange);
    };
  }, [isMobile]);

  return { viewportHeight, isKeyboardOpen };
};

export default useVisualViewport;
