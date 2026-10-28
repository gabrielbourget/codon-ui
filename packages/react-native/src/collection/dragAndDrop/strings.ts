/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Pinned react-aria3.48.0 dnd locale data. */
import type { TNativeDragMessage } from "./messages"

export const nativeDragMessages: Record<string, Record<string, TNativeDragMessage>> = {
  "ar-AE": {
    dragDescriptionKeyboard: `\u{627}\u{636}\u{63A}\u{637} Enter \u{644}\u{628}\u{62F}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    dragDescriptionKeyboardAlt: `\u{627}\u{636}\u{63A}\u{637} \u{639}\u{644}\u{649} Alt + Enter \u{644}\u{628}\u{62F}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    dragDescriptionLongPress: `\u{627}\u{636}\u{63A}\u{637} \u{628}\u{627}\u{633}\u{62A}\u{645}\u{631}\u{627}\u{631} \u{644}\u{628}\u{62F}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    dragDescriptionTouch: `\u{627}\u{636}\u{63A}\u{637} \u{645}\u{631}\u{62A}\u{64A}\u{646} \u{644}\u{628}\u{62F}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    dragDescriptionVirtual: `\u{627}\u{646}\u{642}\u{631} \u{644}\u{628}\u{62F}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    dragItem: (args) => `\u{627}\u{633}\u{62D}\u{628} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{627}\u{633}\u{62D}\u{628} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{639}\u{646}\u{635}\u{631} \u{645}\u{62D}\u{62F}\u{62F}`,
        other: () =>
          `${formatter.number(args.count)} \u{639}\u{646}\u{627}\u{635}\u{631} \u{645}\u{62D}\u{62F}\u{62F}\u{629}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{627}\u{636}\u{63A}\u{637} \u{639}\u{644}\u{649} Enter \u{644}\u{644}\u{633}\u{62D}\u{628} ${formatter.plural(
        args.count,
        {
          one: `\u{639}\u{62F}\u{62F} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62E}\u{62A}\u{627}\u{631}\u{629}`,
          other: `\u{639}\u{62F}\u{62F} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62E}\u{62A}\u{627}\u{631}\u{629}`,
        },
      )}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{627}\u{636}\u{63A}\u{637} \u{639}\u{644}\u{649} \u{645}\u{641}\u{62A}\u{627}\u{62D}\u{64A} Alt + Enter \u{644}\u{644}\u{633}\u{62D}\u{628} ${formatter.plural(
        args.count,
        {
          one: `\u{639}\u{62F}\u{62F} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62E}\u{62A}\u{627}\u{631}\u{629}`,
          other: `\u{639}\u{62F}\u{62F} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62E}\u{62A}\u{627}\u{631}\u{629}`,
        },
      )}.`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{627}\u{636}\u{63A}\u{637} \u{628}\u{627}\u{633}\u{62A}\u{645}\u{631}\u{627}\u{631} \u{644}\u{644}\u{633}\u{62D}\u{628} ${formatter.plural(
        args.count,
        {
          one: `\u{639}\u{62F}\u{62F} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62E}\u{62A}\u{627}\u{631}\u{629}`,
          other: `\u{639}\u{62F}\u{62F} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62E}\u{62A}\u{627}\u{631}\u{629}`,
        },
      )}.`,
    dragStartedKeyboard: `\u{628}\u{62F}\u{623} \u{627}\u{644}\u{633}\u{62D}\u{628}. \u{627}\u{636}\u{63A}\u{637} Tab \u{644}\u{644}\u{627}\u{646}\u{62A}\u{642}\u{627}\u{644} \u{625}\u{644}\u{649} \u{645}\u{648}\u{636}\u{639} \u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}\u{60C} \u{62B}\u{645} \u{627}\u{636}\u{63A}\u{637} Enter \u{644}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}\u{60C} \u{623}\u{648} \u{627}\u{636}\u{63A}\u{637} Escape \u{644}\u{644}\u{625}\u{644}\u{63A}\u{627}\u{621}.`,
    dragStartedTouch: `\u{628}\u{62F}\u{623} \u{627}\u{644}\u{633}\u{62D}\u{628}. \u{627}\u{646}\u{62A}\u{642}\u{644} \u{625}\u{644}\u{649} \u{645}\u{648}\u{636}\u{639} \u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}\u{60C} \u{62B}\u{645} \u{627}\u{636}\u{63A}\u{637} \u{645}\u{631}\u{62A}\u{64A}\u{646} \u{644}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}.`,
    dragStartedVirtual: `\u{628}\u{62F}\u{623} \u{627}\u{644}\u{633}\u{62D}\u{628}. \u{627}\u{646}\u{62A}\u{642}\u{644} \u{625}\u{644}\u{649} \u{645}\u{643}\u{627}\u{646} \u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}\u{60C} \u{62B}\u{645} \u{627}\u{646}\u{642}\u{631} \u{623}\u{648} \u{627}\u{636}\u{63A}\u{637} Enter \u{644}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}.`,
    dropCanceled: `\u{62A}\u{645} \u{625}\u{644}\u{63A}\u{627}\u{621} \u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}.`,
    dropComplete: `\u{627}\u{643}\u{62A}\u{645}\u{644} \u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}.`,
    dropDescriptionKeyboard: `\u{627}\u{636}\u{63A}\u{637} Enter \u{644}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}. \u{627}\u{636}\u{63A}\u{637} Escape \u{644}\u{625}\u{644}\u{63A}\u{627}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    dropDescriptionTouch: `\u{627}\u{636}\u{63A}\u{637} \u{645}\u{631}\u{62A}\u{64A}\u{646} \u{644}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}.`,
    dropDescriptionVirtual: `\u{627}\u{646}\u{642}\u{631} \u{644}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}.`,
    dropIndicator: `\u{645}\u{624}\u{634}\u{631} \u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}`,
    dropOnItem: (args) => `\u{625}\u{641}\u{644}\u{627}\u{62A} ${args.itemText}`,
    dropOnRoot: `\u{627}\u{644}\u{625}\u{641}\u{644}\u{627}\u{62A}`,
    endDragKeyboard: `\u{627}\u{644}\u{633}\u{62D}\u{628}. \u{627}\u{636}\u{63A}\u{637} Enter \u{644}\u{625}\u{644}\u{63A}\u{627}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    endDragTouch: `\u{627}\u{644}\u{633}\u{62D}\u{628}. \u{627}\u{636}\u{63A}\u{637} \u{645}\u{631}\u{62A}\u{64A}\u{646} \u{644}\u{625}\u{644}\u{63A}\u{627}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    endDragVirtual: `\u{627}\u{644}\u{633}\u{62D}\u{628}. \u{627}\u{646}\u{642}\u{631} \u{644}\u{625}\u{644}\u{63A}\u{627}\u{621} \u{627}\u{644}\u{633}\u{62D}\u{628}.`,
    insertAfter: (args) => `\u{623}\u{62F}\u{62E}\u{644} \u{628}\u{639}\u{62F} ${args.itemText}`,
    insertBefore: (args) => `\u{623}\u{62F}\u{62E}\u{644} \u{642}\u{628}\u{644} ${args.itemText}`,
    insertBetween: (args) =>
      `\u{623}\u{62F}\u{62E}\u{644} \u{628}\u{64A}\u{646} ${args.beforeItemText} \u{648} ${args.afterItemText}`,
  },
  "bg-BG": {
    dragDescriptionKeyboard: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Enter\u{201C}, \u{437}\u{430} \u{434}\u{430} \u{437}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{442}\u{435}.`,
    dragDescriptionKeyboardAlt: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} Alt + Enter, \u{437}\u{430} \u{434}\u{430} \u{437}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{442}\u{435}.`,
    dragDescriptionLongPress: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{43F}\u{440}\u{43E}\u{434}\u{44A}\u{43B}\u{436}\u{438}\u{442}\u{435}\u{43B}\u{43D}\u{43E}, \u{437}\u{430} \u{434}\u{430} \u{437}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{442}\u{435}.`,
    dragDescriptionTouch: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{432}\u{443}\u{43A}\u{440}\u{430}\u{442}\u{43D}\u{43E}, \u{437}\u{430} \u{434}\u{430} \u{437}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{442}\u{435}.`,
    dragDescriptionVirtual: `\u{429}\u{440}\u{430}\u{43A}\u{43D}\u{435}\u{442}\u{435}, \u{437}\u{430} \u{434}\u{430} \u{437}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{442}\u{435}.`,
    dragItem: (args) => `\u{41F}\u{43B}\u{44A}\u{437}\u{43D}\u{438} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{41F}\u{43B}\u{44A}\u{437}\u{43D}\u{438} ${formatter.plural(args.count, {
        one: () =>
          `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
        other: () =>
          `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{430}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} Enter, \u{437}\u{430} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{43D}\u{435}\u{442}\u{435} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
          other: () =>
            `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
        },
      )}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} Alt \u{438} Enter, \u{437}\u{430} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{43D}\u{435}\u{442}\u{435} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
          other: () =>
            `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
        },
      )}.`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{43F}\u{440}\u{43E}\u{434}\u{44A}\u{43B}\u{436}\u{438}\u{442}\u{435}\u{43B}\u{43D}\u{43E}, \u{437}\u{430} \u{434}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{43D}\u{435}\u{442}\u{435} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
          other: () =>
            `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
        },
      )}.`,
    dragStartedKeyboard: `\u{417}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Tab\u{201C}, \u{437}\u{430} \u{434}\u{430} \u{441}\u{435} \u{43F}\u{440}\u{438}\u{434}\u{432}\u{438}\u{436}\u{438}\u{442}\u{435} \u{434}\u{43E} \u{446}\u{435}\u{43B}\u{442}\u{430}, \u{441}\u{43B}\u{435}\u{434} \u{43A}\u{43E}\u{435}\u{442}\u{43E} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Enter\u{201C} \u{437}\u{430} \u{43F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435} \u{438}\u{43B}\u{438} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Escape\u{201C} \u{437}\u{430} \u{43E}\u{442}\u{43C}\u{44F}\u{43D}\u{430}.`,
    dragStartedTouch: `\u{417}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}. \u{41F}\u{440}\u{438}\u{434}\u{432}\u{438}\u{436}\u{435}\u{442}\u{435} \u{441}\u{435} \u{434}\u{43E} \u{446}\u{435}\u{43B}\u{442}\u{430}, \u{441}\u{43B}\u{435}\u{434} \u{43A}\u{43E}\u{435}\u{442}\u{43E} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{432}\u{443}\u{43A}\u{440}\u{430}\u{442}\u{43D}\u{43E}, \u{437}\u{430} \u{434}\u{430} \u{43F}\u{443}\u{441}\u{43D}\u{435}\u{442}\u{435}.`,
    dragStartedVirtual: `\u{417}\u{430}\u{43F}\u{43E}\u{447}\u{43D}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}. \u{41F}\u{440}\u{438}\u{434}\u{432}\u{438}\u{436}\u{435}\u{442}\u{435} \u{441}\u{435} \u{434}\u{43E} \u{446}\u{435}\u{43B}\u{442}\u{430}, \u{441}\u{43B}\u{435}\u{434} \u{43A}\u{43E}\u{435}\u{442}\u{43E} \u{449}\u{440}\u{430}\u{43A}\u{43D}\u{435}\u{442}\u{435} \u{438}\u{43B}\u{438} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Enter\u{201C} \u{437}\u{430} \u{43F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}.`,
    dropCanceled: `\u{41F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}\u{442}\u{43E} \u{435} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{435}\u{43D}\u{43E}.`,
    dropComplete: `\u{41F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}\u{442}\u{43E} \u{435} \u{437}\u{430}\u{432}\u{44A}\u{440}\u{448}\u{435}\u{43D}\u{43E}.`,
    dropDescriptionKeyboard: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Enter\u{201C} \u{437}\u{430} \u{43F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Escape\u{201C} \u{437}\u{430} \u{43E}\u{442}\u{43C}\u{44F}\u{43D}\u{430} \u{43D}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}\u{442}\u{43E}.`,
    dropDescriptionTouch: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{432}\u{443}\u{43A}\u{440}\u{430}\u{442}\u{43D}\u{43E} \u{437}\u{430} \u{43F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}.`,
    dropDescriptionVirtual: `\u{429}\u{440}\u{430}\u{43A}\u{43D}\u{435}\u{442}\u{435} \u{437}\u{430} \u{43F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}.`,
    dropIndicator: `\u{438}\u{43D}\u{434}\u{438}\u{43A}\u{430}\u{442}\u{43E}\u{440} \u{437}\u{430} \u{43F}\u{443}\u{441}\u{43A}\u{430}\u{43D}\u{435}`,
    dropOnItem: (args) => `\u{41F}\u{443}\u{441}\u{43D}\u{438} \u{432}\u{44A}\u{440}\u{445}\u{443} ${args.itemText}`,
    dropOnRoot: `\u{41F}\u{443}\u{441}\u{43D}\u{438} \u{432}\u{44A}\u{440}\u{445}\u{443}`,
    endDragKeyboard: `\u{41F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{201E}Enter\u{201C} \u{437}\u{430} \u{43E}\u{442}\u{43C}\u{44F}\u{43D}\u{430} \u{43D}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}\u{442}\u{43E}.`,
    endDragTouch: `\u{41F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{434}\u{432}\u{443}\u{43A}\u{440}\u{430}\u{442}\u{43D}\u{43E} \u{437}\u{430} \u{43E}\u{442}\u{43C}\u{44F}\u{43D}\u{430} \u{43D}\u{430} \u{43F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}\u{442}\u{43E}.`,
    endDragVirtual: `\u{41F}\u{43B}\u{44A}\u{437}\u{433}\u{430}\u{43D}\u{435}. \u{429}\u{440}\u{430}\u{43A}\u{43D}\u{435}\u{442}\u{435} \u{437}\u{430} \u{43E}\u{442}\u{43C}\u{44F}\u{43D}\u{430}.`,
    insertAfter: (args) => `\u{412}\u{43C}\u{44A}\u{43A}\u{43D}\u{438} \u{441}\u{43B}\u{435}\u{434} ${args.itemText}`,
    insertBefore: (args) =>
      `\u{412}\u{43C}\u{44A}\u{43A}\u{43D}\u{438} \u{43F}\u{440}\u{435}\u{434}\u{438} ${args.itemText}`,
    insertBetween: (args) =>
      `\u{412}\u{43C}\u{44A}\u{43A}\u{43D}\u{438} \u{43C}\u{435}\u{436}\u{434}\u{443} ${args.beforeItemText} \u{438} ${args.afterItemText}`,
  },
  "cs-CZ": {
    dragDescriptionKeyboard: `Stisknut\xedm kl\xe1vesy Enter za\u{10D}nete s p\u{159}etahov\xe1n\xedm.`,
    dragDescriptionKeyboardAlt: `Stisknut\xedm Alt + Enter zah\xe1j\xedte p\u{159}etahov\xe1n\xed.`,
    dragDescriptionLongPress: `Dlouh\xfdm stisknut\xedm zah\xe1j\xedte p\u{159}etahov\xe1n\xed.`,
    dragDescriptionTouch: `Poklep\xe1n\xedm za\u{10D}nete s p\u{159}etahov\xe1n\xedm.`,
    dragDescriptionVirtual: `Kliknut\xedm za\u{10D}nete s p\u{159}etahov\xe1n\xedm.`,
    dragItem: (args) => `P\u{159}et\xe1hnout ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `P\u{159}et\xe1hnout ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybranou polo\u{17E}ku`,
        few: () => `${formatter.number(args.count)} vybran\xe9 polo\u{17E}ky`,
        other: () => `${formatter.number(args.count)} vybran\xfdch polo\u{17E}ek`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Stisknut\xedm kl\xe1vesy Enter p\u{159}et\xe1hn\u{11B}te ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybranou polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybran\xe9 polo\u{17E}ky`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Stisknut\xedm Alt + Enter p\u{159}et\xe1hn\u{11B}te ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybranou polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybran\xe9 polo\u{17E}ky`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Dlouh\xfdm stisknut\xedm p\u{159}et\xe1hnete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybranou polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybran\xe9 polo\u{17E}ky`,
      })}.`,
    dragStartedKeyboard: `Za\u{10D}n\u{11B}te s p\u{159}etahov\xe1n\xedm. Po stisknut\xed kl\xe1vesy Tab najd\u{11B}te po\u{17E}adovan\xfd c\xedl a stisknut\xedm kl\xe1vesy Enter p\u{159}eta\u{17E}en\xed dokon\u{10D}ete nebo stisknut\xedm kl\xe1vesy Esc akci zru\u{161}te.`,
    dragStartedTouch: `Za\u{10D}n\u{11B}te s p\u{159}etahov\xe1n\xedm. Najd\u{11B}te po\u{17E}adovan\xfd c\xedl a poklep\xe1n\xedm p\u{159}eta\u{17E}en\xed dokon\u{10D}ete.`,
    dragStartedVirtual: `Za\u{10D}n\u{11B}te s p\u{159}etahov\xe1n\xedm. Najd\u{11B}te po\u{17E}adovan\xfd c\xedl a kliknut\xedm nebo stisknut\xedm kl\xe1vesy Enter p\u{159}eta\u{17E}en\xed dokon\u{10D}ete.`,
    dropCanceled: `P\u{159}eta\u{17E}en\xed bylo zru\u{161}eno.`,
    dropComplete: `P\u{159}eta\u{17E}en\xed bylo dokon\u{10D}eno.`,
    dropDescriptionKeyboard: `Stisknut\xedm kl\xe1vesy Enter p\u{159}eta\u{17E}en\xed dokon\u{10D}ete nebo stisknut\xedm kl\xe1vesy Esc akci zru\u{161}te.`,
    dropDescriptionTouch: `Poklep\xe1n\xedm p\u{159}eta\u{17E}en\xed dokon\u{10D}ete.`,
    dropDescriptionVirtual: `Kliknut\xedm objekt p\u{159}et\xe1hn\u{11B}te.`,
    dropIndicator: `indik\xe1tor p\u{159}eta\u{17E}en\xed`,
    dropOnItem: (args) => `P\u{159}et\xe1hnout na ${args.itemText}`,
    dropOnRoot: `P\u{159}et\xe1hnout na`,
    endDragKeyboard: `Prob\xedh\xe1 p\u{159}etahov\xe1n\xed. Stisknut\xedm kl\xe1vesy Enter p\u{159}eta\u{17E}en\xed zru\u{161}\xedte.`,
    endDragTouch: `Prob\xedh\xe1 p\u{159}etahov\xe1n\xed. Poklep\xe1n\xedm p\u{159}eta\u{17E}en\xed zru\u{161}\xedte.`,
    endDragVirtual: `Prob\xedh\xe1 p\u{159}etahov\xe1n\xed. Kliknut\xedm p\u{159}eta\u{17E}en\xed zru\u{161}\xedte.`,
    insertAfter: (args) => `Vlo\u{17E}it za ${args.itemText}`,
    insertBefore: (args) => `Vlo\u{17E}it p\u{159}ed ${args.itemText}`,
    insertBetween: (args) => `Vlo\u{17E}it mezi ${args.beforeItemText} a ${args.afterItemText}`,
  },
  "da-DK": {
    dragDescriptionKeyboard: `Tryk p\xe5 Enter for at starte med at tr\xe6kke.`,
    dragDescriptionKeyboardAlt: `Tryk p\xe5 Alt + Enter for at starte med at tr\xe6kke.`,
    dragDescriptionLongPress: `Tryk l\xe6nge for at starte med at tr\xe6kke.`,
    dragDescriptionTouch: `Dobbelttryk for at starte med at tr\xe6kke.`,
    dragDescriptionVirtual: `Klik for at starte med at tr\xe6kke.`,
    dragItem: (args) => `Tr\xe6k ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Tr\xe6k ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgt element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Tryk p\xe5 Enter for at tr\xe6kke ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgte element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Tryk p\xe5 Alt + Enter for at tr\xe6kke ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgte element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Tryk l\xe6nge for at tr\xe6kke ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgte element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}.`,
    dragStartedKeyboard: `Startet med at tr\xe6kke. Tryk p\xe5 Tab for at g\xe5 til et slip-m\xe5l, tryk derefter p\xe5 Enter for at slippe, eller tryk p\xe5 Escape for at annullere.`,
    dragStartedTouch: `Startet med at tr\xe6kke. G\xe5 til et slip-m\xe5l, og dobbelttryk derefter for at slippe.`,
    dragStartedVirtual: `Startet med at tr\xe6kke. G\xe5 til et slip-m\xe5l, og klik eller tryk derefter p\xe5 enter for at slippe.`,
    dropCanceled: `Slip annulleret.`,
    dropComplete: `Slip fuldf\xf8rt.`,
    dropDescriptionKeyboard: `Tryk p\xe5 Enter for at slippe. Tryk p\xe5 Escape for at annullere tr\xe6kning.`,
    dropDescriptionTouch: `Dobbelttryk for at slippe.`,
    dropDescriptionVirtual: `Klik for at slippe.`,
    dropIndicator: `slip-indikator`,
    dropOnItem: (args) => `Slip p\xe5 ${args.itemText}`,
    dropOnRoot: `Slip p\xe5`,
    endDragKeyboard: `Tr\xe6kning. Tryk p\xe5 enter for at annullere tr\xe6k.`,
    endDragTouch: `Tr\xe6kning. Dobbelttryk for at annullere tr\xe6k.`,
    endDragVirtual: `Tr\xe6kning. Klik for at annullere tr\xe6kning.`,
    insertAfter: (args) => `Inds\xe6t efter ${args.itemText}`,
    insertBefore: (args) => `Inds\xe6t f\xf8r ${args.itemText}`,
    insertBetween: (args) => `Inds\xe6t mellem ${args.beforeItemText} og ${args.afterItemText}`,
  },
  "de-DE": {
    dragDescriptionKeyboard: `Dr\xfccken Sie die Eingabetaste, um den Ziehvorgang zu starten.`,
    dragDescriptionKeyboardAlt: `Alt + Eingabe dr\xfccken, um den Ziehvorgang zu starten.`,
    dragDescriptionLongPress: `Lang dr\xfccken, um mit dem Ziehen zu beginnen.`,
    dragDescriptionTouch: `Tippen Sie doppelt, um den Ziehvorgang zu starten.`,
    dragDescriptionVirtual: `Zum Starten des Ziehvorgangs klicken.`,
    dragItem: (args) => `${args.itemText} ziehen`,
    dragSelectedItems: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} ausgew\xe4hltes Objekt`,
        other: () => `${formatter.number(args.count)} ausgew\xe4hlte Objekte`,
      })} ziehen`,
    dragSelectedKeyboard: (args, formatter) =>
      `Eingabetaste dr\xfccken, um ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} ausgew\xe4hltes Element`,
        other: () => `${formatter.number(args.count)} ausgew\xe4hlte Elemente`,
      })} zu ziehen.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Alt + Eingabetaste dr\xfccken, um ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} ausgew\xe4hltes Element`,
        other: () => `${formatter.number(args.count)} ausgew\xe4hlte Elemente`,
      })} zu ziehen.`,
    dragSelectedLongPress: (args, formatter) =>
      `Lang dr\xfccken, um ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} ausgew\xe4hltes Element`,
        other: () => `${formatter.number(args.count)} ausgew\xe4hlte Elemente`,
      })} zu ziehen.`,
    dragStartedKeyboard: `Ziehvorgang gestartet. Dr\xfccken Sie die Tabulatortaste, um zu einem Ablegeziel zu navigieren und dr\xfccken Sie dann die Eingabetaste, um das Objekt abzulegen, oder Escape, um den Vorgang abzubrechen.`,
    dragStartedTouch: `Ziehvorgang gestartet. Navigieren Sie zu einem Ablegeziel und tippen Sie doppelt, um das Objekt abzulegen.`,
    dragStartedVirtual: `Ziehvorgang gestartet. Navigieren Sie zu einem Ablegeziel und klicken Sie oder dr\xfccken Sie die Eingabetaste, um das Objekt abzulegen.`,
    dropCanceled: `Ablegen abgebrochen.`,
    dropComplete: `Ablegen abgeschlossen.`,
    dropDescriptionKeyboard: `Dr\xfccken Sie die Eingabetaste, um das Objekt abzulegen. Dr\xfccken Sie Escape, um den Vorgang abzubrechen.`,
    dropDescriptionTouch: `Tippen Sie doppelt, um das Objekt abzulegen.`,
    dropDescriptionVirtual: `Zum Ablegen klicken.`,
    dropIndicator: `Ablegeanzeiger`,
    dropOnItem: (args) => `Auf ${args.itemText} ablegen`,
    dropOnRoot: `Ablegen auf`,
    endDragKeyboard: `Ziehvorgang l\xe4uft. Dr\xfccken Sie die Eingabetaste, um den Vorgang abzubrechen.`,
    endDragTouch: `Ziehvorgang l\xe4uft. Tippen Sie doppelt, um den Vorgang abzubrechen.`,
    endDragVirtual: `Ziehvorgang l\xe4uft. Klicken Sie, um den Vorgang abzubrechen.`,
    insertAfter: (args) => `Nach ${args.itemText} einf\xfcgen`,
    insertBefore: (args) => `Vor ${args.itemText} einf\xfcgen`,
    insertBetween: (args) => `Zwischen ${args.beforeItemText} und ${args.afterItemText} einf\xfcgen`,
  },
  "el-GR": {
    dragDescriptionKeyboard: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Enter \u{3B3}\u{3B9}\u{3B1} \u{3AD}\u{3BD}\u{3B1}\u{3C1}\u{3BE}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    dragDescriptionKeyboardAlt: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Alt + Enter \u{3B3}\u{3B9}\u{3B1} \u{3AD}\u{3BD}\u{3B1}\u{3C1}\u{3BE}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    dragDescriptionLongPress: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3C0}\u{3B1}\u{3C1}\u{3B1}\u{3C4}\u{3B5}\u{3C4}\u{3B1}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3BE}\u{3B5}\u{3BA}\u{3B9}\u{3BD}\u{3AE}\u{3C3}\u{3B5}\u{3C4}\u{3B5} \u{3C4}\u{3B7} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}.`,
    dragDescriptionTouch: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3B4}\u{3CD}\u{3BF} \u{3C6}\u{3BF}\u{3C1}\u{3AD}\u{3C2} \u{3B3}\u{3B9}\u{3B1} \u{3AD}\u{3BD}\u{3B1}\u{3C1}\u{3BE}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    dragDescriptionVirtual: `\u{39A}\u{3AC}\u{3BD}\u{3C4}\u{3B5} \u{3BA}\u{3BB}\u{3B9}\u{3BA} \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3BE}\u{3B5}\u{3BA}\u{3B9}\u{3BD}\u{3AE}\u{3C3}\u{3B5}\u{3C4}\u{3B5} \u{3C4}\u{3B7} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}.`,
    dragItem: (args) => `\u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3C3}\u{3B5} ${formatter.plural(args.count, {
        one: () =>
          `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF}`,
        other: () =>
          `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Enter \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3C3}\u{3CD}\u{3C1}\u{3B5}\u{3C4}\u{3B5} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF}`,
          other: () =>
            `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
        },
      )}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Alt + Enter \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3C3}\u{3CD}\u{3C1}\u{3B5}\u{3C4}\u{3B5} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF}`,
          other: () =>
            `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
        },
      )}.`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3C0}\u{3B1}\u{3C1}\u{3B1}\u{3C4}\u{3B5}\u{3C4}\u{3B1}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3C3}\u{3CD}\u{3C1}\u{3B5}\u{3C4}\u{3B5} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF}`,
          other: () =>
            `${formatter.number(args.count)} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3B5}\u{3B3}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
        },
      )}.`,
    dragStartedKeyboard: `\u{397} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3BE}\u{3B5}\u{3BA}\u{3AF}\u{3BD}\u{3B7}\u{3C3}\u{3B5}. \u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3C4}\u{3BF} \u{3C0}\u{3BB}\u{3AE}\u{3BA}\u{3C4}\u{3C1}\u{3BF} Tab \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3B2}\u{3B5}\u{3AF}\u{3C4}\u{3B5} \u{3C3}\u{3B5} \u{3AD}\u{3BD}\u{3B1}\u{3BD} \u{3C0}\u{3C1}\u{3BF}\u{3BF}\u{3C1}\u{3B9}\u{3C3}\u{3BC}\u{3CC} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}\u{3C2} \u{3BA}\u{3B1}\u{3B9}, \u{3C3}\u{3C4}\u{3B7} \u{3C3}\u{3C5}\u{3BD}\u{3AD}\u{3C7}\u{3B5}\u{3B9}\u{3B1}, \u{3C0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Enter \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7} \u{3AE} \u{3C0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Escape \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3BA}\u{3CD}\u{3C1}\u{3C9}\u{3C3}\u{3B7}.`,
    dragStartedTouch: `\u{397} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3BE}\u{3B5}\u{3BA}\u{3AF}\u{3BD}\u{3B7}\u{3C3}\u{3B5}. \u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3B2}\u{3B5}\u{3AF}\u{3C4}\u{3B5} \u{3C3}\u{3B5} \u{3AD}\u{3BD}\u{3B1}\u{3BD} \u{3C0}\u{3C1}\u{3BF}\u{3BF}\u{3C1}\u{3B9}\u{3C3}\u{3BC}\u{3CC} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}\u{3C2} \u{3BA}\u{3B1}\u{3B9}, \u{3C3}\u{3C4}\u{3B7} \u{3C3}\u{3C5}\u{3BD}\u{3AD}\u{3C7}\u{3B5}\u{3B9}\u{3B1}, \u{3C0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3B4}\u{3CD}\u{3BF} \u{3C6}\u{3BF}\u{3C1}\u{3AD}\u{3C2} \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}.`,
    dragStartedVirtual: `\u{397} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3BE}\u{3B5}\u{3BA}\u{3AF}\u{3BD}\u{3B7}\u{3C3}\u{3B5}. \u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3B2}\u{3B5}\u{3AF}\u{3C4}\u{3B5} \u{3C3}\u{3B5} \u{3AD}\u{3BD}\u{3B1}\u{3BD} \u{3C0}\u{3C1}\u{3BF}\u{3BF}\u{3C1}\u{3B9}\u{3C3}\u{3BC}\u{3CC} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}\u{3C2} \u{3BA}\u{3B1}\u{3B9}, \u{3C3}\u{3C4}\u{3B7} \u{3C3}\u{3C5}\u{3BD}\u{3AD}\u{3C7}\u{3B5}\u{3B9}\u{3B1}, \u{3BA}\u{3AC}\u{3BD}\u{3C4}\u{3B5} \u{3BA}\u{3BB}\u{3B9}\u{3BA} \u{3AE} \u{3C0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Enter \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}.`,
    dropCanceled: `\u{397} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7} \u{3B1}\u{3BA}\u{3C5}\u{3C1}\u{3CE}\u{3B8}\u{3B7}\u{3BA}\u{3B5}.`,
    dropComplete: `\u{397} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7} \u{3BF}\u{3BB}\u{3BF}\u{3BA}\u{3BB}\u{3B7}\u{3C1}\u{3CE}\u{3B8}\u{3B7}\u{3BA}\u{3B5}.`,
    dropDescriptionKeyboard: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Enter \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}. \u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Escape \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3BA}\u{3CD}\u{3C1}\u{3C9}\u{3C3}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    dropDescriptionTouch: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3B4}\u{3CD}\u{3BF} \u{3C6}\u{3BF}\u{3C1}\u{3AD}\u{3C2} \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}.`,
    dropDescriptionVirtual: `\u{39A}\u{3AC}\u{3BD}\u{3C4}\u{3B5} \u{3BA}\u{3BB}\u{3B9}\u{3BA} \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}.`,
    dropIndicator: `\u{3B4}\u{3B5}\u{3AF}\u{3BA}\u{3C4}\u{3B7}\u{3C2} \u{3B1}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7}\u{3C2}`,
    dropOnItem: (args) => `\u{391}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7} \u{3C3}\u{3B5} ${args.itemText}`,
    dropOnRoot: `\u{391}\u{3C0}\u{3CC}\u{3B8}\u{3B5}\u{3C3}\u{3B7} \u{3C3}\u{3B5}`,
    endDragKeyboard: `\u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3C3}\u{3B5} \u{3B5}\u{3BE}\u{3AD}\u{3BB}\u{3B9}\u{3BE}\u{3B7}. \u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} Enter \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3BA}\u{3CD}\u{3C1}\u{3C9}\u{3C3}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    endDragTouch: `\u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3C3}\u{3B5} \u{3B5}\u{3BE}\u{3AD}\u{3BB}\u{3B9}\u{3BE}\u{3B7}. \u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3B4}\u{3CD}\u{3BF} \u{3C6}\u{3BF}\u{3C1}\u{3AD}\u{3C2} \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3BA}\u{3CD}\u{3C1}\u{3C9}\u{3C3}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    endDragVirtual: `\u{39C}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC} \u{3C3}\u{3B5} \u{3B5}\u{3BE}\u{3AD}\u{3BB}\u{3B9}\u{3BE}\u{3B7}. \u{39A}\u{3AC}\u{3BD}\u{3C4}\u{3B5} \u{3BA}\u{3BB}\u{3B9}\u{3BA} \u{3B3}\u{3B9}\u{3B1} \u{3B1}\u{3BA}\u{3CD}\u{3C1}\u{3C9}\u{3C3}\u{3B7} \u{3C4}\u{3B7}\u{3C2} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3C6}\u{3BF}\u{3C1}\u{3AC}\u{3C2}.`,
    insertAfter: (args) =>
      `\u{395}\u{3B9}\u{3C3}\u{3B1}\u{3B3}\u{3C9}\u{3B3}\u{3AE} \u{3BC}\u{3B5}\u{3C4}\u{3AC} \u{3B1}\u{3C0}\u{3CC} ${args.itemText}`,
    insertBefore: (args) =>
      `\u{395}\u{3B9}\u{3C3}\u{3B1}\u{3B3}\u{3C9}\u{3B3}\u{3AE} \u{3C0}\u{3C1}\u{3B9}\u{3BD} \u{3B1}\u{3C0}\u{3CC} ${args.itemText}`,
    insertBetween: (args) =>
      `\u{395}\u{3B9}\u{3C3}\u{3B1}\u{3B3}\u{3C9}\u{3B3}\u{3AE} \u{3BC}\u{3B5}\u{3C4}\u{3B1}\u{3BE}\u{3CD} ${args.beforeItemText} \u{3BA}\u{3B1}\u{3B9} ${args.afterItemText}`,
  },
  "en-US": {
    dragItem: (args) => `Drag ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Drag ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} selected item`,
        other: () => `${formatter.number(args.count)} selected items`,
      })}`,
    dragDescriptionKeyboard: `Press Enter to start dragging.`,
    dragDescriptionKeyboardAlt: `Press Alt + Enter to start dragging.`,
    dragDescriptionTouch: `Double tap to start dragging.`,
    dragDescriptionVirtual: `Click to start dragging.`,
    dragDescriptionLongPress: `Long press to start dragging.`,
    dragSelectedKeyboard: (args, formatter) =>
      `Press Enter to drag ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} selected item`,
        other: () => `${formatter.number(args.count)} selected items`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Press Alt + Enter to drag ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} selected item`,
        other: () => `${formatter.number(args.count)} selected items`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Long press to drag ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} selected item`,
        other: () => `${formatter.number(args.count)} selected items`,
      })}.`,
    dragStartedKeyboard: `Started dragging. Press Tab to navigate to a drop target, then press Enter to drop, or press Escape to cancel.`,
    dragStartedTouch: `Started dragging. Navigate to a drop target, then double tap to drop.`,
    dragStartedVirtual: `Started dragging. Navigate to a drop target, then click or press Enter to drop.`,
    endDragKeyboard: `Dragging. Press Enter to cancel drag.`,
    endDragTouch: `Dragging. Double tap to cancel drag.`,
    endDragVirtual: `Dragging. Click to cancel drag.`,
    dropDescriptionKeyboard: `Press Enter to drop. Press Escape to cancel drag.`,
    dropDescriptionTouch: `Double tap to drop.`,
    dropDescriptionVirtual: `Click to drop.`,
    dropCanceled: `Drop canceled.`,
    dropComplete: `Drop complete.`,
    dropIndicator: `drop indicator`,
    dropOnRoot: `Drop on`,
    dropOnItem: (args) => `Drop on ${args.itemText}`,
    insertBefore: (args) => `Insert before ${args.itemText}`,
    insertBetween: (args) => `Insert between ${args.beforeItemText} and ${args.afterItemText}`,
    insertAfter: (args) => `Insert after ${args.itemText}`,
  },
  "es-ES": {
    dragDescriptionKeyboard: `Pulse Intro para empezar a arrastrar.`,
    dragDescriptionKeyboardAlt: `Pulse Intro para empezar a arrastrar.`,
    dragDescriptionLongPress: `Mantenga pulsado para comenzar a arrastrar.`,
    dragDescriptionTouch: `Pulse dos veces para iniciar el arrastre.`,
    dragDescriptionVirtual: `Haga clic para iniciar el arrastre.`,
    dragItem: (args) => `Arrastrar ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Arrastrar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento seleccionado`,
        other: () => `${formatter.number(args.count)} elementos seleccionados`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Pulse Intro para arrastrar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento seleccionado`,
        other: () => `${formatter.number(args.count)} elementos seleccionados`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Pulse Alt + Intro para arrastrar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento seleccionado`,
        other: () => `${formatter.number(args.count)} elementos seleccionados`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Mantenga pulsado para arrastrar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento seleccionado`,
        other: () => `${formatter.number(args.count)} elementos seleccionados`,
      })}.`,
    dragStartedKeyboard: `Se ha empezado a arrastrar. Pulse el tabulador para ir al destino donde se vaya a colocar y, a continuaci\xf3n, pulse Intro para soltar, o pulse Escape para cancelar.`,
    dragStartedTouch: `Se ha empezado a arrastrar. Vaya al destino donde se vaya a colocar y, a continuaci\xf3n, pulse dos veces para soltar.`,
    dragStartedVirtual: `Se ha empezado a arrastrar. Vaya al destino donde se vaya a colocar y, a continuaci\xf3n, haga clic o pulse Intro para soltar.`,
    dropCanceled: `Se ha cancelado la colocaci\xf3n.`,
    dropComplete: `Colocaci\xf3n finalizada.`,
    dropDescriptionKeyboard: `Pulse Intro para soltar. Pulse Escape para cancelar el arrastre.`,
    dropDescriptionTouch: `Pulse dos veces para soltar.`,
    dropDescriptionVirtual: `Haga clic para soltar.`,
    dropIndicator: `indicador de colocaci\xf3n`,
    dropOnItem: (args) => `Soltar en ${args.itemText}`,
    dropOnRoot: `Soltar en`,
    endDragKeyboard: `Arrastrando. Pulse Intro para cancelar el arrastre.`,
    endDragTouch: `Arrastrando. Pulse dos veces para cancelar el arrastre.`,
    endDragVirtual: `Arrastrando. Haga clic para cancelar el arrastre.`,
    insertAfter: (args) => `Insertar despu\xe9s de ${args.itemText}`,
    insertBefore: (args) => `Insertar antes de ${args.itemText}`,
    insertBetween: (args) => `Insertar entre ${args.beforeItemText} y ${args.afterItemText}`,
  },
  "et-EE": {
    dragDescriptionKeyboard: `Lohistamise alustamiseks vajutage klahvi Enter.`,
    dragDescriptionKeyboardAlt: `Lohistamise alustamiseks vajutage klahvikombinatsiooni Alt + Enter.`,
    dragDescriptionLongPress: `Vajutage pikalt lohistamise alustamiseks.`,
    dragDescriptionTouch: `Topeltpuudutage lohistamise alustamiseks.`,
    dragDescriptionVirtual: `Kl\xf5psake lohistamise alustamiseks.`,
    dragItem: (args) => `Lohista ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Lohista ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valitud \xfcksust`,
        other: () => `${formatter.number(args.count)} valitud \xfcksust`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valitud \xfcksuse`,
        other: () => `${formatter.number(args.count)} valitud \xfcksuse`,
      })} lohistamiseks vajutage sisestusklahvi Enter.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Lohistamiseks vajutage klahvikombinatsiooni Alt + Enter ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valitud \xfcksuse`,
        other: () => `${formatter.number(args.count)} valitud \xfcksuse`,
      })} jaoks.`,
    dragSelectedLongPress: (args, formatter) =>
      `Pikk vajutus ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valitud \xfcksuse`,
        other: () => `${formatter.number(args.count)} valitud \xfcksuse`,
      })} lohistamiseks.`,
    dragStartedKeyboard: `Alustati lohistamist. Kukutamise sihtm\xe4rgi juurde navigeerimiseks vajutage klahvi Tab, seej\xe4rel vajutage kukutamiseks klahvi Enter v\xf5i loobumiseks klahvi Escape.`,
    dragStartedTouch: `Alustati lohistamist. Navigeerige kukutamise sihtm\xe4rgi juurde ja topeltpuudutage kukutamiseks.`,
    dragStartedVirtual: `Alustati lohistamist. Navigeerige kukutamise sihtm\xe4rgi juurde ja kukutamiseks kl\xf5psake v\xf5i vajutage klahvi Enter.`,
    dropCanceled: `Lohistamisest loobuti.`,
    dropComplete: `Lohistamine on tehtud.`,
    dropDescriptionKeyboard: `Kukutamiseks vajutage klahvi Enter. Lohistamisest loobumiseks vajutage klahvi Escape.`,
    dropDescriptionTouch: `Kukutamiseks topeltpuudutage.`,
    dropDescriptionVirtual: `Kukutamiseks kl\xf5psake.`,
    dropIndicator: `lohistamise indikaator`,
    dropOnItem: (args) => `Kukuta asukohta ${args.itemText}`,
    dropOnRoot: `Kukuta asukohta`,
    endDragKeyboard: `Lohistamine. Lohistamisest loobumiseks vajutage klahvi Enter.`,
    endDragTouch: `Lohistamine. Lohistamisest loobumiseks topeltpuudutage.`,
    endDragVirtual: `Lohistamine. Lohistamisest loobumiseks kl\xf5psake.`,
    insertAfter: (args) => `Sisesta ${args.itemText} j\xe4rele`,
    insertBefore: (args) => `Sisesta ${args.itemText} ette`,
    insertBetween: (args) => `Sisesta ${args.beforeItemText} ja ${args.afterItemText} vahele`,
  },
  "fi-FI": {
    dragDescriptionKeyboard: `Aloita vet\xe4minen painamalla Enter-n\xe4pp\xe4int\xe4.`,
    dragDescriptionKeyboardAlt: `Aloita vet\xe4minen painamalla Alt + Enter -n\xe4pp\xe4inyhdistelm\xe4\xe4.`,
    dragDescriptionLongPress: `Aloita vet\xe4minen pit\xe4m\xe4ll\xe4 painettuna.`,
    dragDescriptionTouch: `Aloita vet\xe4minen kaksoisnapauttamalla.`,
    dragDescriptionVirtual: `Aloita vet\xe4minen napsauttamalla.`,
    dragItem: (args) => `Ved\xe4 kohdetta ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Ved\xe4 ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valittua kohdetta`,
        other: () => `${formatter.number(args.count)} valittua kohdetta`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Ved\xe4 painamalla Enter ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valittu kohde`,
        other: () => `${formatter.number(args.count)} valittua kohdetta`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Ved\xe4 painamalla Alt + Enter ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valittu kohde`,
        other: () => `${formatter.number(args.count)} valittua kohdetta`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Ved\xe4 pit\xe4m\xe4ll\xe4 painettuna ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valittu kohde`,
        other: () => `${formatter.number(args.count)} valittua kohdetta`,
      })}.`,
    dragStartedKeyboard: `Vet\xe4minen aloitettu. Siirry pudotuskohteeseen painamalla sarkainn\xe4pp\xe4int\xe4 ja sitten pudota painamalla Enter-n\xe4pp\xe4int\xe4 tai peruuta painamalla Escape-n\xe4pp\xe4int\xe4.`,
    dragStartedTouch: `Vet\xe4minen aloitettu. Siirry pudotuskohteeseen ja pudota kaksoisnapauttamalla.`,
    dragStartedVirtual: `Vet\xe4minen aloitettu. Siirry pudotuskohteeseen ja pudota napsauttamalla tai painamalla Enter-n\xe4pp\xe4int\xe4.`,
    dropCanceled: `Pudotus peruutettu.`,
    dropComplete: `Pudotus suoritettu.`,
    dropDescriptionKeyboard: `Pudota painamalla Enter-n\xe4pp\xe4int\xe4. Peruuta vet\xe4minen painamalla Escape-n\xe4pp\xe4int\xe4.`,
    dropDescriptionTouch: `Pudota kaksoisnapauttamalla.`,
    dropDescriptionVirtual: `Pudota napsauttamalla.`,
    dropIndicator: `pudotuksen ilmaisin`,
    dropOnItem: (args) => `Pudota kohteeseen ${args.itemText}`,
    dropOnRoot: `Pudota kohteeseen`,
    endDragKeyboard: `Vedet\xe4\xe4n. Peruuta vet\xe4minen painamalla Enter-n\xe4pp\xe4int\xe4.`,
    endDragTouch: `Vedet\xe4\xe4n. Peruuta vet\xe4minen kaksoisnapauttamalla.`,
    endDragVirtual: `Vedet\xe4\xe4n. Peruuta vet\xe4minen napsauttamalla.`,
    insertAfter: (args) => `Lis\xe4\xe4 kohteen ${args.itemText} j\xe4lkeen`,
    insertBefore: (args) => `Lis\xe4\xe4 ennen kohdetta ${args.itemText}`,
    insertBetween: (args) => `Lis\xe4\xe4 kohteiden ${args.beforeItemText} ja ${args.afterItemText} v\xe4liin`,
  },
  "fr-FR": {
    dragDescriptionKeyboard: `Appuyez sur Entr\xe9e pour commencer le d\xe9placement.`,
    dragDescriptionKeyboardAlt: `Appuyez sur Alt\xa0+\xa0Entr\xe9e pour commencer \xe0 faire glisser.`,
    dragDescriptionLongPress: `Appuyez de mani\xe8re prolong\xe9e pour commencer \xe0 faire glisser.`,
    dragDescriptionTouch: `Touchez deux fois pour commencer le d\xe9placement.`,
    dragDescriptionVirtual: `Cliquez pour commencer le d\xe9placement.`,
    dragItem: (args) => `D\xe9placer ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `D\xe9placer ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \xe9l\xe9ment s\xe9lectionn\xe9`,
        other: () => `${formatter.number(args.count)} \xe9l\xe9ments s\xe9lectionn\xe9s`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Appuyez sur Entr\xe9e pour faire glisser ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \xe9l\xe9ment s\xe9lectionn\xe9`,
        other: () => `${formatter.number(args.count)} \xe9l\xe9ments s\xe9lectionn\xe9s`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Appuyez sur Alt\xa0+\xa0Entr\xe9e pour faire glisser ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \xe9l\xe9ment s\xe9lectionn\xe9`,
        other: () => `${formatter.number(args.count)} \xe9l\xe9ments s\xe9lectionn\xe9s`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Appuyez de mani\xe8re prolong\xe9e pour faire glisser ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \xe9l\xe9ment s\xe9lectionn\xe9`,
        other: () => `${formatter.number(args.count)} \xe9l\xe9ments s\xe9lectionn\xe9s`,
      })}.`,
    dragStartedKeyboard: `D\xe9placement commenc\xe9. Appuyez sur Tabulation pour acc\xe9der \xe0 une cible de d\xe9p\xf4t, puis appuyez sur Entr\xe9e pour d\xe9poser, ou appuyez sur \xc9chap pour annuler.`,
    dragStartedTouch: `D\xe9placement commenc\xe9. Acc\xe9dez \xe0 une cible de d\xe9p\xf4t, puis touchez deux fois pour d\xe9poser.`,
    dragStartedVirtual: `D\xe9placement commenc\xe9. Acc\xe9dez \xe0 une cible de d\xe9p\xf4t, puis cliquez ou appuyez sur Entr\xe9e pour d\xe9poser.`,
    dropCanceled: `D\xe9p\xf4t annul\xe9.`,
    dropComplete: `D\xe9p\xf4t termin\xe9.`,
    dropDescriptionKeyboard: `Appuyez sur Entr\xe9e pour d\xe9poser. Appuyez sur \xc9chap pour annuler le d\xe9placement.`,
    dropDescriptionTouch: `Touchez deux fois pour d\xe9poser.`,
    dropDescriptionVirtual: `Cliquez pour d\xe9poser.`,
    dropIndicator: `indicateur de d\xe9p\xf4t`,
    dropOnItem: (args) => `D\xe9poser sur ${args.itemText}`,
    dropOnRoot: `D\xe9poser sur`,
    endDragKeyboard: `D\xe9placement. Appuyez sur Entr\xe9e pour annuler le d\xe9placement.`,
    endDragTouch: `D\xe9placement. Touchez deux fois pour annuler le d\xe9placement.`,
    endDragVirtual: `D\xe9placement. Cliquez pour annuler le d\xe9placement.`,
    insertAfter: (args) => `Ins\xe9rer apr\xe8s ${args.itemText}`,
    insertBefore: (args) => `Ins\xe9rer avant ${args.itemText}`,
    insertBetween: (args) => `Ins\xe9rer entre ${args.beforeItemText} et ${args.afterItemText}`,
  },
  "he-IL": {
    dragDescriptionKeyboard: `\u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D4}\u{5EA}\u{5D7}\u{5D9}\u{5DC} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}.`,
    dragDescriptionKeyboardAlt: `\u{5D4}\u{5E7}\u{5E9} Alt + Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D4}\u{5EA}\u{5D7}\u{5D9}\u{5DC} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}.`,
    dragDescriptionLongPress: `\u{5DC}\u{5D7}\u{5E5} \u{5DC}\u{5D7}\u{5D9}\u{5E6}\u{5D4} \u{5D0}\u{5E8}\u{5D5}\u{5DB}\u{5D4} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D4}\u{5EA}\u{5D7}\u{5D9}\u{5DC} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}.`,
    dragDescriptionTouch: `\u{5D4}\u{5E7}\u{5E9} \u{5E4}\u{5E2}\u{5DE}\u{5D9}\u{5D9}\u{5DD} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D4}\u{5EA}\u{5D7}\u{5D9}\u{5DC} \u{5D1}\u{5D2}\u{5E8}\u{5D9}\u{5E8}\u{5D4}.`,
    dragDescriptionVirtual: `\u{5DC}\u{5D7}\u{5E5} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D4}\u{5EA}\u{5D7}\u{5D9}\u{5DC} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}.`,
    dragItem: (args) => `\u{5D2}\u{5E8}\u{5D5}\u{5E8} \u{5D0}\u{5EA} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{5D2}\u{5E8}\u{5D5}\u{5E8} ${formatter.plural(args.count, {
        one: () => `\u{5E4}\u{5E8}\u{5D9}\u{5D8} \u{5E0}\u{5D1}\u{5D7}\u{5E8} ${formatter.number(args.count)}`,
        other: () =>
          `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8} ${formatter.plural(
        args.count,
        {
          one: () => `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}`,
          other: () =>
            `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}`,
        },
      )}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{5D4}\u{5E7}\u{5E9} Alt + Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8} ${formatter.plural(
        args.count,
        {
          one: () => `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}`,
          other: () =>
            `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}`,
        },
      )}.`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{5DC}\u{5D7}\u{5E5} \u{5DC}\u{5D7}\u{5D9}\u{5E6}\u{5D4} \u{5D0}\u{5E8}\u{5D5}\u{5DB}\u{5D4} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8} ${formatter.plural(
        args.count,
        {
          one: () => `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}`,
          other: () =>
            `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E9}\u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}`,
        },
      )}.`,
    dragStartedKeyboard: `\u{5D4}\u{5EA}\u{5D7}\u{5DC}\u{5EA} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}. \u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Tab \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E0}\u{5D5}\u{5D5}\u{5D8} \u{5DC}\u{5E0}\u{5E7}\u{5D5}\u{5D3}\u{5EA} \u{5D4}\u{5D2}\u{5E8}\u{5D9}\u{5E8}\u{5D4} \u{5D5}\u{5DC}\u{5D0}\u{5D7}\u{5E8} \u{5DE}\u{5DB}\u{5DF} \u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E9}\u{5D7}\u{5E8}\u{5E8} \u{5D0}\u{5D5} \u{5E2}\u{5DC} Escape \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D1}\u{5D8}\u{5DC}.`,
    dragStartedTouch: `\u{5D4}\u{5EA}\u{5D7}\u{5DC}\u{5EA} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}. \u{5E0}\u{5D5}\u{5D5}\u{5D8} \u{5DC}\u{5E0}\u{5E7}\u{5D5}\u{5D3}\u{5EA} \u{5D4}\u{5E9}\u{5D7}\u{5E8}\u{5D5}\u{5E8} \u{5D5}\u{5DC}\u{5D0}\u{5D7}\u{5E8} \u{5DE}\u{5DB}\u{5DF} \u{5D4}\u{5E7}\u{5E9} \u{5E4}\u{5E2}\u{5DE}\u{5D9}\u{5D9}\u{5DD} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E9}\u{5D7}\u{5E8}\u{5E8}.`,
    dragStartedVirtual: `\u{5D4}\u{5EA}\u{5D7}\u{5DC}\u{5EA} \u{5DC}\u{5D2}\u{5E8}\u{5D5}\u{5E8}. \u{5E0}\u{5D5}\u{5D5}\u{5D8} \u{5DC}\u{5E0}\u{5E7}\u{5D5}\u{5D3}\u{5EA} \u{5D4}\u{5E9}\u{5D7}\u{5E8}\u{5D5}\u{5E8} \u{5D5}\u{5DC}\u{5D0}\u{5D7}\u{5E8} \u{5DE}\u{5DB}\u{5DF} \u{5DC}\u{5D7}\u{5E5} \u{5D0}\u{5D5} \u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E9}\u{5D7}\u{5E8}\u{5E8}.`,
    dropCanceled: `\u{5D4}\u{5E9}\u{5D7}\u{5E8}\u{5D5}\u{5E8} \u{5D1}\u{5D5}\u{5D8}\u{5DC}.`,
    dropComplete: `\u{5D4}\u{5E9}\u{5D7}\u{5E8}\u{5D5}\u{5E8} \u{5D4}\u{5D5}\u{5E9}\u{5DC}\u{5DD}.`,
    dropDescriptionKeyboard: `\u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E9}\u{5D7}\u{5E8}\u{5E8}. \u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Escape \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D1}\u{5D8}\u{5DC} \u{5D0}\u{5EA} \u{5D4}\u{5D2}\u{5E8}\u{5D9}\u{5E8}\u{5D4}.`,
    dropDescriptionTouch: `\u{5D4}\u{5E7}\u{5E9} \u{5E4}\u{5E2}\u{5DE}\u{5D9}\u{5D9}\u{5DD} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E9}\u{5D7}\u{5E8}\u{5E8}.`,
    dropDescriptionVirtual: `\u{5DC}\u{5D7}\u{5E5} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5E9}\u{5D7}\u{5E8}\u{5E8}.`,
    dropIndicator: `\u{5DE}\u{5D7}\u{5D5}\u{5D5}\u{5DF} \u{5E9}\u{5D7}\u{5E8}\u{5D5}\u{5E8}`,
    dropOnItem: (args) => `\u{5E9}\u{5D7}\u{5E8}\u{5E8} \u{5E2}\u{5DC} ${args.itemText}`,
    dropOnRoot: `\u{5E9}\u{5D7}\u{5E8}\u{5E8} \u{5E2}\u{5DC}`,
    endDragKeyboard: `\u{5D2}\u{5D5}\u{5E8}\u{5E8}. \u{5D4}\u{5E7}\u{5E9} \u{5E2}\u{5DC} Enter \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D1}\u{5D8}\u{5DC} \u{5D0}\u{5EA} \u{5D4}\u{5D2}\u{5E8}\u{5D9}\u{5E8}\u{5D4}.`,
    endDragTouch: `\u{5D2}\u{5D5}\u{5E8}\u{5E8}. \u{5D4}\u{5E7}\u{5E9} \u{5E4}\u{5E2}\u{5DE}\u{5D9}\u{5D9}\u{5DD} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D1}\u{5D8}\u{5DC} \u{5D0}\u{5EA} \u{5D4}\u{5D2}\u{5E8}\u{5D9}\u{5E8}\u{5D4}.`,
    endDragVirtual: `\u{5D2}\u{5D5}\u{5E8}\u{5E8}. \u{5DC}\u{5D7}\u{5E5} \u{5DB}\u{5D3}\u{5D9} \u{5DC}\u{5D1}\u{5D8}\u{5DC} \u{5D0}\u{5EA} \u{5D4}\u{5D2}\u{5E8}\u{5D9}\u{5E8}\u{5D4}.`,
    insertAfter: (args) => `\u{5D4}\u{5D5}\u{5E1}\u{5E3} \u{5D0}\u{5D7}\u{5E8}\u{5D9} ${args.itemText}`,
    insertBefore: (args) => `\u{5D4}\u{5D5}\u{5E1}\u{5E3} \u{5DC}\u{5E4}\u{5E0}\u{5D9} ${args.itemText}`,
    insertBetween: (args) =>
      `\u{5D4}\u{5D5}\u{5E1}\u{5E3} \u{5D1}\u{5D9}\u{5DF} ${args.beforeItemText} \u{5DC}\u{5D1}\u{5D9}\u{5DF} ${args.afterItemText}`,
  },
  "hr-HR": {
    dragDescriptionKeyboard: `Pritisnite Enter da biste po\u{10D}eli povla\u{10D}iti.`,
    dragDescriptionKeyboardAlt: `Pritisnite Alt + Enter za po\u{10D}etak povla\u{10D}enja.`,
    dragDescriptionLongPress: `Dugo pritisnite za po\u{10D}etak povla\u{10D}enja.`,
    dragDescriptionTouch: `Dvaput dodirnite da biste po\u{10D}eli povla\u{10D}iti.`,
    dragDescriptionVirtual: `Kliknite da biste po\u{10D}eli povla\u{10D}iti.`,
    dragItem: (args) => `Povucite stavku ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Povucite ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} odabranu stavku`,
        other: () => `ovoliko odabranih stavki: ${formatter.number(args.count)}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Pritisnite Enter za povla\u{10D}enje ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} odabrana stavka`,
        other: () => `${formatter.number(args.count)} odabrane stavke`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Pritisnite Alt + Enter za povla\u{10D}enje ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} odabrana stavka`,
        other: () => `${formatter.number(args.count)} odabrane stavke`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Dugo pritisnite za povla\u{10D}enje ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} odabrana stavka`,
        other: () => `${formatter.number(args.count)} odabrane stavke`,
      })}.`,
    dragStartedKeyboard: `Po\u{10D}eli ste povla\u{10D}iti. Pritisnite tipku tabulatora da biste do\u{161}li do cilja ispu\u{161}tanja, a zatim Enter da biste ispustili stavku ili Escape da biste prekinuli povla\u{10D}enje.`,
    dragStartedTouch: `Po\u{10D}eli ste povla\u{10D}iti. Do\u{111}ite do cilja ispu\u{161}tanja, a zatim dvaput dodirnite da biste ispustili stavku.`,
    dragStartedVirtual: `Po\u{10D}eli ste povla\u{10D}iti. Do\u{111}ite do cilja ispu\u{161}tanja, a zatim kliknite ili pritisnite Enter da biste ispustili stavku.`,
    dropCanceled: `Povla\u{10D}enje je prekinuto.`,
    dropComplete: `Ispu\u{161}tanje je dovr\u{161}eno.`,
    dropDescriptionKeyboard: `Pritisnite Enter da biste ispustili stavku. Pritisnite Escape da biste prekinuli povla\u{10D}enje.`,
    dropDescriptionTouch: `Dvaput dodirnite da biste ispustili stavku.`,
    dropDescriptionVirtual: `Kliknite da biste ispustili stavku.`,
    dropIndicator: `pokazatelj ispu\u{161}tanja`,
    dropOnItem: (args) => `Ispustite na stavku ${args.itemText}`,
    dropOnRoot: `Ispustite na`,
    endDragKeyboard: `Povla\u{10D}enje. Pritisnite Enter da biste prekinuli povla\u{10D}enje.`,
    endDragTouch: `Povla\u{10D}enje. Dvaput dodirnite da biste prekinuli povla\u{10D}enje.`,
    endDragVirtual: `Povla\u{10D}enje. Kliknite da biste prekinuli povla\u{10D}enje.`,
    insertAfter: (args) => `Umetnite iza stavke ${args.itemText}`,
    insertBefore: (args) => `Ispustite ispred stavke ${args.itemText}`,
    insertBetween: (args) => `Umetnite izme\u{111}u stavki ${args.beforeItemText} i ${args.afterItemText}`,
  },
  "hu-HU": {
    dragDescriptionKeyboard: `Nyomja le az Enter billenty\u{171}t a h\xfaz\xe1s megkezd\xe9s\xe9hez.`,
    dragDescriptionKeyboardAlt: `Nyomja le az Alt + Enter billenty\u{171}ket a h\xfaz\xe1s megkezd\xe9s\xe9hez.`,
    dragDescriptionLongPress: `Hosszan nyomja meg a h\xfaz\xe1s elind\xedt\xe1s\xe1hoz.`,
    dragDescriptionTouch: `Koppintson dupl\xe1n a h\xfaz\xe1s megkezd\xe9s\xe9hez.`,
    dragDescriptionVirtual: `Kattintson a h\xfaz\xe1s megkezd\xe9s\xe9hez.`,
    dragItem: (args) => `${args.itemText} h\xfaz\xe1sa`,
    dragSelectedItems: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
        other: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
      })} h\xfaz\xe1sa`,
    dragSelectedKeyboard: (args, formatter) =>
      `Nyomja meg az Entert ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
        other: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
      })} h\xfaz\xe1s\xe1hoz.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Nyomja meg az Alt + Enter billenty\u{171}ket ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
        other: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
      })} h\xfaz\xe1s\xe1hoz.`,
    dragSelectedLongPress: (args, formatter) =>
      `Tartsa lenyomva hosszan ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
        other: () => `${formatter.number(args.count)} kijel\xf6lt elem`,
      })} h\xfaz\xe1s\xe1hoz.`,
    dragStartedKeyboard: `H\xfaz\xe1s megkezdve. Nyomja le a Tab billenty\u{171}t az elenged\xe9si c\xe9lhoz navig\xe1l\xe1s\xe1hoz, majd nyomja le az Enter billenty\u{171}t az elenged\xe9shez, vagy nyomja le az Escape billenty\u{171}t a megszak\xedt\xe1shoz.`,
    dragStartedTouch: `H\xfaz\xe1s megkezdve. Navig\xe1ljon egy elenged\xe9si c\xe9lhoz, majd koppintson dupl\xe1n az elenged\xe9shez.`,
    dragStartedVirtual: `H\xfaz\xe1s megkezdve. Navig\xe1ljon egy elenged\xe9si c\xe9lhoz, majd kattintson vagy nyomja le az Enter billenty\u{171}t az elenged\xe9shez.`,
    dropCanceled: `Elenged\xe9s megszak\xedtva.`,
    dropComplete: `Elenged\xe9s teljes\xedtve.`,
    dropDescriptionKeyboard: `Nyomja le az Enter billenty\u{171}t az elenged\xe9shez. Nyomja le az Escape billenty\u{171}t a h\xfaz\xe1s megszak\xedt\xe1s\xe1hoz.`,
    dropDescriptionTouch: `Koppintson dupl\xe1n az elenged\xe9shez.`,
    dropDescriptionVirtual: `Kattintson az elenged\xe9shez.`,
    dropIndicator: `elenged\xe9sjelz\u{151}`,
    dropOnItem: (args) => `Elenged\xe9s erre: ${args.itemText}`,
    dropOnRoot: `Elenged\xe9s erre:`,
    endDragKeyboard: `H\xfaz\xe1s folyamatban. Nyomja le az Enter billenty\u{171}t a h\xfaz\xe1s megszak\xedt\xe1s\xe1hoz.`,
    endDragTouch: `H\xfaz\xe1s folyamatban. Koppintson dupl\xe1n a h\xfaz\xe1s megszak\xedt\xe1s\xe1hoz.`,
    endDragVirtual: `H\xfaz\xe1s folyamatban. Kattintson a h\xfaz\xe1s megszak\xedt\xe1s\xe1hoz.`,
    insertAfter: (args) => `Besz\xfar\xe1s ${args.itemText} ut\xe1n`,
    insertBefore: (args) => `Besz\xfar\xe1s ${args.itemText} el\xe9`,
    insertBetween: (args) => `Besz\xfar\xe1s ${args.beforeItemText} \xe9s ${args.afterItemText} k\xf6z\xe9`,
  },
  "it-IT": {
    dragDescriptionKeyboard: `Premi Invio per iniziare a trascinare.`,
    dragDescriptionKeyboardAlt: `Premi Alt + Invio per iniziare a trascinare.`,
    dragDescriptionLongPress: `Premi a lungo per iniziare a trascinare.`,
    dragDescriptionTouch: `Tocca due volte per iniziare a trascinare.`,
    dragDescriptionVirtual: `Fai clic per iniziare a trascinare.`,
    dragItem: (args) => `Trascina ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Trascina ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} altro elemento selezionato`,
        other: () => `${formatter.number(args.count)} altri elementi selezionati`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Premi Invio per trascinare ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento selezionato`,
        other: () => `${formatter.number(args.count)} elementi selezionati`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Premi Alt + Invio per trascinare ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento selezionato`,
        other: () => `${formatter.number(args.count)} elementi selezionati`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Premi a lungo per trascinare ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} elemento selezionato`,
        other: () => `${formatter.number(args.count)} elementi selezionati`,
      })}.`,
    dragStartedKeyboard: `Hai iniziato a trascinare. Premi Tab per arrivare sull\u{2019}area di destinazione, quindi premi Invio per rilasciare o Esc per annullare.`,
    dragStartedTouch: `Hai iniziato a trascinare. Arriva sull\u{2019}area di destinazione, quindi tocca due volte per rilasciare.`,
    dragStartedVirtual: `Hai iniziato a trascinare. Arriva sull\u{2019}area di destinazione, quindi fai clic o premi Invio per rilasciare.`,
    dropCanceled: `Rilascio annullato.`,
    dropComplete: `Rilascio completato.`,
    dropDescriptionKeyboard: `Premi Invio per rilasciare. Premi Esc per annullare.`,
    dropDescriptionTouch: `Tocca due volte per rilasciare.`,
    dropDescriptionVirtual: `Fai clic per rilasciare.`,
    dropIndicator: `indicatore di rilascio`,
    dropOnItem: (args) => `Rilascia su ${args.itemText}`,
    dropOnRoot: `Rilascia su`,
    endDragKeyboard: `Trascinamento. Premi Invio per annullare.`,
    endDragTouch: `Trascinamento. Tocca due volte per annullare.`,
    endDragVirtual: `Trascinamento. Fai clic per annullare.`,
    insertAfter: (args) => `Inserisci dopo ${args.itemText}`,
    insertBefore: (args) => `Inserisci prima di ${args.itemText}`,
    insertBetween: (args) => `Inserisci tra ${args.beforeItemText} e ${args.afterItemText}`,
  },
  "ja-JP": {
    dragDescriptionKeyboard: `Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{3066}\u{304F}\u{3060}\u{3055}\u{3044}\u{3002}`,
    dragDescriptionKeyboardAlt: `Alt+Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragDescriptionLongPress: `\u{9577}\u{62BC}\u{3057}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragDescriptionTouch: `\u{30C0}\u{30D6}\u{30EB}\u{30BF}\u{30C3}\u{30D7}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragDescriptionVirtual: `\u{30AF}\u{30EA}\u{30C3}\u{30AF}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragItem: (args) => `${args.itemText} \u{3092}\u{30C9}\u{30E9}\u{30C3}\u{30B0}`,
    dragSelectedItems: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{500B}\u{306E}\u{9078}\u{629E}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{500B}\u{306E}\u{9078}\u{629E}\u{9805}\u{76EE}`,
      })} \u{3092}\u{30C9}\u{30E9}\u{30C3}\u{30B0}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{3001}${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{9078}\u{629E}\u{3057}\u{305F}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{9078}\u{629E}\u{3057}\u{305F}\u{9805}\u{76EE}`,
      })}\u{3092}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Alt+Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{3001}${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{9078}\u{629E}\u{3057}\u{305F}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{9078}\u{629E}\u{3057}\u{305F}\u{9805}\u{76EE}`,
      })}\u{3092}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{9577}\u{62BC}\u{3057}\u{3057}\u{3066}\u{3001}${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{9078}\u{629E}\u{3057}\u{305F}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{9078}\u{629E}\u{3057}\u{305F}\u{9805}\u{76EE}`,
      })}\u{3092}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragStartedKeyboard: `\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3059}\u{3002}Tab \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{30BF}\u{30FC}\u{30B2}\u{30C3}\u{30C8}\u{306B}\u{3044}\u{3069}\u{3046}\u{3057}\u{3001}Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{3059}\u{308B}\u{304B}\u{3001}Esc \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30AD}\u{30E3}\u{30F3}\u{30BB}\u{30EB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragStartedTouch: `\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{306E}\u{30BF}\u{30FC}\u{30B2}\u{30C3}\u{30C8}\u{306B}\u{79FB}\u{52D5}\u{3057}\u{3001}\u{30C0}\u{30D6}\u{30EB}\u{30BF}\u{30C3}\u{30D7}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dragStartedVirtual: `\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{958B}\u{59CB}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{306E}\u{30BF}\u{30FC}\u{30B2}\u{30C3}\u{30C8}\u{306B}\u{79FB}\u{52D5}\u{3057}\u{3001}\u{30AF}\u{30EA}\u{30C3}\u{30AF}\u{307E}\u{305F}\u{306F} Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dropCanceled: `\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{304C}\u{30AD}\u{30E3}\u{30F3}\u{30BB}\u{30EB}\u{3055}\u{308C}\u{307E}\u{3057}\u{305F}\u{3002}`,
    dropComplete: `\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{304C}\u{5B8C}\u{4E86}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}`,
    dropDescriptionKeyboard: `Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{3057}\u{307E}\u{3059}\u{3002}Esc \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{30AD}\u{30E3}\u{30F3}\u{30BB}\u{30EB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dropDescriptionTouch: `\u{30C0}\u{30D6}\u{30EB}\u{30BF}\u{30C3}\u{30D7}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dropDescriptionVirtual: `\u{30AF}\u{30EA}\u{30C3}\u{30AF}\u{3057}\u{3066}\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{3057}\u{307E}\u{3059}\u{3002}`,
    dropIndicator: `\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{30A4}\u{30F3}\u{30B8}\u{30B1}\u{30FC}\u{30BF}\u{30FC}`,
    dropOnItem: (args) => `${args.itemText} \u{306B}\u{30C9}\u{30ED}\u{30C3}\u{30D7}`,
    dropOnRoot: `\u{30C9}\u{30ED}\u{30C3}\u{30D7}\u{5834}\u{6240}`,
    endDragKeyboard: `\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3057}\u{3066}\u{3044}\u{307E}\u{3059}\u{3002}Enter \u{30AD}\u{30FC}\u{3092}\u{62BC}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{30AD}\u{30E3}\u{30F3}\u{30BB}\u{30EB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    endDragTouch: `\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3057}\u{3066}\u{3044}\u{307E}\u{3059}\u{3002}\u{30C0}\u{30D6}\u{30EB}\u{30BF}\u{30C3}\u{30D7}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{30AD}\u{30E3}\u{30F3}\u{30BB}\u{30EB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    endDragVirtual: `\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3057}\u{3066}\u{3044}\u{307E}\u{3059}\u{3002}\u{30AF}\u{30EA}\u{30C3}\u{30AF}\u{3057}\u{3066}\u{30C9}\u{30E9}\u{30C3}\u{30B0}\u{3092}\u{30AD}\u{30E3}\u{30F3}\u{30BB}\u{30EB}\u{3057}\u{307E}\u{3059}\u{3002}`,
    insertAfter: (args) => `${args.itemText} \u{306E}\u{5F8C}\u{306B}\u{633F}\u{5165}`,
    insertBefore: (args) => `${args.itemText} \u{306E}\u{524D}\u{306B}\u{633F}\u{5165}`,
    insertBetween: (args) =>
      `${args.beforeItemText} \u{3068} ${args.afterItemText} \u{306E}\u{9593}\u{306B}\u{633F}\u{5165}`,
  },
  "ko-KR": {
    dragDescriptionKeyboard: `\u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{C2DC}\u{C791}\u{D558}\u{B824}\u{BA74} Enter\u{B97C} \u{B204}\u{B974}\u{C138}\u{C694}.`,
    dragDescriptionKeyboardAlt: `\u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{C2DC}\u{C791}\u{D558}\u{B824}\u{BA74} Alt + Enter\u{B97C} \u{B204}\u{B974}\u{C2ED}\u{C2DC}\u{C624}.`,
    dragDescriptionLongPress: `\u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{C2DC}\u{C791}\u{D558}\u{B824}\u{BA74} \u{AE38}\u{AC8C} \u{B204}\u{B974}\u{C2ED}\u{C2DC}\u{C624}.`,
    dragDescriptionTouch: `\u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{C2DC}\u{C791}\u{D558}\u{B824}\u{BA74} \u{B354}\u{BE14} \u{D0ED}\u{D558}\u{C138}\u{C694}.`,
    dragDescriptionVirtual: `\u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{C2DC}\u{C791}\u{D558}\u{B824}\u{BA74} \u{D074}\u{B9AD}\u{D558}\u{C138}\u{C694}.`,
    dragItem: (args) => `${args.itemText} \u{B4DC}\u{B798}\u{ADF8}`,
    dragSelectedItems: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
        other: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
      })} \u{B4DC}\u{B798}\u{ADF8}`,
    dragSelectedKeyboard: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
        other: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
      })}\u{C744} \u{B4DC}\u{B798}\u{ADF8}\u{D558}\u{B824}\u{BA74} Enter\u{B97C} \u{B204}\u{B974}\u{C2ED}\u{C2DC}\u{C624}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
        other: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
      })}\u{C744} \u{B4DC}\u{B798}\u{ADF8}\u{D558}\u{B824}\u{BA74} Alt + Enter\u{B97C} \u{B204}\u{B974}\u{C2ED}\u{C2DC}\u{C624}.`,
    dragSelectedLongPress: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
        other: () => `${formatter.number(args.count)}\u{AC1C} \u{C120}\u{D0DD} \u{D56D}\u{BAA9}`,
      })}\u{C744} \u{B4DC}\u{B798}\u{ADF8}\u{D558}\u{B824}\u{BA74} \u{AE38}\u{AC8C} \u{B204}\u{B974}\u{C2ED}\u{C2DC}\u{C624}.`,
    dragStartedKeyboard: `\u{B4DC}\u{B798}\u{ADF8}\u{AC00} \u{C2DC}\u{C791}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}. Tab\u{C744} \u{B20C}\u{B7EC} \u{B4DC}\u{B86D} \u{B300}\u{C0C1}\u{C73C}\u{B85C} \u{C774}\u{B3D9}\u{D55C} \u{B2E4}\u{C74C} Enter\u{B97C} \u{B20C}\u{B7EC} \u{B4DC}\u{B86D}\u{D558}\u{AC70}\u{B098} Esc\u{B97C} \u{B20C}\u{B7EC} \u{CDE8}\u{C18C}\u{D558}\u{C138}\u{C694}.`,
    dragStartedTouch: `\u{B4DC}\u{B798}\u{ADF8}\u{AC00} \u{C2DC}\u{C791}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}. \u{B4DC}\u{B86D} \u{B300}\u{C0C1}\u{C73C}\u{B85C} \u{C774}\u{B3D9}\u{D55C} \u{B2E4}\u{C74C} \u{B354}\u{BE14} \u{D0ED}\u{D558}\u{C5EC} \u{B4DC}\u{B86D}\u{D558}\u{C138}\u{C694}.`,
    dragStartedVirtual: `\u{B4DC}\u{B798}\u{ADF8}\u{AC00} \u{C2DC}\u{C791}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}. \u{B4DC}\u{B86D} \u{B300}\u{C0C1}\u{C73C}\u{B85C} \u{C774}\u{B3D9}\u{D55C} \u{B2E4}\u{C74C} \u{D074}\u{B9AD}\u{D558}\u{AC70}\u{B098} Enter\u{B97C} \u{B20C}\u{B7EC} \u{B4DC}\u{B86D}\u{D558}\u{C138}\u{C694}.`,
    dropCanceled: `\u{B4DC}\u{B86D}\u{C774} \u{CDE8}\u{C18C}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    dropComplete: `\u{B4DC}\u{B86D}\u{C774} \u{C644}\u{B8CC}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    dropDescriptionKeyboard: `\u{B4DC}\u{B86D}\u{D558}\u{B824}\u{BA74} Enter\u{B97C} \u{B204}\u{B974}\u{C138}\u{C694}. \u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{CDE8}\u{C18C}\u{D558}\u{B824}\u{BA74} Esc\u{B97C} \u{B204}\u{B974}\u{C138}\u{C694}.`,
    dropDescriptionTouch: `\u{B354}\u{BE14} \u{D0ED}\u{D558}\u{C5EC} \u{B4DC}\u{B86D}\u{D558}\u{C138}\u{C694}.`,
    dropDescriptionVirtual: `\u{B4DC}\u{B86D}\u{D558}\u{B824}\u{BA74} \u{D074}\u{B9AD}\u{D558}\u{C138}\u{C694}.`,
    dropIndicator: `\u{B4DC}\u{B86D} \u{D45C}\u{C2DC}\u{AE30}`,
    dropOnItem: (args) => `${args.itemText}\u{C5D0} \u{B4DC}\u{B86D}`,
    dropOnRoot: `\u{B4DC}\u{B86D} \u{B300}\u{C0C1}`,
    endDragKeyboard: `\u{B4DC}\u{B798}\u{ADF8} \u{C911}\u{C785}\u{B2C8}\u{B2E4}. \u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{CDE8}\u{C18C}\u{D558}\u{B824}\u{BA74} Enter\u{B97C} \u{B204}\u{B974}\u{C138}\u{C694}.`,
    endDragTouch: `\u{B4DC}\u{B798}\u{ADF8} \u{C911}\u{C785}\u{B2C8}\u{B2E4}. \u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{CDE8}\u{C18C}\u{D558}\u{B824}\u{BA74} \u{B354}\u{BE14} \u{D0ED}\u{D558}\u{C138}\u{C694}.`,
    endDragVirtual: `\u{B4DC}\u{B798}\u{ADF8} \u{C911}\u{C785}\u{B2C8}\u{B2E4}. \u{B4DC}\u{B798}\u{ADF8}\u{B97C} \u{CDE8}\u{C18C}\u{D558}\u{B824}\u{BA74} \u{D074}\u{B9AD}\u{D558}\u{C138}\u{C694}.`,
    insertAfter: (args) => `${args.itemText} \u{C774}\u{D6C4}\u{C5D0} \u{C0BD}\u{C785}`,
    insertBefore: (args) => `${args.itemText} \u{C774}\u{C804}\u{C5D0} \u{C0BD}\u{C785}`,
    insertBetween: (args) =>
      `${args.beforeItemText} \u{BC0F} ${args.afterItemText} \u{C0AC}\u{C774}\u{C5D0} \u{C0BD}\u{C785}`,
  },
  "lt-LT": {
    dragDescriptionKeyboard: `Paspauskite \u{201E}Enter\u{201C}, kad prad\u{117}tum\u{117}te vilkti.`,
    dragDescriptionKeyboardAlt: `Paspauskite \u{201E}Alt + Enter\u{201C}, kad prad\u{117}tum\u{117}te vilkti.`,
    dragDescriptionLongPress: `Palaikykite nuspaud\u{119}, kad prad\u{117}tum\u{117}te vilkti.`,
    dragDescriptionTouch: `Palieskite dukart, kad prad\u{117}tum\u{117}te vilkti.`,
    dragDescriptionVirtual: `Spustel\u{117}kite, kad prad\u{117}tum\u{117}te vilkti.`,
    dragItem: (args) => `Vilkti ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Vilkti ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} pasirinkt\u{105} element\u{105}`,
        other: () => `${formatter.number(args.count)} pasirinktus elementus`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Paspauskite \u{201E}Enter\u{201C}, jei norite nuvilkti ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} pasirinkt\u{105} element\u{105}`,
        other: () => `${formatter.number(args.count)} pasirinktus elementus`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Paspauskite \u{201E}Alt + Enter\u{201C}, kad nuvilktum\u{117}te ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} pasirinkt\u{105} element\u{105}`,
        other: () => `${formatter.number(args.count)} pasirinktus elementus`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Nuspaud\u{119} palaikykite, kad nuvilktum\u{117}te ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} pasirinkt\u{105} element\u{105}`,
        other: () => `${formatter.number(args.count)} pasirinktus elementus`,
      })}.`,
    dragStartedKeyboard: `Prad\u{117}ta vilkti. Paspauskite \u{201E}Tab\u{201C}, kad pereitum\u{117}te \u{12F} tiesiogin\u{119} paskirties viet\u{105}, tada paspauskite \u{201E}Enter\u{201C}, kad numestum\u{117}te, arba \u{201E}Escape\u{201C}, kad at\u{161}auktum\u{117}te.`,
    dragStartedTouch: `Prad\u{117}ta vilkti. Eikite \u{12F} tiesiogin\u{119} paskirties viet\u{105}, tada palieskite dukart, kad numestum\u{117}te.`,
    dragStartedVirtual: `Prad\u{117}ta vilkti. Eikite \u{12F} tiesiogin\u{119} paskirties viet\u{105} ir spustel\u{117}kite arba paspauskite \u{201E}Enter\u{201C}, kad numestum\u{117}te.`,
    dropCanceled: `Numetimas at\u{161}auktas.`,
    dropComplete: `Numesta.`,
    dropDescriptionKeyboard: `Paspauskite \u{201E}Enter\u{201C}, kad numestum\u{117}te. Paspauskite \u{201E}Escape\u{201C}, kad at\u{161}auktum\u{117}te vilkim\u{105}.`,
    dropDescriptionTouch: `Palieskite dukart, kad numestum\u{117}te.`,
    dropDescriptionVirtual: `Spustel\u{117}kite, kad numestum\u{117}te.`,
    dropIndicator: `numetimo indikatorius`,
    dropOnItem: (args) => `Numesti ant ${args.itemText}`,
    dropOnRoot: `Numesti ant`,
    endDragKeyboard: `Velkama. Paspauskite \u{201E}Enter\u{201C}, kad at\u{161}auktum\u{117}te vilkim\u{105}.`,
    endDragTouch: `Velkama. Spustel\u{117}kite dukart, kad at\u{161}auktum\u{117}te vilkim\u{105}.`,
    endDragVirtual: `Velkama. Spustel\u{117}kite, kad at\u{161}auktum\u{117}te vilkim\u{105}.`,
    insertAfter: (args) => `\u{12E}terpti po ${args.itemText}`,
    insertBefore: (args) => `\u{12E}terpti prie\u{161} ${args.itemText}`,
    insertBetween: (args) => `\u{12E}terpti tarp ${args.beforeItemText} ir ${args.afterItemText}`,
  },
  "lv-LV": {
    dragDescriptionKeyboard: `Nospiediet Enter, lai s\u{101}ktu vilk\u{161}anu.`,
    dragDescriptionKeyboardAlt: `Nospiediet tausti\u{146}u kombin\u{101}ciju Alt+Enter, lai s\u{101}ktu vilk\u{161}anu.`,
    dragDescriptionLongPress: `Turiet nospiestu, lai s\u{101}ktu vilk\u{161}anu.`,
    dragDescriptionTouch: `Veiciet dubultsk\u{101}rienu, lai s\u{101}ktu vilk\u{161}anu.`,
    dragDescriptionVirtual: `Noklik\u{161}\u{137}iniet, lai s\u{101}ktu vilk\u{161}anu.`,
    dragItem: (args) => `Velciet ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Velciet ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} atlas\u{12B}to vienumu`,
        other: () => `${formatter.number(args.count)} atlas\u{12B}tos vienumus`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Nospiediet tausti\u{146}u Enter, lai vilktu ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} atlas\u{12B}to vienumu`,
        other: () => `${formatter.number(args.count)} atlas\u{12B}tos vienumus`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Nospiediet tausti\u{146}u kombin\u{101}ciju Alt+Enter, lai vilktu ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} atlas\u{12B}to vienumu`,
        other: () => `${formatter.number(args.count)} atlas\u{12B}tos vienumus`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Turiet nospiestu, lai vilktu ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} atlas\u{12B}to vienumu`,
        other: () => `${formatter.number(args.count)} atlas\u{12B}tos vienumus`,
      })}.`,
    dragStartedKeyboard: `Uzs\u{101}kta vilk\u{161}ana. Nospiediet tausti\u{146}u Tab, lai p\u{101}rietu uz nome\u{161}anas m\u{113}r\u{137}i, p\u{113}c tam nospiediet Enter, lai nomestu, vai nospiediet Escape, lai atceltu.`,
    dragStartedTouch: `Uzs\u{101}kta vilk\u{161}ana. P\u{101}rejiet uz nome\u{161}anas m\u{113}r\u{137}i, p\u{113}c tam veiciet dubultsk\u{101}rienu, lai nomestu.`,
    dragStartedVirtual: `Uzs\u{101}kta vilk\u{161}ana. P\u{101}rejiet uz nome\u{161}anas m\u{113}r\u{137}i, p\u{113}c tam nospiediet Enter, lai nomestu.`,
    dropCanceled: `Nome\u{161}ana atcelta.`,
    dropComplete: `Nome\u{161}ana pabeigta.`,
    dropDescriptionKeyboard: `Nospiediet Enter, lai nomestu. Nospiediet Escape, lai atceltu vilk\u{161}anu.`,
    dropDescriptionTouch: `Veiciet dubultsk\u{101}rienu, lai nomestu.`,
    dropDescriptionVirtual: `Noklik\u{161}\u{137}iniet, lai nomestu.`,
    dropIndicator: `nome\u{161}anas indikators`,
    dropOnItem: (args) => `Nometiet uz ${args.itemText}`,
    dropOnRoot: `Nometiet uz`,
    endDragKeyboard: `Notiek vilk\u{161}ana. Nospiediet Enter, lai atceltu vilk\u{161}anu.`,
    endDragTouch: `Notiek vilk\u{161}ana. Veiciet dubultsk\u{101}rienu, lai atceltu vilk\u{161}anu.`,
    endDragVirtual: `Notiek vilk\u{161}ana. Noklik\u{161}\u{137}iniet, lai atceltu vilk\u{161}anu.`,
    insertAfter: (args) => `Ievietojiet p\u{113}c ${args.itemText}`,
    insertBefore: (args) => `Ievietojiet pirms ${args.itemText}`,
    insertBetween: (args) => `Ievietojiet starp ${args.beforeItemText} un ${args.afterItemText}`,
  },
  "nb-NO": {
    dragDescriptionKeyboard: `Trykk p\xe5 Enter for \xe5 begynne \xe5 dra.`,
    dragDescriptionKeyboardAlt: `Trykk p\xe5 Alt + Enter for \xe5 begynne \xe5 dra.`,
    dragDescriptionLongPress: `Trykk lenge for \xe5 begynne \xe5 dra.`,
    dragDescriptionTouch: `Dobbelttrykk for \xe5 begynne \xe5 dra.`,
    dragDescriptionVirtual: `Klikk for \xe5 begynne \xe5 dra.`,
    dragItem: (args) => `Dra ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} merket element`,
        other: () => `${formatter.number(args.count)} merkede elementer`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Trykk Enter for \xe5 dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgt element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Trykk p\xe5 Alt + Enter for \xe5 dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgt element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Trykk lenge for \xe5 dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valgt element`,
        other: () => `${formatter.number(args.count)} valgte elementer`,
      })}.`,
    dragStartedKeyboard: `Begynte \xe5 dra. Trykk p\xe5 Tab for \xe5 navigere til et m\xe5l, og trykk deretter p\xe5 Enter for \xe5 slippe eller p\xe5 Esc for \xe5 avbryte.`,
    dragStartedTouch: `Begynte \xe5 dra. Naviger til et m\xe5l, og dobbelttrykk for \xe5 slippe.`,
    dragStartedVirtual: `Begynte \xe5 dra. Naviger til et m\xe5l, og klikk eller trykk p\xe5 Enter for \xe5 slippe.`,
    dropCanceled: `Avbr\xf8t slipping.`,
    dropComplete: `Slippingen er fullf\xf8rt.`,
    dropDescriptionKeyboard: `Trykk p\xe5 Enter for \xe5 slippe. Trykk p\xe5 Esc hvis du vil avbryte draingen.`,
    dropDescriptionTouch: `Dobbelttrykk for \xe5 slippe.`,
    dropDescriptionVirtual: `Klikk for \xe5 slippe.`,
    dropIndicator: `slippeindikator`,
    dropOnItem: (args) => `Slipp p\xe5 ${args.itemText}`,
    dropOnRoot: `Slipp p\xe5`,
    endDragKeyboard: `Drar. Trykk p\xe5 Enter hvis du vil avbryte.`,
    endDragTouch: `Drar. Dobbelttrykk hvis du vil avbryte.`,
    endDragVirtual: `Drar. Klikk hvis du vil avbryte.`,
    insertAfter: (args) => `Sett inn etter ${args.itemText}`,
    insertBefore: (args) => `Sett inn f\xf8r ${args.itemText}`,
    insertBetween: (args) => `Sett inn mellom ${args.beforeItemText} og ${args.afterItemText}`,
  },
  "nl-NL": {
    dragDescriptionKeyboard: `Druk op Enter om te slepen.`,
    dragDescriptionKeyboardAlt: `Druk op Alt + Enter om te slepen.`,
    dragDescriptionLongPress: `Houd lang ingedrukt om te slepen.`,
    dragDescriptionTouch: `Dubbeltik om te slepen.`,
    dragDescriptionVirtual: `Klik om met slepen te starten.`,
    dragItem: (args) => `${args.itemText} slepen`,
    dragSelectedItems: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} geselecteerd item`,
        other: () => `${formatter.number(args.count)} geselecteerde items`,
      })} slepen`,
    dragSelectedKeyboard: (args, formatter) =>
      `Druk op Enter om ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} geselecteerd item`,
        other: () => `${formatter.number(args.count)} geselecteerde items`,
      })} te slepen.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Druk op Alt + Enter om ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} geselecteerd item`,
        other: () => `${formatter.number(args.count)} geselecteerde items`,
      })} te slepen.`,
    dragSelectedLongPress: (args, formatter) =>
      `Houd lang ingedrukt om ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} geselecteerd item`,
        other: () => `${formatter.number(args.count)} geselecteerde items`,
      })} te slepen.`,
    dragStartedKeyboard: `Begonnen met slepen. Druk op Tab om naar een locatie te gaan. Druk dan op Enter om neer te zetten, of op Esc om te annuleren.`,
    dragStartedTouch: `Begonnen met slepen. Ga naar de gewenste locatie en dubbeltik om neer te zetten.`,
    dragStartedVirtual: `Begonnen met slepen. Ga naar de gewenste locatie en klik of druk op Enter om neer te zetten.`,
    dropCanceled: `Neerzetten geannuleerd.`,
    dropComplete: `Neerzetten voltooid.`,
    dropDescriptionKeyboard: `Druk op Enter om neer te zetten. Druk op Esc om het slepen te annuleren.`,
    dropDescriptionTouch: `Dubbeltik om neer te zetten.`,
    dropDescriptionVirtual: `Klik om neer te zetten.`,
    dropIndicator: `aanwijzer voor neerzetten`,
    dropOnItem: (args) => `Neerzetten op ${args.itemText}`,
    dropOnRoot: `Neerzetten op`,
    endDragKeyboard: `Bezig met slepen. Druk op Enter om te annuleren.`,
    endDragTouch: `Bezig met slepen. Dubbeltik om te annuleren.`,
    endDragVirtual: `Bezig met slepen. Klik om te annuleren.`,
    insertAfter: (args) => `Plaatsen na ${args.itemText}`,
    insertBefore: (args) => `Plaatsen v\xf3\xf3r ${args.itemText}`,
    insertBetween: (args) => `Plaatsen tussen ${args.beforeItemText} en ${args.afterItemText}`,
  },
  "pl-PL": {
    dragDescriptionKeyboard: `Naci\u{15B}nij Enter, aby rozpocz\u{105}\u{107} przeci\u{105}ganie.`,
    dragDescriptionKeyboardAlt: `Naci\u{15B}nij Alt + Enter, aby rozpocz\u{105}\u{107} przeci\u{105}ganie.`,
    dragDescriptionLongPress: `Naci\u{15B}nij i przytrzymaj, aby rozpocz\u{105}\u{107} przeci\u{105}ganie.`,
    dragDescriptionTouch: `Dotknij dwukrotnie, aby rozpocz\u{105}\u{107} przeci\u{105}ganie.`,
    dragDescriptionVirtual: `Kliknij, aby rozpocz\u{105}\u{107} przeci\u{105}ganie.`,
    dragItem: (args) => `Przeci\u{105}gnij ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Przeci\u{105}gnij ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} wybrany element`,
        other: () => `${formatter.number(args.count)} wybranych element\xf3w`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Naci\u{15B}nij Enter, aby przeci\u{105}gn\u{105}\u{107} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} wybrany element`,
        other: () => `${formatter.number(args.count)} wybrane(-ych) elementy(-\xf3w)`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Naci\u{15B}nij Alt + Enter, aby przeci\u{105}gn\u{105}\u{107} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} wybrany element`,
        other: () => `${formatter.number(args.count)} wybrane(-ych) elementy(-\xf3w)`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Naci\u{15B}nij i przytrzymaj, aby przeci\u{105}gn\u{105}\u{107} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} wybrany element`,
        other: () => `${formatter.number(args.count)} wybrane(-ych) elementy(-\xf3w)`,
      })}.`,
    dragStartedKeyboard: `Rozpocz\u{119}to przeci\u{105}ganie. Naci\u{15B}nij Tab, aby wybra\u{107} miejsce docelowe, a nast\u{119}pnie naci\u{15B}nij Enter, aby upu\u{15B}ci\u{107}, lub Escape, aby anulowa\u{107}.`,
    dragStartedTouch: `Rozpocz\u{119}to przeci\u{105}ganie. Wybierz miejsce, w kt\xf3rym chcesz upu\u{15B}ci\u{107} element, a nast\u{119}pnie dotknij dwukrotnie, aby upu\u{15B}ci\u{107}.F`,
    dragStartedVirtual: `Rozpocz\u{119}to przeci\u{105}ganie. Wybierz miejsce, w kt\xf3rym chcesz upu\u{15B}ci\u{107} element, a nast\u{119}pnie kliknij lub naci\u{15B}nij Enter, aby upu\u{15B}ci\u{107}.`,
    dropCanceled: `Anulowano upuszczenie.`,
    dropComplete: `Zako\u{144}czono upuszczanie.`,
    dropDescriptionKeyboard: `Naci\u{15B}nij Enter, aby upu\u{15B}ci\u{107}. Naci\u{15B}nij Escape, aby anulowa\u{107} przeci\u{105}gni\u{119}cie.`,
    dropDescriptionTouch: `Dotknij dwukrotnie, aby upu\u{15B}ci\u{107}.`,
    dropDescriptionVirtual: `Kliknij, aby upu\u{15B}ci\u{107}.`,
    dropIndicator: `wska\u{17A}nik upuszczenia`,
    dropOnItem: (args) => `Upu\u{15B}\u{107} na ${args.itemText}`,
    dropOnRoot: `Upu\u{15B}\u{107}`,
    endDragKeyboard: `Przeci\u{105}ganie. Naci\u{15B}nij Enter, aby anulowa\u{107} przeci\u{105}gni\u{119}cie.`,
    endDragTouch: `Przeci\u{105}ganie. Kliknij dwukrotnie, aby anulowa\u{107} przeci\u{105}gni\u{119}cie.`,
    endDragVirtual: `Przeci\u{105}ganie. Kliknij, aby anulowa\u{107} przeci\u{105}ganie.`,
    insertAfter: (args) => `Umie\u{15B}\u{107} za ${args.itemText}`,
    insertBefore: (args) => `Umie\u{15B}\u{107} przed ${args.itemText}`,
    insertBetween: (args) => `Umie\u{15B}\u{107} mi\u{119}dzy ${args.beforeItemText} i ${args.afterItemText}`,
  },
  "pt-BR": {
    dragDescriptionKeyboard: `Pressione Enter para come\xe7ar a arrastar.`,
    dragDescriptionKeyboardAlt: `Pressione Alt + Enter para come\xe7ar a arrastar.`,
    dragDescriptionLongPress: `Pressione e segure para come\xe7ar a arrastar.`,
    dragDescriptionTouch: `Toque duas vezes para come\xe7ar a arrastar.`,
    dragDescriptionVirtual: `Clique para come\xe7ar a arrastar.`,
    dragItem: (args) => `Arrastar ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} item selecionado`,
        other: () => `${formatter.number(args.count)} itens selecionados`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Pressione Enter para arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} o item selecionado`,
        other: () => `${formatter.number(args.count)} os itens selecionados`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Pressione Alt + Enter para arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} o item selecionado`,
        other: () => `${formatter.number(args.count)} os itens selecionados`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Pressione e segure para arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} o item selecionado`,
        other: () => `${formatter.number(args.count)} os itens selecionados`,
      })}.`,
    dragStartedKeyboard: `Comece a arrastar. Pressione Tab para navegar at\xe9 um alvo e, em seguida, pressione Enter para soltar ou pressione Escape para cancelar.`,
    dragStartedTouch: `Comece a arrastar. Navegue at\xe9 um alvo e toque duas vezes para soltar.`,
    dragStartedVirtual: `Comece a arrastar. Navegue at\xe9 um alvo e clique ou pressione Enter para soltar.`,
    dropCanceled: `Libera\xe7\xe3o cancelada.`,
    dropComplete: `Libera\xe7\xe3o conclu\xedda.`,
    dropDescriptionKeyboard: `Pressione Enter para soltar. Pressione Escape para cancelar.`,
    dropDescriptionTouch: `Toque duas vezes para soltar.`,
    dropDescriptionVirtual: `Clique para soltar.`,
    dropIndicator: `indicador de libera\xe7\xe3o`,
    dropOnItem: (args) => `Soltar em ${args.itemText}`,
    dropOnRoot: `Soltar`,
    endDragKeyboard: `Arrastando. Pressione Enter para cancelar.`,
    endDragTouch: `Arrastando. Toque duas vezes para cancelar.`,
    endDragVirtual: `Arrastando. Clique para cancelar.`,
    insertAfter: (args) => `Inserir ap\xf3s ${args.itemText}`,
    insertBefore: (args) => `Inserir antes de ${args.itemText}`,
    insertBetween: (args) => `Inserir entre ${args.beforeItemText} e ${args.afterItemText}`,
  },
  "pt-PT": {
    dragDescriptionKeyboard: `Prima Enter para iniciar o arrasto.`,
    dragDescriptionKeyboardAlt: `Prima Alt + Enter para iniciar o arrasto.`,
    dragDescriptionLongPress: `Prima longamente para come\xe7ar a arrastar.`,
    dragDescriptionTouch: `Fa\xe7a duplo toque para come\xe7ar a arrastar.`,
    dragDescriptionVirtual: `Clique para iniciar o arrasto.`,
    dragItem: (args) => `Arrastar ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} item selecionado`,
        other: () => `${formatter.number(args.count)} itens selecionados`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Prima Enter para arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} o item selecionado`,
        other: () => `${formatter.number(args.count)} os itens selecionados`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Prima Alt + Enter para arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} o item selecionado`,
        other: () => `${formatter.number(args.count)} os itens selecionados`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Prima longamente para arrastar ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} o item selecionado`,
        other: () => `${formatter.number(args.count)} os itens selecionados`,
      })}.`,
    dragStartedKeyboard: `Arrasto iniciado. Prima a tecla de tabula\xe7\xe3o para navegar para um destino para largar, e em seguida prima Enter para largar ou prima Escape para cancelar.`,
    dragStartedTouch: `Arrasto iniciado. Navegue para um destino para largar, e em seguida fa\xe7a duplo toque para largar.`,
    dragStartedVirtual: `Arrasto iniciado. Navegue para um destino para largar, e em seguida clique ou prima Enter para largar.`,
    dropCanceled: `Largar cancelado.`,
    dropComplete: `Largar completo.`,
    dropDescriptionKeyboard: `Prima Enter para largar. Prima Escape para cancelar o arrasto.`,
    dropDescriptionTouch: `Fa\xe7a duplo toque para largar.`,
    dropDescriptionVirtual: `Clique para largar.`,
    dropIndicator: `Indicador de largar`,
    dropOnItem: (args) => `Largar em ${args.itemText}`,
    dropOnRoot: `Largar em`,
    endDragKeyboard: `A arrastar. Prima Enter para cancelar o arrasto.`,
    endDragTouch: `A arrastar. Fa\xe7a duplo toque para cancelar o arrasto.`,
    endDragVirtual: `A arrastar. Clique para cancelar o arrasto.`,
    insertAfter: (args) => `Inserir depois de ${args.itemText}`,
    insertBefore: (args) => `Inserir antes de ${args.itemText}`,
    insertBetween: (args) => `Inserir entre ${args.beforeItemText} e ${args.afterItemText}`,
  },
  "ro-RO": {
    dragDescriptionKeyboard: `Ap\u{103}sa\u{21B}i pe Enter pentru a \xeencepe glisarea.`,
    dragDescriptionKeyboardAlt: `Ap\u{103}sa\u{21B}i pe Alt + Enter pentru a \xeencepe glisarea.`,
    dragDescriptionLongPress: `Ap\u{103}sa\u{21B}i lung pentru a \xeencepe glisarea.`,
    dragDescriptionTouch: `Atinge\u{21B}i de dou\u{103} ori pentru a \xeencepe s\u{103} glisa\u{21B}i.`,
    dragDescriptionVirtual: `Face\u{21B}i clic pentru a \xeencepe glisarea.`,
    dragItem: (args) => `Glisa\u{21B}i ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Glisa\u{21B}i ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} element selectat`,
        other: () => `${formatter.number(args.count)} elemente selectate`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Ap\u{103}sa\u{21B}i pe Enter pentru a glisa ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} element selectat`,
        other: () => `${formatter.number(args.count)} elemente selectate`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Ap\u{103}sa\u{21B}i pe Alt + Enter pentru a glisa ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} element selectat`,
        other: () => `${formatter.number(args.count)} elemente selectate`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Ap\u{103}sa\u{21B}i lung pentru a glisa ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} element selectat`,
        other: () => `${formatter.number(args.count)} elemente selectate`,
      })}.`,
    dragStartedKeyboard: `A \xeenceput glisarea. Ap\u{103}sa\u{21B}i pe Tab pentru a naviga la o \u{21B}int\u{103} de fixare, apoi ap\u{103}sa\u{21B}i pe Enter pentru a fixa sau ap\u{103}sa\u{21B}i pe Escape pentru a anula glisarea.`,
    dragStartedTouch: `A \xeenceput glisarea. Naviga\u{21B}i la o \u{21B}int\u{103} de fixare, apoi atinge\u{21B}i de dou\u{103} ori pentru a fixa.`,
    dragStartedVirtual: `A \xeenceput glisarea. Naviga\u{21B}i la o \u{21B}int\u{103} de fixare, apoi face\u{21B}i clic sau ap\u{103}sa\u{21B}i pe Enter pentru a fixa.`,
    dropCanceled: `Fixare anulat\u{103}.`,
    dropComplete: `Fixare finalizat\u{103}.`,
    dropDescriptionKeyboard: `Ap\u{103}sa\u{21B}i pe Enter pentru a fixa. Ap\u{103}sa\u{21B}i pe Escape pentru a anula glisarea.`,
    dropDescriptionTouch: `Atinge\u{21B}i de dou\u{103} ori pentru a fixa.`,
    dropDescriptionVirtual: `Face\u{21B}i clic pentru a fixa.`,
    dropIndicator: `indicator de fixare`,
    dropOnItem: (args) => `Fixa\u{21B}i pe ${args.itemText}`,
    dropOnRoot: `Fixare pe`,
    endDragKeyboard: `Se gliseaz\u{103}. Ap\u{103}sa\u{21B}i pe Enter pentru a anula glisarea.`,
    endDragTouch: `Se gliseaz\u{103}. Atinge\u{21B}i de dou\u{103} ori pentru a anula glisarea.`,
    endDragVirtual: `Se gliseaz\u{103}. Face\u{21B}i clic pentru a anula glisarea.`,
    insertAfter: (args) => `Insera\u{21B}i dup\u{103} ${args.itemText}`,
    insertBefore: (args) => `Insera\u{21B}i \xeenainte de ${args.itemText}`,
    insertBetween: (args) => `Insera\u{21B}i \xeentre ${args.beforeItemText} \u{219}i ${args.afterItemText}`,
  },
  "ru-RU": {
    dragDescriptionKeyboard: `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Enter \u{434}\u{43B}\u{44F} \u{43D}\u{430}\u{447}\u{430}\u{43B}\u{430} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F}.`,
    dragDescriptionKeyboardAlt: `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} Alt + Enter, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43D}\u{430}\u{447}\u{430}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{442}\u{44C}.`,
    dragDescriptionLongPress: `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{438} \u{443}\u{434}\u{435}\u{440}\u{436}\u{438}\u{432}\u{430}\u{439}\u{442}\u{435}, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43D}\u{430}\u{447}\u{430}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{442}\u{44C}.`,
    dragDescriptionTouch: `\u{414}\u{432}\u{430}\u{436}\u{434}\u{44B} \u{43D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{434}\u{43B}\u{44F} \u{43D}\u{430}\u{447}\u{430}\u{43B}\u{430} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F}.`,
    dragDescriptionVirtual: `\u{429}\u{435}\u{43B}\u{43A}\u{43D}\u{438}\u{442}\u{435} \u{434}\u{43B}\u{44F} \u{43D}\u{430}\u{447}\u{430}\u{43B}\u{430} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F}.`,
    dragItem: (args) => `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{449}\u{438}\u{442}\u{44C} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{449}\u{438}\u{442}\u{44C} ${formatter.plural(args.count, {
        one: () =>
          `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{439} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
        other: () =>
          `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{445} \u{44D}\u{43B}\u{435}\u{43C}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} Enter \u{434}\u{43B}\u{44F} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{43E}\u{433}\u{43E} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{430}`,
          other: () =>
            `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{445} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432}`,
        },
      )}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} Alt + Enter \u{434}\u{43B}\u{44F} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{43E}\u{433}\u{43E} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{430}`,
          other: () =>
            `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{445} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432}`,
        },
      )}.`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{438} \u{443}\u{434}\u{435}\u{440}\u{436}\u{438}\u{432}\u{430}\u{439}\u{442}\u{435} \u{434}\u{43B}\u{44F} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{43E}\u{433}\u{43E} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{430}`,
          other: () =>
            `${formatter.number(args.count)} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{445} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432}`,
        },
      )}.`,
    dragStartedKeyboard: `\u{41D}\u{430}\u{447}\u{430}\u{442}\u{43E} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Tab \u{434}\u{43B}\u{44F} \u{432}\u{44B}\u{431}\u{43E}\u{440}\u{430} \u{446}\u{435}\u{43B}\u{438}, \u{437}\u{430}\u{442}\u{435}\u{43C} \u{43D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Enter, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43F}\u{440}\u{438}\u{43C}\u{435}\u{43D}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}, \u{438}\u{43B}\u{438} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Escape \u{434}\u{43B}\u{44F} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{44B} \u{434}\u{435}\u{439}\u{441}\u{442}\u{432}\u{438}\u{44F}.`,
    dragStartedTouch: `\u{41D}\u{430}\u{447}\u{430}\u{442}\u{43E} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{412}\u{44B}\u{431}\u{435}\u{440}\u{438}\u{442}\u{435} \u{446}\u{435}\u{43B}\u{44C}, \u{437}\u{430}\u{442}\u{435}\u{43C} \u{434}\u{432}\u{430}\u{436}\u{434}\u{44B} \u{43D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435}, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43F}\u{440}\u{438}\u{43C}\u{435}\u{43D}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}.`,
    dragStartedVirtual: `\u{41D}\u{430}\u{447}\u{430}\u{442}\u{43E} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Tab \u{434}\u{43B}\u{44F} \u{432}\u{44B}\u{431}\u{43E}\u{440}\u{430} \u{446}\u{435}\u{43B}\u{438}, \u{437}\u{430}\u{442}\u{435}\u{43C} \u{43D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Enter, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43F}\u{440}\u{438}\u{43C}\u{435}\u{43D}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}.`,
    dropCanceled: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{435}\u{43D}\u{43E}.`,
    dropComplete: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435} \u{437}\u{430}\u{432}\u{435}\u{440}\u{448}\u{435}\u{43D}\u{43E}.`,
    dropDescriptionKeyboard: `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Enter, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43F}\u{440}\u{438}\u{43C}\u{435}\u{43D}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Escape \u{434}\u{43B}\u{44F} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{44B}.`,
    dropDescriptionTouch: `\u{414}\u{432}\u{430}\u{436}\u{434}\u{44B} \u{43D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435}, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43F}\u{440}\u{438}\u{43C}\u{435}\u{43D}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}.`,
    dropDescriptionVirtual: `\u{429}\u{435}\u{43B}\u{43A}\u{43D}\u{438}\u{442}\u{435}, \u{447}\u{442}\u{43E}\u{431}\u{44B} \u{43F}\u{440}\u{438}\u{43C}\u{435}\u{43D}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}.`,
    dropIndicator: `\u{438}\u{43D}\u{434}\u{438}\u{43A}\u{430}\u{442}\u{43E}\u{440} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{44F}`,
    dropOnItem: (args) =>
      `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{449}\u{438}\u{442}\u{44C} \u{43D}\u{430} ${args.itemText}`,
    dropOnRoot: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{449}\u{438}\u{442}\u{44C} \u{43D}\u{430}`,
    endDragKeyboard: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{43A}\u{43B}\u{430}\u{432}\u{438}\u{448}\u{443} Enter \u{434}\u{43B}\u{44F} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{44B}.`,
    endDragTouch: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{414}\u{432}\u{430}\u{436}\u{434}\u{44B} \u{43D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{434}\u{43B}\u{44F} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{44B}.`,
    endDragVirtual: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{430}\u{441}\u{43A}\u{438}\u{432}\u{430}\u{43D}\u{438}\u{435}. \u{429}\u{435}\u{43B}\u{43A}\u{43D}\u{438}\u{442}\u{435} \u{434}\u{43B}\u{44F} \u{43E}\u{442}\u{43C}\u{435}\u{43D}\u{44B}.`,
    insertAfter: (args) =>
      `\u{412}\u{441}\u{442}\u{430}\u{432}\u{438}\u{442}\u{44C} \u{43F}\u{43E}\u{441}\u{43B}\u{435} ${args.itemText}`,
    insertBefore: (args) =>
      `\u{412}\u{441}\u{442}\u{430}\u{432}\u{438}\u{442}\u{44C} \u{43F}\u{435}\u{440}\u{435}\u{434} ${args.itemText}`,
    insertBetween: (args) =>
      `\u{412}\u{441}\u{442}\u{430}\u{432}\u{438}\u{442}\u{44C} \u{43C}\u{435}\u{436}\u{434}\u{443} ${args.beforeItemText} \u{438} ${args.afterItemText}`,
  },
  "sk-SK": {
    dragDescriptionKeyboard: `Stla\u{10D}en\xedm kl\xe1vesu Enter za\u{10D}nete pres\xfavanie.`,
    dragDescriptionKeyboardAlt: `Stla\u{10D}en\xedm kl\xe1vesov Alt + Enter za\u{10D}nete pres\xfavanie.`,
    dragDescriptionLongPress: `Dlh\xfdm stla\u{10D}en\xedm za\u{10D}nete pres\xfavanie.`,
    dragDescriptionTouch: `Dvojit\xfdm kliknut\xedm za\u{10D}nete pres\xfavanie.`,
    dragDescriptionVirtual: `Kliknut\xedm za\u{10D}nete pres\xfavanie.`,
    dragItem: (args) => `Presun\xfa\u{165} polo\u{17E}ku ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Presun\xfa\u{165} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybrat\xfa polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybrat\xe9 polo\u{17E}ky`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Stla\u{10D}en\xedm kl\xe1vesu Enter presuniete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybrat\xfa polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybrat\xfdch polo\u{17E}iek`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Stla\u{10D}en\xedm kl\xe1vesov Alt + Enter presuniete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybrat\xfa polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybrat\xfdch polo\u{17E}iek`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Dlh\xfdm stla\u{10D}en\xedm presuniete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} vybrat\xfa polo\u{17E}ku`,
        other: () => `${formatter.number(args.count)} vybrat\xfdch polo\u{17E}iek`,
      })}.`,
    dragStartedKeyboard: `Pres\xfavanie sa za\u{10D}alo. Do cie\u{13E}ov\xe9ho umiestnenia prejdete stla\u{10D}en\xedm kl\xe1vesu Tab. Ak chcete polo\u{17E}ku umiestni\u{165}, stla\u{10D}te kl\xe1ves Enter alebo stla\u{10D}te kl\xe1ves Esc, ak chcete pres\xfavanie zru\u{161}i\u{165}.`,
    dragStartedTouch: `Pres\xfavanie sa za\u{10D}alo. Prejdite na cie\u{13E}ov\xe9 umiestnenie a dvojit\xfdm kliknut\xedm umiestnite polo\u{17E}ku.`,
    dragStartedVirtual: `Pres\xfavanie sa za\u{10D}alo. Prejdite na cie\u{13E}ov\xe9 umiestnenie a kliknut\xedm alebo stla\u{10D}en\xedm kl\xe1vesu Enter umiestnite polo\u{17E}ku.`,
    dropCanceled: `Umiestnenie zru\u{161}en\xe9.`,
    dropComplete: `Umiestnenie dokon\u{10D}en\xe9.`,
    dropDescriptionKeyboard: `Stla\u{10D}en\xedm kl\xe1vesu Enter umiestnite polo\u{17E}ku. Stla\u{10D}en\xedm kl\xe1vesu Esc zru\u{161}\xedte pres\xfavanie.`,
    dropDescriptionTouch: `Dvojit\xfdm kliknut\xedm umiestnite polo\u{17E}ku.`,
    dropDescriptionVirtual: `Kliknut\xedm umiestnite polo\u{17E}ku.`,
    dropIndicator: `indik\xe1tor umiestnenia`,
    dropOnItem: (args) => `Umiestni\u{165} na polo\u{17E}ku ${args.itemText}`,
    dropOnRoot: `Umiestni\u{165} na`,
    endDragKeyboard: `Prebieha pres\xfavanie. Ak ho chcete zru\u{161}i\u{165}, stla\u{10D}te kl\xe1ves Enter.`,
    endDragTouch: `Prebieha pres\xfavanie. Dvojit\xfdm kliknut\xedm ho m\xf4\u{17E}ete zru\u{161}i\u{165}.`,
    endDragVirtual: `Prebieha pres\xfavanie.`,
    insertAfter: (args) => `Vlo\u{17E}i\u{165} za polo\u{17E}ku ${args.itemText}`,
    insertBefore: (args) => `Vlo\u{17E}i\u{165} pred polo\u{17E}ku ${args.itemText}`,
    insertBetween: (args) => `Vlo\u{17E}i\u{165} medzi polo\u{17E}ky ${args.beforeItemText} a ${args.afterItemText}`,
  },
  "sl-SI": {
    dragDescriptionKeyboard: `Pritisnite tipko Enter za za\u{10D}etek vle\u{10D}enja.`,
    dragDescriptionKeyboardAlt: `Pritisnite tipki Alt + Enter za za\u{10D}etek vle\u{10D}enja.`,
    dragDescriptionLongPress: `Pritisnite in zadr\u{17E}ite za za\u{10D}etek vle\u{10D}enja.`,
    dragDescriptionTouch: `Dvotapnite za za\u{10D}etek vle\u{10D}enja.`,
    dragDescriptionVirtual: `Kliknite za za\u{10D}etek vle\u{10D}enja.`,
    dragItem: (args) => `Povleci ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Povlecite ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izbran element`,
        other: () => `izbrane elemente (${formatter.number(args.count)})`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Pritisnite tipko Enter, da povle\u{10D}ete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izbrani element`,
        other: () => `${formatter.number(args.count)} izbranih elementov`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Pritisnite tipki Alt + Enter, da povle\u{10D}ete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izbrani element`,
        other: () => `${formatter.number(args.count)} izbranih elementov`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Pritisnite in zadr\u{17E}ite, da povle\u{10D}ete ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izbrani element`,
        other: () => `${formatter.number(args.count)} izbranih elementov`,
      })}.`,
    dragStartedKeyboard: `Vle\u{10D}enje se je za\u{10D}elo. Pritisnite tipko Tab za pomik na mesto, kamor \u{17E}elite spustiti elemente, in pritisnite tipko Enter, da jih spustite, ali tipko Escape, da prekli\u{10D}ete postopek.`,
    dragStartedTouch: `Vle\u{10D}enje se je za\u{10D}elo. Pomaknite se na mesto, kamor \u{17E}elite spustiti elemente, in dvotapnite, da jih spustite.`,
    dragStartedVirtual: `Vle\u{10D}enje se je za\u{10D}elo. Pomaknite se na mesto, kamor \u{17E}elite spustiti elemente, in kliknite ali pritisnite tipko Enter, da jih spustite.`,
    dropCanceled: `Spust je preklican.`,
    dropComplete: `Spust je kon\u{10D}an.`,
    dropDescriptionKeyboard: `Pritisnite tipko Enter, da spustite. Pritisnite tipko Escape, da prekli\u{10D}ete vle\u{10D}enje.`,
    dropDescriptionTouch: `Dvotapnite, da spustite.`,
    dropDescriptionVirtual: `Kliknite, da spustite.`,
    dropIndicator: `indikator spusta`,
    dropOnItem: (args) => `Spusti na mesto ${args.itemText}`,
    dropOnRoot: `Spusti na mesto`,
    endDragKeyboard: `Vle\u{10D}enje. Pritisnite tipko Enter za preklic vle\u{10D}enja.`,
    endDragTouch: `Vle\u{10D}enje. Dvotapnite za preklic vle\u{10D}enja.`,
    endDragVirtual: `Vle\u{10D}enje. Kliknite, da prekli\u{10D}ete vle\u{10D}enje.`,
    insertAfter: (args) => `Vstavi za ${args.itemText}`,
    insertBefore: (args) => `Vstavi pred ${args.itemText}`,
    insertBetween: (args) => `Vstavi med ${args.beforeItemText} in ${args.afterItemText}`,
  },
  "sr-SP": {
    dragDescriptionKeyboard: `Pritisnite Enter da biste zapo\u{10D}eli prevla\u{10D}enje.`,
    dragDescriptionKeyboardAlt: `Pritisnite Alt + Enter da biste zapo\u{10D}eli prevla\u{10D}enje.`,
    dragDescriptionLongPress: `Pritisnite dugo da biste zapo\u{10D}eli prevla\u{10D}enje.`,
    dragDescriptionTouch: `Dvaput dodirnite da biste zapo\u{10D}eli prevla\u{10D}enje.`,
    dragDescriptionVirtual: `Kliknite da biste zapo\u{10D}eli prevla\u{10D}enje.`,
    dragItem: (args) => `Prevucite ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Prevucite ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izabranu stavku`,
        other: () => `${formatter.number(args.count)} izabrane stavke`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Pritisnite Enter da biste prevukli ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izabranu stavku`,
        other: () => `${formatter.number(args.count)} izabranih stavki`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Pritisnite Alt + Enter da biste prevukli ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izabranu stavku`,
        other: () => `${formatter.number(args.count)} izabranih stavki`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Pritisnite dugo da biste prevukli ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} izabranu stavku`,
        other: () => `${formatter.number(args.count)} izabranih stavki`,
      })}.`,
    dragStartedKeyboard: `Prevla\u{10D}enje je zapo\u{10D}eto. Pritisnite Tab da biste oti\u{161}li do cilja za otpu\u{161}tanje, zatim pritisnite Enter za ispu\u{161}tanje ili pritisnite Escape za otkazivanje.`,
    dragStartedTouch: `Prevla\u{10D}enje je zapo\u{10D}eto. Idite do cilja za otpu\u{161}tanje, a zatim dvaput dodirnite za otpu\u{161}tanje.`,
    dragStartedVirtual: `Prevla\u{10D}enje je zapo\u{10D}eto. Idite do cilja za otpu\u{161}tanje, a zatim kliknite ili pritinite Enter za otpu\u{161}tanje.`,
    dropCanceled: `Otpu\u{161}tanje je otkazano.`,
    dropComplete: `Prevla\u{10D}enje je zavr\u{161}eno.`,
    dropDescriptionKeyboard: `Pritisnite Enter da biste otpustili. Pritisnite Escape da biste otkazali prevla\u{10D}enje.`,
    dropDescriptionTouch: `Dvaput dodirnite za otpu\u{161}tanje.`,
    dropDescriptionVirtual: `Kliknite za otpu\u{161}tanje.`,
    dropIndicator: `Indikator otpu\u{161}tanja`,
    dropOnItem: (args) => `Otpusti na ${args.itemText}`,
    dropOnRoot: `Otpusti na`,
    endDragKeyboard: `Prevla\u{10D}enje u toku. Pritisnite Enter da biste otkazali prevla\u{10D}enje.`,
    endDragTouch: `Prevla\u{10D}enje u toku. Dvaput dodirnite da biste otkazali prevla\u{10D}enje.`,
    endDragVirtual: `Prevla\u{10D}enje u toku. Kliknite da biste otkazali prevla\u{10D}enje.`,
    insertAfter: (args) => `Umetnite posle ${args.itemText}`,
    insertBefore: (args) => `Umetnite ispred ${args.itemText}`,
    insertBetween: (args) => `Umetnite izme\u{111}u ${args.beforeItemText} i ${args.afterItemText}`,
  },
  "sv-SE": {
    dragDescriptionKeyboard: `Tryck p\xe5 enter f\xf6r att b\xf6rja dra.`,
    dragDescriptionKeyboardAlt: `Tryck p\xe5 Alt + Retur f\xf6r att b\xf6rja dra.`,
    dragDescriptionLongPress: `Tryck l\xe4nge f\xf6r att b\xf6rja dra.`,
    dragDescriptionTouch: `Dubbeltryck f\xf6r att b\xf6rja dra.`,
    dragDescriptionVirtual: `Klicka f\xf6r att b\xf6rja dra.`,
    dragItem: (args) => `Dra ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `Dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} valt objekt`,
        other: () => `${formatter.number(args.count)} valda objekt`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `Tryck p\xe5 Retur f\xf6r att dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} markerat objekt`,
        other: () => `${formatter.number(args.count)} markerade objekt`,
      })}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `Tryck p\xe5 Alt + Retur f\xf6r att dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} markerat objekt`,
        other: () => `${formatter.number(args.count)} markerade objekt`,
      })}.`,
    dragSelectedLongPress: (args, formatter) =>
      `Tryck l\xe4nge f\xf6r att dra ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} markerat objekt`,
        other: () => `${formatter.number(args.count)} markerade objekt`,
      })}.`,
    dragStartedKeyboard: `B\xf6rja dra. Tryck p\xe5 tabb f\xf6r att navigera till m\xe5let, tryck p\xe5 enter f\xf6r att sl\xe4ppa eller p\xe5 escape f\xf6r att avbryta.`,
    dragStartedTouch: `B\xf6rja dra. Navigera till ett m\xe5l och dubbeltryck f\xf6r att sl\xe4ppa.`,
    dragStartedVirtual: `B\xf6rja dra. Navigera till ett m\xe5l och klicka eller tryck p\xe5 enter f\xf6r att sl\xe4ppa.`,
    dropCanceled: `Sl\xe4pp\xe5tg\xe4rd avbr\xf6ts.`,
    dropComplete: `Sl\xe4pp\xe5tg\xe4rd klar.`,
    dropDescriptionKeyboard: `Tryck p\xe5 enter f\xf6r att sl\xe4ppa. Tryck p\xe5 escape f\xf6r att avbryta drag\xe5tg\xe4rd.`,
    dropDescriptionTouch: `Dubbeltryck f\xf6r att sl\xe4ppa.`,
    dropDescriptionVirtual: `Klicka f\xf6r att sl\xe4ppa.`,
    dropIndicator: `sl\xe4ppindikator`,
    dropOnItem: (args) => `Sl\xe4pp p\xe5 ${args.itemText}`,
    dropOnRoot: `Sl\xe4pp p\xe5`,
    endDragKeyboard: `Drar. Tryck p\xe5 enter f\xf6r att avbryta drag\xe5tg\xe4rd.`,
    endDragTouch: `Drar. Dubbeltryck f\xf6r att avbryta drag\xe5tg\xe4rd.`,
    endDragVirtual: `Drar. Klicka f\xf6r att avbryta drag\xe5tg\xe4rd.`,
    insertAfter: (args) => `Infoga efter ${args.itemText}`,
    insertBefore: (args) => `Infoga f\xf6re ${args.itemText}`,
    insertBetween: (args) => `Infoga mellan ${args.beforeItemText} och ${args.afterItemText}`,
  },
  "tr-TR": {
    dragDescriptionKeyboard: `S\xfcr\xfcklemeyi ba\u{15F}latmak i\xe7in Enter'a bas\u{131}n.`,
    dragDescriptionKeyboardAlt: `S\xfcr\xfcklemeyi ba\u{15F}latmak i\xe7in Alt + Enter'a bas\u{131}n.`,
    dragDescriptionLongPress: `S\xfcr\xfcklemeye ba\u{15F}lamak i\xe7in uzun bas\u{131}n.`,
    dragDescriptionTouch: `S\xfcr\xfcklemeyi ba\u{15F}latmak i\xe7in \xe7ift t\u{131}klay\u{131}n.`,
    dragDescriptionVirtual: `S\xfcr\xfcklemeyi ba\u{15F}latmak i\xe7in t\u{131}klay\u{131}n.`,
    dragItem: (args) => `${args.itemText}\u{2019}i s\xfcr\xfckle`,
    dragSelectedItems: (args, formatter) =>
      `S\xfcr\xfckle ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} se\xe7ili \xf6ge`,
        other: () => `${formatter.number(args.count)} se\xe7ili \xf6ge`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} se\xe7ilmi\u{15F} \xf6\u{11F}e`,
        other: () => `${formatter.number(args.count)} se\xe7ilmi\u{15F} \xf6\u{11F}e`,
      })} \xf6\u{11F}esini s\xfcr\xfcklemek i\xe7in Enter'a bas\u{131}n.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} se\xe7ilmi\u{15F} \xf6\u{11F}e`,
        other: () => `${formatter.number(args.count)} se\xe7ilmi\u{15F} \xf6\u{11F}e`,
      })} \xf6\u{11F}esini s\xfcr\xfcklemek i\xe7in Alt + Enter tu\u{15F}una bas\u{131}n.`,
    dragSelectedLongPress: (args, formatter) =>
      `${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} se\xe7ilmi\u{15F} \xf6\u{11F}e`,
        other: () => `${formatter.number(args.count)} se\xe7ilmi\u{15F} \xf6\u{11F}e`,
      })} \xf6\u{11F}esini s\xfcr\xfcklemek i\xe7in uzun bas\u{131}n.`,
    dragStartedKeyboard: `S\xfcr\xfckleme ba\u{15F}lat\u{131}ld\u{131}. Bir b\u{131}rakma hedefine gitmek i\xe7in Tab\u{2019}a bas\u{131}n, ard\u{131}ndan b\u{131}rakmak i\xe7in Enter\u{2019}a bas\u{131}n veya iptal etmek i\xe7in Escape\u{2019}e bas\u{131}n.`,
    dragStartedTouch: `S\xfcr\xfckleme ba\u{15F}lat\u{131}ld\u{131}. Bir b\u{131}rakma hedefine gidin, ard\u{131}ndan b\u{131}rakmak i\xe7in \xe7ift t\u{131}klay\u{131}n.`,
    dragStartedVirtual: `S\xfcr\xfckleme ba\u{15F}lat\u{131}ld\u{131}. Bir b\u{131}rakma hedefine gidin, ard\u{131}ndan b\u{131}rakmak i\xe7in Enter\u{2019}a t\u{131}klay\u{131}n veya bas\u{131}n.`,
    dropCanceled: `B\u{131}rakma iptal edildi.`,
    dropComplete: `B\u{131}rakma tamamland\u{131}.`,
    dropDescriptionKeyboard: `B\u{131}rakmak i\xe7in Enter'a bas\u{131}n. S\xfcr\xfcklemeyi iptal etmek i\xe7in Escape'e bas\u{131}n.`,
    dropDescriptionTouch: `B\u{131}rakmak i\xe7in \xe7ift t\u{131}klay\u{131}n.`,
    dropDescriptionVirtual: `B\u{131}rakmak i\xe7in t\u{131}klay\u{131}n.`,
    dropIndicator: `b\u{131}rakma g\xf6stergesi`,
    dropOnItem: (args) => `${args.itemText} \xfczerine b\u{131}rak`,
    dropOnRoot: `B\u{131}rak\u{131}n`,
    endDragKeyboard: `S\xfcr\xfckleme. S\xfcr\xfcklemeyi iptal etmek i\xe7in Enter'a bas\u{131}n.`,
    endDragTouch: `S\xfcr\xfckleme. S\xfcr\xfcklemeyi iptal etmek i\xe7in \xe7ift t\u{131}klay\u{131}n.`,
    endDragVirtual: `S\xfcr\xfckleme. S\xfcr\xfcklemeyi iptal etmek i\xe7in t\u{131}klay\u{131}n.`,
    insertAfter: (args) => `${args.itemText}\u{2019}den sonra gir`,
    insertBefore: (args) => `${args.itemText}\u{2019}den \xf6nce gir`,
    insertBetween: (args) => `${args.beforeItemText} ve ${args.afterItemText} aras\u{131}na gir`,
  },
  "uk-UA": {
    dragDescriptionKeyboard: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Enter, \u{449}\u{43E}\u{431} \u{43F}\u{43E}\u{447}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    dragDescriptionKeyboardAlt: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Alt + Enter, \u{449}\u{43E}\u{431} \u{43F}\u{43E}\u{447}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    dragDescriptionLongPress: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} \u{456} \u{443}\u{442}\u{440}\u{438}\u{43C}\u{443}\u{439}\u{442}\u{435}, \u{449}\u{43E}\u{431} \u{43F}\u{43E}\u{447}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    dragDescriptionTouch: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} \u{434}\u{432}\u{456}\u{447}\u{456}, \u{449}\u{43E}\u{431} \u{43F}\u{43E}\u{447}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    dragDescriptionVirtual: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C}, \u{449}\u{43E}\u{431} \u{43F}\u{43E}\u{447}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    dragItem: (args) =>
      `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{456}\u{442}\u{44C} ${formatter.plural(args.count, {
        one: () =>
          `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{439} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
        other: () =>
          `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{445} \u{435}\u{43B}\u{435}\u{43C}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Enter, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{439} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
          other: () =>
            `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{445} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}(-\u{456}\u{432})`,
        },
      )}.`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Alt + Enter, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{439} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
          other: () =>
            `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{445} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}(-\u{456}\u{432})`,
        },
      )}.`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{423}\u{442}\u{440}\u{438}\u{43C}\u{443}\u{439}\u{442}\u{435}, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438} ${formatter.plural(
        args.count,
        {
          one: () =>
            `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{439} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
          other: () =>
            `${formatter.number(args.count)} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{438}\u{445} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}(-\u{456}\u{432})`,
        },
      )}.`,
    dragStartedKeyboard: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F} \u{43F}\u{43E}\u{447}\u{430}\u{43B}\u{43E}\u{441}\u{44F}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Tab, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{439}\u{442}\u{438} \u{434}\u{43E} \u{446}\u{456}\u{43B}\u{456} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}, \u{43F}\u{43E}\u{442}\u{456}\u{43C} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Enter, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438}, \u{430}\u{431}\u{43E} Escape, \u{449}\u{43E}\u{431} \u{441}\u{43A}\u{430}\u{441}\u{443}\u{432}\u{430}\u{442}\u{438}.`,
    dragStartedTouch: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F} \u{43F}\u{43E}\u{447}\u{430}\u{43B}\u{43E}\u{441}\u{44F}. \u{41F}\u{435}\u{440}\u{435}\u{439}\u{434}\u{456}\u{442}\u{44C} \u{434}\u{43E} \u{446}\u{456}\u{43B}\u{456} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}, \u{43F}\u{43E}\u{442}\u{456}\u{43C} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} \u{434}\u{432}\u{456}\u{447}\u{456}, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438}.`,
    dragStartedVirtual: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F} \u{43F}\u{43E}\u{447}\u{430}\u{43B}\u{43E}\u{441}\u{44F}. \u{41F}\u{435}\u{440}\u{435}\u{439}\u{434}\u{456}\u{442}\u{44C} \u{434}\u{43E} \u{446}\u{456}\u{43B}\u{456} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}, \u{43F}\u{43E}\u{442}\u{456}\u{43C} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Enter, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438}.`,
    dropCanceled: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F} \u{441}\u{43A}\u{430}\u{441}\u{43E}\u{432}\u{430}\u{43D}\u{43E}.`,
    dropComplete: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F} \u{437}\u{430}\u{432}\u{435}\u{440}\u{448}\u{435}\u{43D}\u{43E}.`,
    dropDescriptionKeyboard: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Enter, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Escape, \u{449}\u{43E}\u{431} \u{441}\u{43A}\u{430}\u{441}\u{443}\u{432}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    dropDescriptionTouch: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} \u{434}\u{432}\u{456}\u{447}\u{456}, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438}.`,
    dropDescriptionVirtual: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C}, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438}.`,
    dropIndicator: `\u{456}\u{43D}\u{434}\u{438}\u{43A}\u{430}\u{442}\u{43E}\u{440} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}`,
    dropOnItem: (args) =>
      `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438} \u{43D}\u{430} ${args.itemText}`,
    dropOnRoot: `\u{41F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{43D}\u{443}\u{442}\u{438} \u{43D}\u{430}`,
    endDragKeyboard: `\u{422}\u{440}\u{438}\u{432}\u{430}\u{454} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} Enter, \u{449}\u{43E}\u{431} \u{441}\u{43A}\u{430}\u{441}\u{443}\u{432}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    endDragTouch: `\u{422}\u{440}\u{438}\u{432}\u{430}\u{454} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C} \u{434}\u{432}\u{456}\u{447}\u{456}, \u{449}\u{43E}\u{431} \u{441}\u{43A}\u{430}\u{441}\u{443}\u{432}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    endDragVirtual: `\u{422}\u{440}\u{438}\u{432}\u{430}\u{454} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}. \u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{456}\u{442}\u{44C}, \u{449}\u{43E}\u{431} \u{441}\u{43A}\u{430}\u{441}\u{443}\u{432}\u{430}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{442}\u{44F}\u{433}\u{443}\u{432}\u{430}\u{43D}\u{43D}\u{44F}.`,
    insertAfter: (args) =>
      `\u{412}\u{441}\u{442}\u{430}\u{432}\u{438}\u{442}\u{438} \u{43F}\u{456}\u{441}\u{43B}\u{44F} ${args.itemText}`,
    insertBefore: (args) =>
      `\u{412}\u{441}\u{442}\u{430}\u{432}\u{438}\u{442}\u{438} \u{43F}\u{435}\u{440}\u{435}\u{434} ${args.itemText}`,
    insertBetween: (args) =>
      `\u{412}\u{441}\u{442}\u{430}\u{432}\u{438}\u{442}\u{438} \u{43C}\u{456}\u{436} ${args.beforeItemText} \u{456} ${args.afterItemText}`,
  },
  "zh-CN": {
    dragDescriptionKeyboard: `\u{6309} Enter \u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}`,
    dragDescriptionKeyboardAlt: `\u{6309} Alt + Enter \u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}`,
    dragDescriptionLongPress: `\u{957F}\u{6309}\u{4EE5}\u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}`,
    dragDescriptionTouch: `\u{53CC}\u{51FB}\u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}`,
    dragDescriptionVirtual: `\u{5355}\u{51FB}\u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}`,
    dragItem: (args) => `\u{62D6}\u{52A8} ${args.itemText}`,
    dragSelectedItems: (args, formatter) =>
      `\u{62D6}\u{52A8} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{9009}\u{4E2D}\u{9879}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{9009}\u{4E2D}\u{9879}\u{76EE}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{6309} Enter \u{4EE5}\u{62D6}\u{52A8} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{4E2A}\u{9009}\u{5B9A}\u{9879}`,
        other: () => `${formatter.number(args.count)} \u{4E2A}\u{9009}\u{5B9A}\u{9879}`,
      })}\u{3002}`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{6309} Alt + Enter \u{4EE5}\u{62D6}\u{52A8} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{4E2A}\u{9009}\u{5B9A}\u{9879}`,
        other: () => `${formatter.number(args.count)} \u{4E2A}\u{9009}\u{5B9A}\u{9879}`,
      })}\u{3002}`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{957F}\u{6309}\u{4EE5}\u{62D6}\u{52A8} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{4E2A}\u{9009}\u{5B9A}\u{9879}`,
        other: () => `${formatter.number(args.count)} \u{4E2A}\u{9009}\u{5B9A}\u{9879}`,
      })}\u{3002}`,
    dragStartedKeyboard: `\u{5DF2}\u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}\u{6309} Tab \u{5BFC}\u{822A}\u{5230}\u{653E}\u{7F6E}\u{76EE}\u{6807}\u{FF0C}\u{7136}\u{540E}\u{6309} Enter \u{653E}\u{7F6E}\u{6216}\u{6309} Escape \u{53D6}\u{6D88}\u{3002}`,
    dragStartedTouch: `\u{5DF2}\u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}\u{5BFC}\u{822A}\u{5230}\u{653E}\u{7F6E}\u{76EE}\u{6807}\u{FF0C}\u{7136}\u{540E}\u{53CC}\u{51FB}\u{653E}\u{7F6E}\u{3002}`,
    dragStartedVirtual: `\u{5DF2}\u{5F00}\u{59CB}\u{62D6}\u{52A8}\u{3002}\u{5BFC}\u{822A}\u{5230}\u{653E}\u{7F6E}\u{76EE}\u{6807}\u{FF0C}\u{7136}\u{540E}\u{5355}\u{51FB}\u{6216}\u{6309} Enter \u{653E}\u{7F6E}\u{3002}`,
    dropCanceled: `\u{653E}\u{7F6E}\u{5DF2}\u{53D6}\u{6D88}\u{3002}`,
    dropComplete: `\u{653E}\u{7F6E}\u{5DF2}\u{5B8C}\u{6210}\u{3002}`,
    dropDescriptionKeyboard: `\u{6309} Enter \u{653E}\u{7F6E}\u{3002}\u{6309} Escape \u{53D6}\u{6D88}\u{62D6}\u{52A8}\u{3002}`,
    dropDescriptionTouch: `\u{53CC}\u{51FB}\u{653E}\u{7F6E}\u{3002}`,
    dropDescriptionVirtual: `\u{5355}\u{51FB}\u{653E}\u{7F6E}\u{3002}`,
    dropIndicator: `\u{653E}\u{7F6E}\u{6807}\u{8BB0}`,
    dropOnItem: (args) => `\u{653E}\u{7F6E}\u{4E8E} ${args.itemText}`,
    dropOnRoot: `\u{653E}\u{7F6E}\u{4E8E}`,
    endDragKeyboard: `\u{6B63}\u{5728}\u{62D6}\u{52A8}\u{3002}\u{6309} Enter \u{53D6}\u{6D88}\u{62D6}\u{52A8}\u{3002}`,
    endDragTouch: `\u{6B63}\u{5728}\u{62D6}\u{52A8}\u{3002}\u{53CC}\u{51FB}\u{53D6}\u{6D88}\u{62D6}\u{52A8}\u{3002}`,
    endDragVirtual: `\u{6B63}\u{5728}\u{62D6}\u{52A8}\u{3002}\u{5355}\u{51FB}\u{53D6}\u{6D88}\u{62D6}\u{52A8}\u{3002}`,
    insertAfter: (args) => `\u{63D2}\u{5165}\u{5230} ${args.itemText} \u{4E4B}\u{540E}`,
    insertBefore: (args) => `\u{63D2}\u{5165}\u{5230} ${args.itemText} \u{4E4B}\u{524D}`,
    insertBetween: (args) =>
      `\u{63D2}\u{5165}\u{5230} ${args.beforeItemText} \u{548C} ${args.afterItemText} \u{4E4B}\u{95F4}`,
  },
  "zh-TW": {
    dragDescriptionKeyboard: `\u{6309} Enter \u{9375}\u{4EE5}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}`,
    dragDescriptionKeyboardAlt: `\u{6309} Alt+Enter \u{9375}\u{4EE5}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}`,
    dragDescriptionLongPress: `\u{9577}\u{6309}\u{4EE5}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}`,
    dragDescriptionTouch: `\u{8F15}\u{9EDE}\u{5169}\u{4E0B}\u{4EE5}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}`,
    dragDescriptionVirtual: `\u{6309}\u{4E00}\u{4E0B}\u{6ED1}\u{9F20}\u{4EE5}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}`,
    dragItem: (args) => `\u{62D6}\u{66F3}\u{300C}${args.itemText}\u{300D}`,
    dragSelectedItems: (args, formatter) =>
      `\u{62D6}\u{66F3} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
      })}`,
    dragSelectedKeyboard: (args, formatter) =>
      `\u{6309} Enter \u{9375}\u{4EE5}\u{62D6}\u{66F3} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
      })}\u{3002}`,
    dragSelectedKeyboardAlt: (args, formatter) =>
      `\u{6309} Alt+Enter \u{9375}\u{4EE5}\u{62D6}\u{66F3} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
      })}\u{3002}`,
    dragSelectedLongPress: (args, formatter) =>
      `\u{9577}\u{6309}\u{4EE5}\u{62D6}\u{66F3} ${formatter.plural(args.count, {
        one: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
        other: () => `${formatter.number(args.count)} \u{500B}\u{9078}\u{5B9A}\u{9805}\u{76EE}`,
      })}\u{3002}`,
    dragStartedKeyboard: `\u{5DF2}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}\u{6309} Tab \u{9375}\u{4EE5}\u{700F}\u{89BD}\u{81F3}\u{653E}\u{7F6E}\u{76EE}\u{6A19}\u{FF0C}\u{7136}\u{5F8C}\u{6309} Enter \u{9375}\u{4EE5}\u{653E}\u{7F6E}\u{FF0C}\u{6216}\u{6309} Escape \u{9375}\u{4EE5}\u{53D6}\u{6D88}\u{3002}`,
    dragStartedTouch: `\u{5DF2}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}\u{700F}\u{89BD}\u{81F3}\u{653E}\u{7F6E}\u{76EE}\u{6A19}\u{FF0C}\u{7136}\u{5F8C}\u{8F15}\u{9EDE}\u{5169}\u{4E0B}\u{4EE5}\u{653E}\u{7F6E}\u{3002}`,
    dragStartedVirtual: `\u{5DF2}\u{958B}\u{59CB}\u{62D6}\u{66F3}\u{3002}\u{700F}\u{89BD}\u{81F3}\u{653E}\u{7F6E}\u{76EE}\u{6A19}\u{FF0C}\u{7136}\u{5F8C}\u{6309}\u{4E00}\u{4E0B}\u{6ED1}\u{9F20}\u{6216}\u{6309} Enter \u{9375}\u{4EE5}\u{653E}\u{7F6E}\u{3002}`,
    dropCanceled: `\u{653E}\u{7F6E}\u{5DF2}\u{53D6}\u{6D88}\u{3002}`,
    dropComplete: `\u{653E}\u{7F6E}\u{5DF2}\u{5B8C}\u{6210}\u{3002}`,
    dropDescriptionKeyboard: `\u{6309} Enter \u{9375}\u{4EE5}\u{653E}\u{7F6E}\u{3002}\u{6309} Escape \u{9375}\u{4EE5}\u{53D6}\u{6D88}\u{62D6}\u{66F3}\u{3002}`,
    dropDescriptionTouch: `\u{8F15}\u{9EDE}\u{5169}\u{4E0B}\u{4EE5}\u{653E}\u{7F6E}\u{3002}`,
    dropDescriptionVirtual: `\u{6309}\u{4E00}\u{4E0B}\u{6ED1}\u{9F20}\u{4EE5}\u{653E}\u{7F6E}\u{3002}`,
    dropIndicator: `\u{653E}\u{7F6E}\u{6307}\u{793A}\u{5668}`,
    dropOnItem: (args) => `\u{653E}\u{7F6E}\u{5728}\u{300C}${args.itemText}\u{300D}\u{4E0A}`,
    dropOnRoot: `\u{653E}\u{7F6E}\u{5728}`,
    endDragKeyboard: `\u{62D6}\u{66F3}\u{4E2D}\u{3002}\u{6309} Enter \u{9375}\u{4EE5}\u{53D6}\u{6D88}\u{62D6}\u{66F3}\u{3002}`,
    endDragTouch: `\u{62D6}\u{66F3}\u{4E2D}\u{3002}\u{8F15}\u{9EDE}\u{5169}\u{4E0B}\u{4EE5}\u{53D6}\u{6D88}\u{62D6}\u{66F3}\u{3002}`,
    endDragVirtual: `\u{62D6}\u{66F3}\u{4E2D}\u{3002}\u{6309}\u{4E00}\u{4E0B}\u{6ED1}\u{9F20}\u{4EE5}\u{53D6}\u{6D88}\u{62D6}\u{66F3}\u{3002}`,
    insertAfter: (args) => `\u{63D2}\u{5165}\u{81F3}\u{300C}${args.itemText}\u{300D}\u{4E4B}\u{5F8C}`,
    insertBefore: (args) => `\u{63D2}\u{5165}\u{81F3}\u{300C}${args.itemText}\u{300D}\u{4E4B}\u{524D}`,
    insertBetween: (args) =>
      `\u{63D2}\u{5165}\u{81F3}\u{300C}${args.beforeItemText}\u{300D}\u{548C}\u{300C}${args.afterItemText}\u{300D}\u{4E4B}\u{9593}`,
  },
}
