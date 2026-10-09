import { makeStaticStyles } from "@fluentui/react-components";
import { color, font } from "./tokens";

/**
 * The ChatUiT app's global base styles (App.css, typography.css and theme.css): the reset, base
 * text, form controls that inherit the font, selection colours, no focus outline and the scrollbars.
 * The page and its #root container fill the pane.
 */
export const useGlobalStyles = makeStaticStyles(`
  :root {
    font-size: 16px;
    font-family: ${font.sans};
    font-weight: 400;
    line-height: 1.5;
    color: ${color.text};
    background: ${color.bg};
    -webkit-font-smoothing: antialiased;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html,
  body,
  #root {
    width: 100%;
    height: 100%;
  }

  textarea,
  input,
  button,
  select {
    font-family: inherit;
    font-size: inherit;
    color: inherit;
  }

  ::selection {
    background: ${color.accent2};
    color: ${color.text};
  }

  :focus,
  :focus-visible {
    outline: none;
  }

  ::-webkit-scrollbar {
    width: 0.625rem;
    height: 0.625rem;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${color.line};
    border: 3px solid transparent;
    background-clip: content-box;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${color.text3};
    border: 3px solid transparent;
    background-clip: content-box;
  }
`);
