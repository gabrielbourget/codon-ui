import type { THelperRegistry } from "./schema"

export const helperRegistry: THelperRegistry = [
  {
    name: "utils/data",
    type: "utils",
    fileName: "data",
    file: "data.ts",
  },
  {
    name: "utils/ui",
    type: "utils",
    fileName: "ui",
    file: "ui.ts",
  },
  {
    name: "utils/serverSideStyles",
    type: "utils",
    fileName: "serverSideStyles",
    file: "serverSideStyles.ts",
  },
  {
    name: "constants/geometry",
    type: "constants",
    fileName: "geometry",
    file: "geometry.ts",
  },
  {
    name: "constants/ui",
    type: "constants",
    fileName: "ui",
    file: "ui.ts",
  },
  {
    name: "constants/theme",
    type: "constants",
    fileName: "theme",
    file: "theme.ts",
  },
  {
    name: "types/data",
    type: "types",
    fileName: "data",
    file: "data.ts",
  },
  {
    name: "types/geometry",
    type: "types",
    fileName: "geometry",
    file: "geometry.ts",
  },
  {
    name: "types/accessibility",
    type: "utils",
    fileName: "accessibility",
    file: "accessibility.ts",
  },
  {
    name: "types/theme",
    type: "types",
    fileName: "theme",
    file: "theme.ts",
  },
  {
    name: "types/ui",
    type: "types",
    fileName: "ui",
    file: "ui.ts",
  },
  {
    name: "types/utils",
    type: "types",
    fileName: "utils",
    file: "utils.ts",
  },
  {
    name: "globalCSS",
    type: "globalCSS",
    fileName: "globals",
    file: "globals.css",
  },
  {
    name: "textCSS",
    type: "utils",
    fileName: "TextStyles",
    file: "TextStyles.module.scss",
  },
]
