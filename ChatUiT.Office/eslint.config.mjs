// office-addin-lint uses this file instead of its default config when it exists.
// The default config only matches .js and .ts files, so .tsx files get the same rules here.
import defaults from "office-addin-lint/config/eslint.config.mjs";

const typescriptRules = defaults.find((config) => config.rules?.["prettier/prettier"]);

// src/chat is shared by every app (the Office apps, and Teams later), so it may not depend on any one of them.
const chatBoundary = {
  files: ["src/chat/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/office", "**/office/**", "**/teams", "**/teams/**", "@microsoft/teams-js"],
            message: "src/chat is shared by every app and may not import app code.",
          },
        ],
      },
    ],
    "no-restricted-globals": ["error", "Office", "OfficeExtension", "Word", "Excel", "PowerPoint", "microsoftTeams"],
  },
};

// Each Office app folder may use only its own app's API and may not import another app's folder.
// What the apps share lives in src/office/shared.
const officeApps = [
  { folder: "word", global: "Word" },
  { folder: "excel", global: "Excel" },
  { folder: "powerpoint", global: "PowerPoint" },
  { folder: "outlook", global: null },
];
const appBoundaries = officeApps.map((app) => {
  const others = officeApps.filter((other) => other !== app);
  return {
    files: [`src/office/${app.folder}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: others.flatMap((other) => [`**/${other.folder}`, `**/${other.folder}/**`]),
              message: `src/office/${app.folder} may not import another Office app. Shared code goes in src/office/shared.`,
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", ...others.map((other) => other.global).filter(Boolean)],
    },
  };
});

export default [...defaults, { ...typescriptRules, files: ["**/*.tsx"] }, chatBoundary, ...appBoundaries];
