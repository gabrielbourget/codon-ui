import type { TComponentRegistry } from "./schema";

export const componentRegistry: TComponentRegistry = [
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "accordion",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Accordion",
  // },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "action-sheet",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "ActionSheet",
  // },
  {
    name: "alert-dialog",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: [
      "text", "button", "garbage-bin-icon", "checkmark-icon", "info-icon", "octagon-frame-exclamation-icon",
      "triangle-frame-exclamation-icon", "x-icon"
    ],
    helperRegistryDependencies: ["textCSS", "types/accessibility", "constants/geometry", "types/geometry"],
    directory: "AlertDialog",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "audio-player",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "AudioPlayer",
  // },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "avatar",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Avatar",
  // },
  {
    name: "button",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["constants/theme", "constants/geometry", "types/theme", "types/geometry"],
    directory: "Button",
  },
  {
    name: "breadcrumbs",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: [
      "button", "click-popover", "link", "listbox-item", "text", "context-menu-horizontal-icon", "chevron-right-icon`"
    ],
    helperRegistryDependencies: ["constants/theme", "types/theme", "types/accessibility", "types/utils"],
    directory: "Breadcrumbs",
  },
  {
    name: "calendar-icon",
    isIcon: true,
    file: "CalendarIcon.tsx",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "carousel",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Carousel",
  // },
  {
    name: "checkbox",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["helpers/theme", "constants/theme", "helpers/geometry", "constants/geometry"],
    directory: "Checkbox",
  },
  {
    name: "checkbox-group",
    isIcon: false,
    dependencies: ["react-aria-components"],
    directory: "CheckboxGroup",
  },
  {
    name: "checkmark-icon",
    isIcon: true,
    file: "CheckmarkIcon.tsx",
  },
  {
    name: "chevron-down-icon",
    isIcon: true,
    file: "ChevronDownIcon.tsx",
  },
  {
    name: "chevron-left-icon",
    isIcon: true,
    file: "ChevronLeftIcon.tsx",
  },
  {
    name: "chevron-right-icon",
    isIcon: true,
    file: "ChevronRightIcon.tsx",
  },
  {
    name: "chevron-up-icon",
    isIcon: true,
    file: "ChevronUpIcon.tsx",
  },
  {
    name: "circular-progress",
    isIcon: false,
    dependencies: ["framer-motion", "react-aria-components"],
    helperRegistryDependencies: ["constants/ui", "constants/theme", "types/theme", "types/ui"],
    directory: "CircularProgress",
  },
  {
    name: "circle-frame-info-icon",
    isIcon: true,
    file: "CircleFrameInfoIcon.tsx",
  },
  {
    name: "click-popover",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["constants/theme", "constants/geometry", "types/theme", "types/geometry"],
    directory: "ClickPopover",
  },
  {
    name: "clock-icon",
    isIcon: true,
    file: "ClockIcon.tsx",
  },
  {
    name: "combo-box",
    isIcon: false,
    dependencies: ["framer-motion", "react-aria-components"],
    componentRegistryDependencies: ["button", "input", "chevron-down-icon"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "types/ui"],
    directory: "ComboBox",
  },
  {
    name: "context-menu-horizontal-icon",
    isIcon: true,
    file: "ContextMenuHorizontalIcon.tsx",
  },
  {
    name: "counter",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["circular-progress", "text"],
    helperRegistryDependencies: ["types/accessibility"],
    directory: "Counter",
  },
  {
    name: "datetime-picker",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["button", "calendar-icon", "chevron-right-icon", "chevron-left-icon"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "types/ui", "textCSS"],
    directory: "DateTimePicker",
  },
  {
    name: "datetime-range-picker",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["button", "calendar-icon", "chevron-right-icon", "chevron-left-icon"],
    helperRegistryDependencies: ["types/geometry", "constants/geometry", "types/ui", "textCSS"],
    directory: "DateTimeRangePicker",
  },
  {
    name: "double-chevron-left-icon",
    isIcon: true,
    file: "DoubleChevronLeftIcon.tsx",
  },
  {
    name: "double-chevron-right-icon",
    isIcon: true,
    file: "DoubleChevronRightIcon.tsx",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "drawer",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Drawer",
  // },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "file-upload-surface",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "FileUploadSurface",
  // },
  {
    name: "form-field",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["text"],
    helperRegistryDependencies: ["types/accessibility"],
    directory: "FormField",
  },
  {
    name: "gargage-bin-icon",
    isIcon: true,
    file: "GarbageBinIcon.tsx",
  },
  {
    name: "hover-popover",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["constants/theme", "types/themes", "constants/geometry", "types/geometry"],
    directory: "HoverPopover",
  },
  {
    name: "info-icon",
    isIcon: true,
    file: "InfoIcon.tsx",
  },
  {
    name: "input",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["types/geometry", "constants/geometry", "textCSS"],
    directory: "Input",
  },
  {
    name: "line-segment",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["constants/geometry"],
    directory: "LineSegment",
  },
  {
    name: "linear-progress",
    isIcon: false,
    dependencies: ["framer-motion", "react-aria-components"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "types/theme"],
    directory: "LinearProgress",
  },
  {
    name: "link",
    isIcon: false,
    dependencies: ["next/link", "react"],
    helperRegistryDependencies: ["constants/theme", "types/theme", "types/accessibility"],
    directory: "Link",
  },
  {
    name: "listbox-item",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["textCSS"],
    directory: "ListBoxItem",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "map",
  //   isIcon: false,
  //   dependencies: ["react"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Map",
  // },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "masonry-gallery",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "MasonryGallery",
  // },
  {
    name: "meter",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "constants/theme", "types/theme"],
    directory: "Meter",
  },
  {
    name: "minus-icon",
    isIcon: true,
    file: "MinusIcon.tsx",
  },
  {
    name: "modal",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["button", "text"],
    helperRegistryDependencies: [
      "textCSS", "constants/theme", "types/theme", "constants/geometry", "types/geometry", "types/accessibility"
    ],
    directory: "Modal",
  },
  {
    name: "number-input",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["button", "input", "chevron-up-icon", "chevron-down-icon"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry"],
    directory: "NumberInput",
  },
  {
    name: "octagon-frame-exclamation-icon",
    isIcon: true,
    file: "OctagonFrameExclamationIcon.tsx",
  },
  {
    name: "pagination",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: [
      "button", "click-popover","counter", "line-segment", "listbox-item", "form-field",
      "number-input", "select", "text"
    ],
    helperRegistryDependencies: [
      "constants/geometry", "types/geometry", "constants/theme", "types/theme", "constants/ui", "utils/data",
      "double-chevron-left-icon", "double-chevron-right-icon", "chevron-left-icon", "chevron-right-icon"
    ],
    directory: "Pagination",
  },
  {
    name: "plus-icon",
    isIcon: true,
    file: "PlusIcon.tsx",
  },
  {
    name: "radio",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["types/geometry", "constants/geometry", "types/theme", "constants/theme"],
    directory: "Radio",
  },
  {
    name: "radio-group",
    isIcon: false,
    dependencies: ["react-aria-components"],
    directory: "RadioGroup",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "search-bar",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "SearchBar",
  // },
  {
    name: "select",
    isIcon: false,
    dependencies: ["framer-motion", "react-aria-components"],
    componentRegistryDependencies: ["button", "chevron-down-icon"],
    helperRegistryDependencies: ["types/geometry", "types/ui", "textCSS"],
    directory: "Select",
  },
  {
    name: "slider",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["text"],
    helperRegistryDependencies: ["constants/theme", "types/theme", "constants/geometry", "types/geometry", "textCSS"],
    directory: "Slider",
  },
  {
    name: "stepper",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["button", "input", "minus-icon", "plus-icon"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "constants/theme", "types/theme"],
    directory: "Stepper",
  },
  {
    name: "switch",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "constants/theme", "types/theme"],
    directory: "Switch",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "table",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Table",
  // },
  {
    name: "tag",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["button", "x-icon"],
    helperRegistryDependencies: ["constants/geometry", "types/geometry", "constants/theme", "types/theme"],
    directory: "Tag",
  },
  {
    name: "tag-combo-box",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: ["combo-box", "tag-group", "tag", "listbox-item", "text"],
    helperRegistryDependencies: [
      "constants/gometry", "types/geometry", "constants/theme", "types/theme", "constants/ui", "types/data"
    ],
    directory: "TagComboBox",
  },
  {
    name: "tag-group",
    isIcon: false,
    dependencies: ["react-aria-components"],
    directory: "TagGroup",
  },
  {
    name: "text",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["textCSS"],
    directory: "Text",
  },
  {
    name: "textarea",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["types/geometry", "constants/geometry"],
    directory: "TextArea",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "thumbnail-row",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "ThumbnailRow",
  // },
  {
    name: "time-picker",
    isIcon: false,
    dependencies: ["react-aria-components", "clock-icon"],
    helperRegistryDependencies: ["textCSS", "constants/geometry", "types/geometry"],
    directory: "TimePicker",
  },
  {
    name: "toaster",
    isIcon: false,
    dependencies: ["react-aria-components"],
    componentRegistryDependencies: [
      "button", "text", "garbage-bin-icon", "checkmark-icon", "info-icon", "octagon-frame-exclamation-icon",
      "triangle-frame-exclamation-icon", "x-icon"
    ],
    helperRegistryDependencies: ["textCSS", "types/accesibility"],
    directory: "Toaster",
  },
  {
    name: "toggle-button",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["types/theme", "constants/theme", "types/geometry", "constants/geometry"],
    directory: "ToggleButton",
  },
  {
    name: "tooltip",
    isIcon: false,
    dependencies: ["react-aria-components"],
    helperRegistryDependencies: ["types/theme", "constants/theme", "types/geometry", "constants/geometry"],
    directory: "",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "tree",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "Tree"
  // },
  {
    name: "triangle-frame-exclamation-icon",
    isIcon: true,
    file: "TriangleFrameExclamationIcon.tsx",
  },
  // - TODO: -> Uncomment and double check details once component is implemented
  // {
  //   name: "video-player",
  //   isIcon: false,
  //   dependencies: ["react-aria-components"],
  //   componentRegistryDependencies: [],
  //   helperRegistryDependencies: [""],
  //   directory: "VideoPlayer",
  // },
  {
    name: "x-icon",
    isIcon: true,
    file: "XIcon.tsx",
  },
];
