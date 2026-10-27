import { useEffect, useRef } from 'react';
import { editorHeaderSignal, type EditorHeaderConfig } from '../../services/uiService';

/** Puts an edit page's back button and save/cancel buttons in the main header while the page is mounted. Renders nothing. */
const EditorHeader = ({ backPath, backLabel, dirty, saveLabel, saveDisabled, onSave, onCancel }: EditorHeaderConfig) => {
  // The latest save and cancel handlers, called through the header config
  const handlers = useRef({ onSave, onCancel });
  useEffect(() => {
    handlers.current = { onSave, onCancel };
  });

  useEffect(() => {
    editorHeaderSignal.value = {
      backPath,
      backLabel,
      dirty,
      saveLabel,
      saveDisabled,
      onSave: () => handlers.current.onSave(),
      onCancel: () => handlers.current.onCancel(),
    };
  }, [backPath, backLabel, dirty, saveLabel, saveDisabled]);

  useEffect(() => () => {
    editorHeaderSignal.value = undefined;
  }, []);

  return null;
};

export default EditorHeader;
