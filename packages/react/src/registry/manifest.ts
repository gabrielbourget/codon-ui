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
    name: "theme/checkbox-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Checkbox/checkbox-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "checkbox-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/toggle-button-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ToggleButton/toggle-button-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "toggle-button-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/radio-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Radio/radio-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "radio-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/radio-group-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/RadioGroup/radio-group-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "radio-group-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/slider-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Slider/slider-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "slider-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/tag-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Tag/tag-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "tag-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/tag-group-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/TagGroup/tag-group-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "tag-group-compatibility.css",
        role: REGISTRY_FILE_ROLE__THEME,
      },
    ],
  },
  {
    name: "theme/text-typography",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Text/text-typography.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "text-typography.css",
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
  {
    name: "checkbox",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Checkbox/Checkbox.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Checkbox/Checkbox.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Checkbox/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Checkbox/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Checkbox/CheckboxStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Checkbox/CheckboxStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/checkbox-compatibility", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "toggle-button",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ToggleButton/ToggleButton.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ToggleButton/ToggleButton.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ToggleButton/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ToggleButton/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ToggleButton/ToggleButtonStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ToggleButton/ToggleButtonStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/toggle-button-compatibility", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "radio",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Radio/Radio.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Radio/Radio.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Radio/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Radio/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Radio/RadioStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Radio/RadioStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/radio-compatibility", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "text",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Text/Text.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/Text.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Text/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Text/constants.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/constants.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Text/types.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/types.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Text/TextStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/TextStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/text-typography"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "slider",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Slider/Slider.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Slider/Slider.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Slider/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Slider/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Slider/SliderStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Slider/SliderStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/slider-compatibility", "tokens/geometry", "tokens/theme-order", "text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "tag",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Tag/Tag.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Tag/Tag.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Tag/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Tag/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Tag/TagStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Tag/TagStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/tag-compatibility", "tokens/geometry"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "tag-group",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/TagGroup/TagGroup.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/TagGroup.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagGroup/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagGroup/TagGroupStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/TagGroupStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/TagGroup/AdobeTag/AdobeTag.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/AdobeTag/AdobeTag.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagGroup/AdobeTag/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/AdobeTag/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagGroup/AdobeTag/AdobeTagStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/AdobeTag/AdobeTagStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/TagGroup/AdobeTag/DefaultCloseIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagGroup/AdobeTag/DefaultCloseIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    registryDependencies: ["theme-css", "theme/tag-group-compatibility", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "radio-group",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/RadioGroup/RadioGroup.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "RadioGroup/RadioGroup.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/RadioGroup/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "RadioGroup/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/RadioGroup/RadioGroupStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "RadioGroup/RadioGroupStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/radio-group-compatibility", "radio"],
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
