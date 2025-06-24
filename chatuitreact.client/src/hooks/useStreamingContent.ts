import { useState, useEffect } from 'react';
import { streamingService } from '../services/streamingService';

export const useStreamingContent = (messageId: string) => {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = streamingService.subscribe(messageId, () => {
      forceUpdate({});
    });

    return unsubscribe;
  }, [messageId]);

  return streamingService.getContent(messageId);
};
