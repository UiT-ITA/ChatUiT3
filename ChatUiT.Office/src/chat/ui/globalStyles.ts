import { makeStaticStyles } from "@fluentui/react-components";
import { color, font, space, fw, lh, border } from "./tokens";

/**
 * The ChatUiT app's global base styles (App.css, typography.css and theme.css): the reset, base
 * text, form controls that inherit the font, selection colours, no focus outline and the scrollbars.
 * The page, its #root container and the Fluent provider in it fill the pane.
 */
export const useGlobalStyles = makeStaticStyles(`
  :root {
    font-size: 100%;
    font-family: ${font.sans};
    font-weight: ${fw.regular};
    line-height: ${lh.base};
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
  #root,
  #root > .fui-FluentProvider {
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
    background: ${color.selBg};
    color: ${color.selFg};
  }

  :focus,
  :focus-visible {
    outline: none;
  }

  ::-webkit-scrollbar {
    width: ${space.sm};
    height: ${space.sm};
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${color.line};
    border: ${border.md} solid transparent;
    background-clip: content-box;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${color.text3};
    border: ${border.md} solid transparent;
    background-clip: content-box;
  }
`);
