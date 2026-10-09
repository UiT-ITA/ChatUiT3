import { webLightTheme, type Theme } from "@fluentui/react-components";
import { color, font, radius } from "./tokens";

/** Fluent's light theme with the ChatUiT app's colours, fonts and radii. */
export const chatuitTheme: Theme = {
  ...webLightTheme,
  fontFamilyBase: font.sans,
  fontFamilyMonospace: font.mono,
  fontFamilyNumeric: font.sans,

  borderRadiusSmall: radius.sm,
  borderRadiusMedium: radius.md,
  borderRadiusLarge: radius.lg,

  colorNeutralForeground1: color.text,
  colorNeutralForeground2: color.text2,
  colorNeutralForeground3: color.text3,
  colorNeutralBackground1: color.surface,
  colorNeutralBackground2: color.panel,
  colorNeutralBackground3: color.panel2,
  colorNeutralBackground1Hover: color.panel,
  colorNeutralBackground1Pressed: color.panel2,
  colorNeutralStroke1: color.line,
  colorNeutralStroke1Hover: color.text3,
  colorNeutralStroke1Pressed: color.text3,
  colorNeutralStroke2: color.lineSoft,
  colorNeutralStrokeAccessible: color.text3,
  colorNeutralStrokeAccessibleHover: color.text2,

  colorBrandBackground: color.btnBg,
  colorBrandBackgroundHover: color.btnHover,
  colorBrandBackgroundPressed: color.btnHover,
  colorBrandBackgroundSelected: color.btnBg,
  colorCompoundBrandBackground: color.btnBg,
  colorCompoundBrandBackgroundHover: color.btnHover,
  colorCompoundBrandBackgroundPressed: color.btnHover,
  colorCompoundBrandStroke: color.brand,
  colorCompoundBrandStrokeHover: color.btnHover,
  colorCompoundBrandStrokePressed: color.btnHover,
  colorBrandStroke1: color.brand,
  colorBrandForeground1: color.accent,
  colorBrandForegroundLink: color.accent,
  colorBrandForegroundLinkHover: color.brand,
  colorNeutralForegroundOnBrand: color.btnFg,
};
