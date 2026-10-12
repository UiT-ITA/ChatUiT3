import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { respondToToolCall } from '../services/chatService';
import { ApiError } from '../services/apiService';

/**
 * The buttons on a paused tool call. One request at a time per call; a 400 (bad edited
 * arguments) keeps the card editable, anything else is shown as an error line.
 */
export function useToolCallActions(chatId: string | null, messageId: string, toolCallId: string) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (!chatId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(t('toolCall.invalidJson'));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  }, [chatId, busy, t]);

  const approve = useCallback((editedArgumentsJson: string | null) => run(async () => {
    await respondToToolCall(chatId!, messageId, toolCallId, { kind: 'confirmation', decision: 'approve', editedArgumentsJson });
  }), [run, chatId, messageId, toolCallId]);

  const reject = useCallback(() => run(async () => {
    await respondToToolCall(chatId!, messageId, toolCallId, { kind: 'confirmation', decision: 'reject', editedArgumentsJson: null });
  }), [run, chatId, messageId, toolCallId]);

  return { approve, reject, busy, error, canRespond: chatId !== null };
}
