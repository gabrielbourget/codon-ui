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
    name: "theme/action-colors",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/theme/action-colors.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "action-colors.css",
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
    name: "tokens/a11y",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/a11y.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "a11y.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "tokens/alignment",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/alignment.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "alignment.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "tokens/drag",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/drag.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "drag.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "tokens/placement",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/placement.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "placement.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "tokens/responsive",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/responsive.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "responsive.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
      },
    ],
  },
  {
    name: "tokens/motion",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/motion.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "motion.ts",
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
    name: "theme/circular-progress-compatibility",
    type: REGISTRY_ITEM_TYPE__THEME,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/CircularProgress/circular-progress-compatibility.css",
        targetRole: REGISTRY_TARGET_ROLE__THEME,
        targetPath: "circular-progress-compatibility.css",
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
    name: "tokens/svg",
    type: REGISTRY_ITEM_TYPE__SUPPORT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/tokens/svg.ts",
        targetRole: REGISTRY_TARGET_ROLE__TOKENS,
        targetPath: "svg.ts",
        role: REGISTRY_FILE_ROLE__SUPPORT,
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
    name: "avatar",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Avatar/Avatar.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Avatar/Avatar.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Avatar/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Avatar/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Avatar/AvatarStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Avatar/AvatarStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "text"],
    peerDependencies: {
      "@radix-ui/react-avatar": "^1.1.11",
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "button",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Button/Button.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Button/Button.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Button/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Button/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Button/ButtonStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Button/ButtonStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
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
    name: "card",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Card/Card.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Cards/Card/Card.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Card/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Cards/Card/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Card/CardStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Cards/Card/CardStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "carousel",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Carousel/Carousel.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/Carousel.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/CarouselStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/CarouselStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselDots/CarouselDots.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselDots/CarouselDots.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselDots/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselDots/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselDots/CarouselDotsStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselDots/CarouselDotsStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselCounter/CarouselCounter.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselCounter/CarouselCounter.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselCounter/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselCounter/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Carousel/components/CarouselCounter/CarouselCounterStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselCounter/CarouselCounterStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselPrevButton/CarouselPrevButton.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselPrevButton/CarouselPrevButton.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselPrevButton/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselPrevButton/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselPrevButton/DefaultPrevIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselPrevButton/DefaultPrevIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselNextButton/CarouselNextButton.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselNextButton/CarouselNextButton.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselNextButton/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselNextButton/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselNextButton/DefaultNextIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselNextButton/DefaultNextIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselCloseButton/CarouselCloseButton.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselCloseButton/CarouselCloseButton.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselCloseButton/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselCloseButton/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Carousel/components/CarouselCloseButton/DefaultCloseIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Carousel/components/CarouselCloseButton/DefaultCloseIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    registryDependencies: ["theme-css", "button", "counter", "text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      "embla-carousel": "^8.6.0",
      "embla-carousel-react": "^8.6.0",
    },
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
    name: "checkbox-group",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/CheckboxGroup/CheckboxGroup.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CheckboxGroup/CheckboxGroup.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CheckboxGroup/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CheckboxGroup/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CheckboxGroup/CheckboxGroupStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CheckboxGroup/CheckboxGroupStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "checkbox"],
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
    name: "input",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Input/Input.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Input/Input.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Input/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Input/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Input/InputStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Input/InputStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "text"],
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
    name: "text-area",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/TextArea/TextArea.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TextArea/TextArea.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TextArea/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TextArea/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TextArea/TextAreaStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TextArea/TextAreaStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "text"],
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
    name: "number-input",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/NumberInput/NumberInput.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "NumberInput/NumberInput.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/NumberInput/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "NumberInput/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/NumberInput/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "NumberInput/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/NumberInput/DefaultIncrementIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "NumberInput/DefaultIncrementIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/NumberInput/DefaultDecrementIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "NumberInput/DefaultDecrementIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/NumberInput/NumberInputStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "NumberInput/NumberInputStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "input", "button"],
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
    name: "stepper",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Stepper/Stepper.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Stepper/Stepper.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Stepper/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Stepper/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Stepper/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Stepper/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Stepper/StepperStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Stepper/StepperStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "tokens/theme-order", "input", "button"],
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
    name: "time-picker",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/TimePicker/TimePicker.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TimePicker/TimePicker.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TimePicker/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TimePicker/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TimePicker/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TimePicker/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TimePicker/DefaultClockIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TimePicker/DefaultClockIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TimePicker/TimePickerStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TimePicker/TimePickerStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "text"],
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
    name: "date-time-picker",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/DateTimePicker/DateTimePicker.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimePicker/DateTimePicker.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimePicker/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimePicker/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimePicker/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimePicker/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimePicker/DefaultDateTimePickerIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimePicker/DefaultDateTimePickerIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimePicker/DateTimePickerStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimePicker/DateTimePickerStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimePicker/CalendarStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimePicker/CalendarStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/placement", "text", "button"],
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
    name: "date-time-range-picker",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/DateTimeRangePicker/DateTimeRangePicker.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimeRangePicker/DateTimeRangePicker.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimeRangePicker/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimeRangePicker/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimeRangePicker/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimeRangePicker/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimeRangePicker/DefaultDateTimeRangePickerIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimeRangePicker/DefaultDateTimeRangePickerIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimeRangePicker/DateTimeRangePickerStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimeRangePicker/DateTimeRangePickerStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/DateTimeRangePicker/CalendarStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "DateTimeRangePicker/CalendarStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/placement", "text", "button"],
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
    name: "table",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Table/Table.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/Table.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/TableContext.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/TableContext.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/queryTypes.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/queryTypes.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/filterMetadata.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/filterMetadata.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/filterDraft.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/filterDraft.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/TableStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/TableStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableHeader/TableHeader.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableHeader/TableHeader.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableHeader/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableHeader/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableHeader/DefaultTableHeaderIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableHeader/DefaultTableHeaderIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableHeader/TableHeaderStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableHeader/TableHeaderStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableBody/TableBody.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableBody/TableBody.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableBody/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableBody/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableRow/TableRow.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableRow/TableRow.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableRow/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableRow/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableRow/DefaultDragIndicatorIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableRow/DefaultDragIndicatorIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableRow/TableRowStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableRow/TableRowStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableCell/TableCell.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableCell/TableCell.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableCell/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableCell/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableCell/TableCellStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableCell/TableCellStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableColumn/TableColumn.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableColumn/TableColumn.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableFilterPopover/TableFilterPopover.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableFilterPopover/TableFilterPopover.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Table/components/TableFilterPopover/DefaultAddConditionIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableFilterPopover/DefaultAddConditionIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Table/components/TableFilterPopover/TableFilterPopoverStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Table/components/TableFilterPopover/TableFilterPopoverStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/FilterClauseRow/FilterClauseRow.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/FilterClauseRow/FilterClauseRow.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/FilterClauseRow/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/FilterClauseRow/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/FilterClauseRow/DefaultDeleteIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/FilterClauseRow/DefaultDeleteIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/FilterClauseRow/FilterClauseRowStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/FilterClauseRow/FilterClauseRowStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInput.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInput.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Filtering/DynamicFilterArgumentInput/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/DynamicFilterArgumentInput/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInputStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Filtering/DynamicFilterArgumentInput/DynamicFilterArgumentInputStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgumentStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgumentStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgumentStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgumentStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/DefaultMultiInputTypeFilterArgumentIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/MultiInputTypeFilterArgument/DefaultMultiInputTypeFilterArgumentIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/SelectTypeFilterArgument/SelectTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/SelectTypeFilterArgument/SelectTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/ComboBoxTypeFilterArgument/ComboBoxTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/ComboBoxTypeFilterArgument/ComboBoxTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/MultiSelectTypeFilterArgument/MultiSelectTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/MultiSelectTypeFilterArgument/MultiSelectTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgumentStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath:
          "Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgumentStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/SortParameterList/SortParameterList.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/SortParameterList.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/SortParameterList/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/SortParameterList/SortParameterListStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/SortParameterListStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/SortParameterList/SortParameterListItem/SortParameterListItem.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/SortParameterListItem/SortParameterListItem.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/SortParameterList/SortParameterListItem/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/SortParameterListItem/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/SortParameterList/SortParameterListItem/DefaultDragIndicatorIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/SortParameterListItem/DefaultDragIndicatorIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/SortParameterList/SortParameterListItem/SortParameterListItemStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "SortParameterList/SortParameterListItem/SortParameterListItemStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "theme/action-colors",
      "theme/text-typography",
      "tokens/a11y",
      "tokens/alignment",
      "tokens/drag",
      "tokens/geometry",
      "tokens/responsive",
      "tokens/theme-order",
      "button",
      "card",
      "checkbox",
      "click-popover",
      "combo-box",
      "date-time-picker",
      "form-field",
      "input",
      "list-box-item",
      "number-input",
      "pagination",
      "select",
      "switch",
      "tag",
      "tag-combo-box",
      "text",
      "time-picker",
      "toggle-switcher",
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria": "^3.48.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      "@internationalized/date": "^3.12.1",
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "toaster",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Toaster/Toaster.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/Toaster.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/stateManagement.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/stateManagement.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/ToasterStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/ToasterStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/Toast/Toast.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/Toast/Toast.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/Toast/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/Toast/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/Toast/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/Toast/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/Toast/DefaultToastIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/Toast/DefaultToastIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Toaster/Toast/ToastStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Toaster/Toast/ToastStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/a11y", "tokens/geometry", "button", "text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      "date-fns": "^4.1.0",
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
    name: "toggle-switcher",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ToggleSwitcher/ToggleSwitcher.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ToggleSwitcher/ToggleSwitcher.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ToggleSwitcher/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ToggleSwitcher/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ToggleSwitcher/ToggleSwitcherStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ToggleSwitcher/ToggleSwitcherStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "theme/action-colors",
      "tokens/geometry",
      "tokens/theme-order",
      "tokens/motion",
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
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
    name: "placeholder-text",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Text/variants/PlaceholderText/PlaceholderText.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/variants/PlaceholderText/PlaceholderText.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Text/variants/PlaceholderText/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/variants/PlaceholderText/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Text/variants/PlaceholderText/PlaceholderTextStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "list-box-item",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ListBoxItem/ListBoxItem.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ListBoxItem/ListBoxItem.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ListBoxItem/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ListBoxItem/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ListBoxItem/ListBoxItemStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ListBoxItem/ListBoxItemStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "text"],
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
    name: "select",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Select/Select.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Select/Select.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Select/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Select/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Select/DefaultChevronDownIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Select/DefaultChevronDownIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Select/SelectStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Select/SelectStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "tokens/placement", "text", "button", "placeholder-text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "combo-box",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ComboBox/ComboBox.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ComboBox/ComboBox.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ComboBox/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ComboBox/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ComboBox/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ComboBox/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ComboBox/DefaultChevronDownIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ComboBox/DefaultChevronDownIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ComboBox/ComboBoxStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ComboBox/ComboBoxStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "tokens/placement", "button", "input", "placeholder-text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "click-popover",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ClickPopover/ClickPopover.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ClickPopover/ClickPopover.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ClickPopover/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ClickPopover/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/ClickPopover/ClickPopoverStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ClickPopover/ClickPopoverStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
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
    name: "tooltip",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Tooltip/Tooltip.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Tooltip/Tooltip.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Tooltip/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Tooltip/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Tooltip/TooltipStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Tooltip/TooltipStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
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
    name: "hover-popover",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/HoverPopover/HoverPopover.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "HoverPopover/HoverPopover.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/HoverPopover/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "HoverPopover/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/HoverPopover/HoverPopoverStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "HoverPopover/HoverPopoverStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
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
    name: "menu",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Menu/Menu.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Menu/Menu.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Menu/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Menu/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Menu/components/MenuItem.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Menu/components/MenuItem.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Menu/components/MenuSeparator.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Menu/components/MenuSeparator.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Menu/MenuStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Menu/MenuStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
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
    name: "panel",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Panel/Panel.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Panel/Panel.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Panel/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Panel/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Panel/PanelStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Panel/PanelStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "tokens/placement", "tokens/motion"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "modal",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Modal/Modal.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Modal/Modal.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Modal/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Modal/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Modal/ModalStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Modal/ModalStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "theme/action-colors",
      "tokens/a11y",
      "tokens/geometry",
      "tokens/theme-order",
      "button",
      "text",
    ],
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
    name: "alert-dialog",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/AlertDialog/AlertDialog.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "AlertDialog/AlertDialog.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/AlertDialog/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "AlertDialog/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/AlertDialog/DefaultAlertDialogIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "AlertDialog/DefaultAlertDialogIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/AlertDialog/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "AlertDialog/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/AlertDialog/AlertDialogStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "AlertDialog/AlertDialogStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/a11y", "tokens/geometry", "button", "text"],
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
    name: "line-segment",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/LineSegment/LineSegment.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "VisualUtilities/LineSegment/LineSegment.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    registryDependencies: ["theme-css"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "indicator",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Indicator/Indicator.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "VisualUtilities/Indicator/Indicator.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Indicator/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "VisualUtilities/Indicator/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Indicator/IndicatorStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "VisualUtilities/Indicator/IndicatorStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "circle-loader",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/CircleLoader/CircleLoader.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Loaders/CircleLoader/CircleLoader.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CircleLoader/CircleLoaderStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Loaders/CircleLoader/CircleLoaderStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
    },
  },
  {
    name: "lagging-lines-loader",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/LaggingLinesLoader/LaggingLinesLoader.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Loaders/LaggingLinesLoader/LaggingLinesLoader.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/LaggingLinesLoader/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Loaders/LaggingLinesLoader/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/LaggingLinesLoader/LaggingLinesLoaderStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Loaders/LaggingLinesLoader/LaggingLinesLoaderStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "link",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Link/Link.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Link/Link.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Link/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Link/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Link/LinkStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Link/LinkStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/a11y", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "breadcrumbs",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Breadcrumbs/Breadcrumbs.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Breadcrumbs/Breadcrumbs.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Breadcrumbs/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Breadcrumbs/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Breadcrumbs/BreadcrumbsStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Breadcrumbs/BreadcrumbsStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Breadcrumbs/DefaultBreadcrumbIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Breadcrumbs/DefaultBreadcrumbIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Breadcrumbs/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Breadcrumbs/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "theme/action-colors",
      "tokens/a11y",
      "tokens/geometry",
      "tokens/theme-order",
      "button",
      "click-popover",
      "link",
      "list-box-item",
      "text",
    ],
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
    name: "pagination",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Pagination/Pagination.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/Pagination.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/PaginationStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/PaginationStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath:
          "packages/react/src/components/Pagination/components/PrimaryPaginationControls/PrimaryPaginationControls.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PrimaryPaginationControls/PrimaryPaginationControls.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/components/PrimaryPaginationControls/helpers.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PrimaryPaginationControls/helpers.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Pagination/components/PrimaryPaginationControls/DefaultPaginationIcons.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PrimaryPaginationControls/DefaultPaginationIcons.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath:
          "packages/react/src/components/Pagination/components/PrimaryPaginationControls/PrimaryPaginationControlsStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PrimaryPaginationControls/PrimaryPaginationControlsStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/components/PageCounter/PageCounter.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PageCounter/PageCounter.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/components/PageCounter/PageCounterStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PageCounter/PageCounterStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/components/PageInput/PageInput.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PageInput/PageInput.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/components/PageInput/PageInputStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/PageInput/PageInputStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Pagination/components/ItemsPerPage/ItemsPerPage.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Pagination/components/ItemsPerPage/ItemsPerPage.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "theme/action-colors",
      "tokens/geometry",
      "tokens/theme-order",
      "button",
      "click-popover",
      "counter",
      "form-field",
      "line-segment",
      "list-box-item",
      "number-input",
      "select",
      "text",
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "tag-combo-box",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/TagComboBox/TagComboBox.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagComboBox/TagComboBox.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagComboBox/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagComboBox/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagComboBox/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagComboBox/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/TagComboBox/TagComboBoxStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "TagComboBox/TagComboBoxStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "tokens/geometry",
      "tokens/placement",
      "tokens/theme-order",
      "text",
      "combo-box",
      "tag-group",
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "typeahead-search",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/TypeaheadSearch.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/TypeaheadSearch.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/status.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/status.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/DefaultSearchIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/DefaultSearchIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/DefaultLoadingIndicator.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/DefaultLoadingIndicator.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/DefaultLoadingIndicator.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/DefaultLoadingIndicator.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/Search/TypeaheadSearch/TypeaheadSearchStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Search/TypeaheadSearch/TypeaheadSearchStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/geometry", "input", "button", "list-box-item", "placeholder-text"],
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
    name: "compact-typeahead-search",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/CompactTypeaheadSearch.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/CompactTypeaheadSearch.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/labels.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/labels.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/DefaultSearchIcon.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/DefaultSearchIcon.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/DefaultLoadingIndicator.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/DefaultLoadingIndicator.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/DefaultLoadingIndicator.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/DefaultLoadingIndicator.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/CompactTypeaheadSearch/CompactTypeaheadSearchStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CompactTypeaheadSearch/CompactTypeaheadSearchStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: [
      "theme-css",
      "tokens/geometry",
      "tokens/placement",
      "input",
      "button",
      "list-box-item",
      "placeholder-text",
    ],
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
    name: "thumbnail-image",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/ThumbnailImage/ThumbnailImage.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "ThumbnailImage/ThumbnailImage.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
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
    name: "circular-progress",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/CircularProgress/CircularProgress.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CircularProgress/CircularProgress.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CircularProgress/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CircularProgress/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CircularProgress/CircularProgressStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CircularProgress/CircularProgressStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
      {
        sourcePath: "packages/react/src/components/CircularProgress/Path/Path.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CircularProgress/Path/Path.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/CircularProgress/Path/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "CircularProgress/Path/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
    ],
    registryDependencies: ["theme-css", "theme/circular-progress-compatibility", "tokens/svg", "tokens/theme-order"],
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
    name: "counter",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Counter/Counter.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Counter/Counter.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Counter/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Counter/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Counter/CounterStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Counter/CounterStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/a11y", "text", "circular-progress"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "form-field",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/FormField/FormField.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "FormField/FormField.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/FormField/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "FormField/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/FormField/FormFieldStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "FormField/FormFieldStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "tokens/a11y", "text"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
    },
  },
  {
    name: "linear-progress",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/LinearProgress/LinearProgress.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "LinearProgress/LinearProgress.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/LinearProgress/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "LinearProgress/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/LinearProgress/LinearProgressStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "LinearProgress/LinearProgressStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
    },
  },
  {
    name: "meter",
    type: REGISTRY_ITEM_TYPE__COMPONENT,
    sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
    files: [
      {
        sourcePath: "packages/react/src/components/Meter/Meter.tsx",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Meter/Meter.tsx",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Meter/helpers.ts",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Meter/helpers.ts",
        role: REGISTRY_FILE_ROLE__SOURCE,
      },
      {
        sourcePath: "packages/react/src/components/Meter/MeterStyles.module.css",
        targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
        targetPath: "Meter/MeterStyles.module.css",
        role: REGISTRY_FILE_ROLE__STYLE,
      },
    ],
    registryDependencies: ["theme-css", "theme/action-colors", "tokens/geometry", "tokens/theme-order"],
    peerDependencies: {
      react: "^18.2.0 || ^19.0.0",
      "react-aria-components": "^1.17.0",
      "react-dom": "^18.2.0 || ^19.0.0",
    },
    runtimeDependencies: {
      classnames: "^2.3.2",
      motion: "^12.40.0",
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
