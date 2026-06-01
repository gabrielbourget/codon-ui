import type { TRegistryManifest } from "./types"
import {
  REGISTRY_FILE_ROLE__SOURCE,
  REGISTRY_FILE_ROLE__STYLE,
  REGISTRY_FILE_ROLE__SUPPORT,
  REGISTRY_FILE_ROLE__THEME,
  REGISTRY_ITEM_TYPE__COMPONENT,
  REGISTRY_ITEM_TYPE__SUPPORT,
  REGISTRY_ITEM_TYPE__THEME,
  REGISTRY_SOURCE_PACKAGE__REACT,
  REGISTRY_TARGET_ROLE__COMPONENTS,
  REGISTRY_TARGET_ROLE__THEME,
  REGISTRY_TARGET_ROLE__TOKENS,
} from "./types"

export const reactRegistryManifest = [
  {
    name: "theme-css",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/theme.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "theme.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "tokens/geometry",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/geometry.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "geometry.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "theme/switch-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Switch/switch-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "switch-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "tokens/theme-order",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/theme-order.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "theme-order.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "switch",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Switch/Switch.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Switch/Switch.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Switch/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Switch/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Switch/SwitchStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Switch/SwitchStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/switch-compatibility", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
] satisfies TRegistryManifest
