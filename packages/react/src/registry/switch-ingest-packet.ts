import {
  REGISTRY_INGEST_THEME_STRATEGY__DEFAULT_CONTRACT,
  REGISTRY_INGEST_THEME_STRATEGY__PROOF_COMPATIBILITY_BRIDGE,
  REGISTRY_INGEST_VERIFICATION_KIND__COMMAND,
  REGISTRY_INGEST_VERIFICATION_KIND__SCAN,
  type TRegistryIngestPacket,
} from "./ingest"
import {
  REGISTRY_FILE_ROLE__SOURCE,
  REGISTRY_FILE_ROLE__STYLE,
  REGISTRY_FILE_ROLE__TEST,
  REGISTRY_FILE_ROLE__THEME,
  REGISTRY_ITEM_TYPE__COMPONENT,
  REGISTRY_SOURCE_PACKAGE__REACT,
  REGISTRY_TARGET_ROLE__COMPONENTS,
  REGISTRY_TARGET_ROLE__THEME,
} from "./types"

export const switchIngestPacketDraft = {
  name: "switch",
  type: REGISTRY_ITEM_TYPE__COMPONENT,
  sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
  sourceRepository: "wavemap",
  sourceRef: "apps/wavemap-docs/working-notes/COMPONENT_LIBRARY_EXTRACTION.md#read-only-switch-graph-audit",
  files: [
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/Switch.tsx",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/Switch.tsx",
      role: REGISTRY_FILE_ROLE__SOURCE,
    },
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/helpers.tsx",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/helpers.tsx",
      role: REGISTRY_FILE_ROLE__SOURCE,
    },
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/SwitchStyles.module.css",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/SwitchStyles.module.css",
      role: REGISTRY_FILE_ROLE__STYLE,
    },
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/__tests__/Switch.test.tsx",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/__tests__/Switch.test.tsx",
      role: REGISTRY_FILE_ROLE__TEST,
      required: false,
    },
  ],
  publicExports: [
    {
      exportedName: "Switch",
      localName: "default",
      sourcePath: "apps/wavemap-front-end/src/components/Switch/Switch.tsx",
    },
    {
      exportedName: "SwitchProps",
      localName: "TSwitchProps",
      sourcePath: "apps/wavemap-front-end/src/components/Switch/helpers.tsx",
      typeOnly: true,
    },
  ],
  importResolutions: [
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/helpers.tsx",
      importSource: "@/src/components/_registry/tokens",
      replacementSource: "../../tokens/geometry",
      notes: ["Replace geometry constants and types with the package-local token module during source receipt."],
    },
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/helpers.tsx",
      importSource: "@/src/components/_registry/tokens",
      replacementSource: "../../tokens/theme-order",
      notes: ["Replace theme-order constants and types with the package-local token module during source receipt."],
    },
    {
      sourcePath: "apps/wavemap-front-end/src/components/Switch/__tests__/Switch.test.tsx",
      importSource: "@/src/components/Switch/Switch",
      replacementSource: "../Switch",
      advisory: true,
      notes: ["Focused test import path depends on the approved package-side proof harness."],
    },
  ],
  excludedSourcePaths: [
    "apps/wavemap-front-end/src/components/Forms/SettingsForm/SettingsForm.tsx",
    "apps/wavemap-front-end/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument.tsx",
    "apps/wavemap-front-end/src/app/[locale]/component-showcase/page.tsx",
    "apps/wavemap-front-end/src/components/Forms/AddOrEditEventForm/AddOrEditEventForm.tsx",
  ],
  registryDependencies: ["theme-css", "tokens/geometry", "tokens/theme-order"],
  peerDependencies: {
    react: "^18.2.0 || ^19.0.0",
    "react-dom": "^18.2.0 || ^19.0.0",
    "react-aria-components": "TO_DECIDE",
  },
  runtimeDependencies: {
    classnames: "TO_DECIDE",
  },
  devDependencies: {
    "@testing-library/jest-dom": "TO_DECIDE",
    "@testing-library/react": "TO_DECIDE",
    "@testing-library/user-event": "TO_DECIDE",
    vitest: "TO_DECIDE",
  },
  themeRequirements: [
    {
      strategy: REGISTRY_INGEST_THEME_STRATEGY__DEFAULT_CONTRACT,
      cssVariables: [
        "--aui-border-muted",
        "--aui-control-border",
        "--aui-control-pressed-background",
        "--aui-control-selected-background",
        "--aui-control-selected-foreground",
      ],
      notes: ["These variables are already part of the package default theme contract."],
    },
    {
      strategy: REGISTRY_INGEST_THEME_STRATEGY__PROOF_COMPATIBILITY_BRIDGE,
      cssVariables: [
        "--aui-color-primary-500",
        "--aui-color-secondary-500",
        "--aui-color-tertiary-500",
        "--aui-color-quaternary-500",
        "--aui-color-quintenary-500",
        "--aui-neutral-8",
        "--disabledOpacity",
        "--colorTransition",
        "--bgColorTransition",
        "--borderColorTransition",
        "--border_radius_1",
        "--focus-ring-color",
        "--shadow_1",
      ],
      files: [
        {
          sourcePath: "packages/react/src/components/Switch/switch-compatibility.css",
          targetRole: REGISTRY_TARGET_ROLE__THEME,
          targetPath: "switch-compatibility.css",
          role: REGISTRY_FILE_ROLE__THEME,
          required: false,
        },
      ],
      notes: [
        "Bridge file shape is not approved yet; keep it outside the package default theme.css until the proof bridge is reviewed.",
      ],
    },
  ],
  verification: [
    {
      kind: REGISTRY_INGEST_VERIFICATION_KIND__SCAN,
      command:
        'rg --pcre2 -n "palette|getTheme|@wavemap|i18n|next/|router|route|media|query|api-contract|shared-utils|window|document|localStorage|@/src/(?!components/_registry/tokens)" apps/wavemap-front-end/src/components/Switch/Switch.tsx apps/wavemap-front-end/src/components/Switch/helpers.tsx apps/wavemap-front-end/src/components/Switch/SwitchStyles.module.css',
      workingDirectory: "../wavemap",
      advisory: true,
      notes: ["Read-only audit result was clean except for the expected registry token support edge."],
    },
    {
      kind: REGISTRY_INGEST_VERIFICATION_KIND__COMMAND,
      command: "pnpm -C apps/wavemap-front-end test:ci src/components/Switch/__tests__/Switch.test.tsx",
      workingDirectory: "../wavemap",
      advisory: true,
      notes: ["Read-only audit recorded 17 passing tests before source receipt."],
    },
    {
      kind: REGISTRY_INGEST_VERIFICATION_KIND__COMMAND,
      command: "pnpm -C apps/wavemap-front-end typecheck",
      workingDirectory: "../wavemap",
      advisory: true,
    },
  ],
  notes: [
    "Draft only: do not add this packet to reactRegistryManifest until Switch source exists in packages/react.",
    "Preserve the client component boundary and CSS-module source model for the first proof.",
    "Keep calibrateComponent, DEFAULT_ON_ICON, and DEFAULT_OFF_ICON private unless a later API review approves exporting them.",
    "Do not move Wavemap consumers, component showcase code, or commented legacy event-form scratch with the component.",
  ],
} satisfies TRegistryIngestPacket
