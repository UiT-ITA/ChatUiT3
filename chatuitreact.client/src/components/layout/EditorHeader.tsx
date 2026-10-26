import { useEffect } from 'react';
import { editorHeaderSignal, type EditorHeaderConfig } from '../../services/uiService';

/** Puts an edit page's back button and save/cancel buttons in the main header while the page is mounted. Renders nothing. */
const EditorHeader = (config: EditorHeaderConfig) => {
  useEffect(() => {
    editorHeaderSignal.value = config;
  });

  useEffect(() => () => {
    editorHeaderSignal.value = undefined;
  }, []);

  return null;
};

export default EditorHeader;
