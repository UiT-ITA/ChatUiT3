import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import { getChat, getSelectableAssistants } from '../../services/chatService';
import './ConversationPanel.css';

interface ConversationPanelProps {
  chatId: string;
}

function ConversationPanel({ chatId }: ConversationPanelProps) {
  useSignals();
  const { t, i18n } = useTranslation();

  const chat = getChat(chatId).value;
  const assistants = getSelectableAssistants().value || [];
  const assistant = chat ? assistants.find((a) => a.id === chat.assistantId) : undefined;

  const files = chat?.messages.flatMap((message) => message.files || []) || [];

  const formatDate = (value: string | undefined) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <aside className="conversation-panel">
      <div className="conversation-panel-title t-overline">{t('chat.panel.title')}</div>

      <div className="conversation-panel-section t-overline">{t('chat.panel.files')}</div>
      {files.length > 0 ? (
        <div className="conversation-panel-files">
          {files.map((file) => (
            <div key={file.id} className="conversation-panel-file t-caption">
              <Icon name="file" size={0.875} className="conversation-panel-file-icon" />
              <span>{file.sourceFilename}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="conversation-panel-empty t-caption">{t('chat.panel.noFiles')}</div>
      )}

      <div className="conversation-panel-meta t-hint">
        {assistant && <>{t('chat.panel.assistant')}: {assistant.name}<br /></>}
        {chat?.createdAt && <>{t('chat.panel.created')}: {formatDate(chat.createdAt)}<br /></>}
        {chat?.updatedAt && <>{t('chat.panel.updated')}: {formatDate(chat.updatedAt)}</>}
      </div>
    </aside>
  );
}

export default ConversationPanel;
