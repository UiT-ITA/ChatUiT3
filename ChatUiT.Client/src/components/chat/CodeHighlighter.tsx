import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, dracula, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

const styleMap = {
  oneLight: oneLight,
  atomDark: atomDark,
  dracula: dracula
};

interface CodeHighlighterProps {
  code: string;
  language: string;
  themeName: string;
}

// Loaded lazily by ChatMessage: the full Prism build is large and only
// needed once a message contains a code block.
function CodeHighlighter({ code, language, themeName }: CodeHighlighterProps) {
  return (
    <SyntaxHighlighter
      style={styleMap[themeName as keyof typeof styleMap] || atomDark}
      language={language}
    >
      {code}
    </SyntaxHighlighter>
  );
}

export default CodeHighlighter;
