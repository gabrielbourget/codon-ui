/* Copyright 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
/* Pinned react-aria3.48.0 grid messages; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
export type TNativeTagSelectionMessageKey = "selectedItem" | "deselectedItem" | "selectedCount" | "selectedAll"
export type TNativeTagSelectionMessageArguments = { item: string; count: number }
export type TNativeTagSelectionFormatter = {
  number: (value: number) => string
  plural: (count: number, cases: Record<string, string | (() => string)>) => string
}
type TMessage =
  | string
  | ((args: TNativeTagSelectionMessageArguments, formatter: TNativeTagSelectionFormatter) => string)
export const nativeTagSelectionMessages: Record<string, Record<TNativeTagSelectionMessageKey, TMessage>> = {
  "ar-AE": {
    deselectedItem: (args) => `${args.item} \u{63A}\u{64A}\u{631} \u{627}\u{644}\u{645}\u{62D}\u{62F}\u{62F}`,
    selectedAll: `\u{62C}\u{645}\u{64A}\u{639} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62D}\u{62F}\u{62F}\u{629}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{644}\u{645} \u{64A}\u{62A}\u{645} \u{62A}\u{62D}\u{62F}\u{64A}\u{62F} \u{639}\u{646}\u{627}\u{635}\u{631}`,
        one: () => `${formatter.number(args.count)} \u{639}\u{646}\u{635}\u{631} \u{645}\u{62D}\u{62F}\u{62F}`,
        other: () => `${formatter.number(args.count)} \u{639}\u{646}\u{635}\u{631} \u{645}\u{62D}\u{62F}\u{62F}`,
      })}.`,
    selectedItem: (args) => `${args.item} \u{627}\u{644}\u{645}\u{62D}\u{62F}\u{62F}`,
  },
  "bg-BG": {
    deselectedItem: (args) => `${args.item} \u{43D}\u{435} \u{435} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}.`,
    selectedAll: `\u{412}\u{441}\u{438}\u{447}\u{43A}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438} \u{441}\u{430} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{41D}\u{44F}\u{43C}\u{430} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
        one: () =>
          `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
        other: () =>
          `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
      })}.`,
    selectedItem: (args) => `${args.item} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}.`,
  },
  "cs-CZ": {
    deselectedItem: (args) => `Polo\u{17E}ka ${args.item} nen\xed vybr\xe1na.`,
    selectedAll: `Vybr\xe1ny v\u{161}echny polo\u{17E}ky.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nevybr\xe1ny \u{17E}\xe1dn\xe9 polo\u{17E}ky`,
        one: () => `Vybr\xe1na ${formatter.number(args.count)} polo\u{17E}ka`,
        other: () => `Vybr\xe1no ${formatter.number(args.count)} polo\u{17E}ek`,
      })}.`,
    selectedItem: (args) => `Vybr\xe1na polo\u{17E}ka ${args.item}.`,
  },
  "da-DK": {
    deselectedItem: (args) => `${args.item} ikke valgt.`,
    selectedAll: `Alle elementer valgt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ingen elementer valgt`,
        one: () => `${formatter.number(args.count)} element valgt`,
        other: () => `${formatter.number(args.count)} elementer valgt`,
      })}.`,
    selectedItem: (args) => `${args.item} valgt.`,
  },
  "de-DE": {
    deselectedItem: (args) => `${args.item} nicht ausgew\xe4hlt.`,
    selectedAll: `Alle Elemente ausgew\xe4hlt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Keine Elemente ausgew\xe4hlt`,
        one: () => `${formatter.number(args.count)} Element ausgew\xe4hlt`,
        other: () => `${formatter.number(args.count)} Elemente ausgew\xe4hlt`,
      })}.`,
    selectedItem: (args) => `${args.item} ausgew\xe4hlt.`,
  },
  "el-GR": {
    deselectedItem: (args) =>
      `\u{394}\u{3B5}\u{3BD} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B5} \u{3C4}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF} ${args.item}.`,
    selectedAll: `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B1}\u{3BD} \u{3CC}\u{3BB}\u{3B1} \u{3C4}\u{3B1} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{394}\u{3B5}\u{3BD} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B1}\u{3BD} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
        one: () =>
          `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B5} ${formatter.number(args.count)} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF}`,
        other: () =>
          `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B1}\u{3BD} ${formatter.number(args.count)} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
      })}.`,
    selectedItem: (args) =>
      `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B5} \u{3C4}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF} ${args.item}.`,
  },
  "en-US": {
    deselectedItem: (args) => `${args.item} not selected.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `No items selected`,
        one: () => `${formatter.number(args.count)} item selected`,
        other: () => `${formatter.number(args.count)} items selected`,
      })}.`,
    selectedAll: `All items selected.`,
    selectedItem: (args) => `${args.item} selected.`,
  },
  "es-ES": {
    deselectedItem: (args) => `${args.item} no seleccionado.`,
    selectedAll: `Todos los elementos seleccionados.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ning\xfan elemento seleccionado`,
        one: () => `${formatter.number(args.count)} elemento seleccionado`,
        other: () => `${formatter.number(args.count)} elementos seleccionados`,
      })}.`,
    selectedItem: (args) => `${args.item} seleccionado.`,
  },
  "et-EE": {
    deselectedItem: (args) => `${args.item} pole valitud.`,
    selectedAll: `K\xf5ik \xfcksused valitud.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\xdcksusi pole valitud`,
        one: () => `${formatter.number(args.count)} \xfcksus valitud`,
        other: () => `${formatter.number(args.count)} \xfcksust valitud`,
      })}.`,
    selectedItem: (args) => `${args.item} valitud.`,
  },
  "fi-FI": {
    deselectedItem: (args) => `Kohdetta ${args.item} ei valittu.`,
    selectedAll: `Kaikki kohteet valittu.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ei yht\xe4\xe4n kohdetta valittu`,
        one: () => `${formatter.number(args.count)} kohde valittu`,
        other: () => `${formatter.number(args.count)} kohdetta valittu`,
      })}.`,
    selectedItem: (args) => `${args.item} valittu.`,
  },
  "fr-FR": {
    deselectedItem: (args) => `${args.item} non s\xe9lectionn\xe9.`,
    selectedAll: `Tous les \xe9l\xe9ments s\xe9lectionn\xe9s.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Aucun \xe9l\xe9ment s\xe9lectionn\xe9`,
        one: () => `${formatter.number(args.count)} \xe9l\xe9ment s\xe9lectionn\xe9`,
        other: () => `${formatter.number(args.count)} \xe9l\xe9ments s\xe9lectionn\xe9s`,
      })}.`,
    selectedItem: (args) => `${args.item} s\xe9lectionn\xe9.`,
  },
  "he-IL": {
    deselectedItem: (args) => `${args.item} \u{5DC}\u{5D0} \u{5E0}\u{5D1}\u{5D7}\u{5E8}.`,
    selectedAll: `\u{5DB}\u{5DC} \u{5D4}\u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{5DC}\u{5D0} \u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD}`,
        one: () => `\u{5E4}\u{5E8}\u{5D9}\u{5D8} ${formatter.number(args.count)} \u{5E0}\u{5D1}\u{5D7}\u{5E8}`,
        other: () =>
          `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}`,
      })}.`,
    selectedItem: (args) => `${args.item} \u{5E0}\u{5D1}\u{5D7}\u{5E8}.`,
  },
  "hr-HR": {
    deselectedItem: (args) => `Stavka ${args.item} nije odabrana.`,
    selectedAll: `Odabrane su sve stavke.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nije odabrana nijedna stavka`,
        one: () => `Odabrana je ${formatter.number(args.count)} stavka`,
        other: () => `Odabrano je ${formatter.number(args.count)} stavki`,
      })}.`,
    selectedItem: (args) => `Stavka ${args.item} je odabrana.`,
  },
  "hu-HU": {
    deselectedItem: (args) => `${args.item} nincs kijel\xf6lve.`,
    selectedAll: `Az \xf6sszes elem kijel\xf6lve.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Egy elem sincs kijel\xf6lve`,
        one: () => `${formatter.number(args.count)} elem kijel\xf6lve`,
        other: () => `${formatter.number(args.count)} elem kijel\xf6lve`,
      })}.`,
    selectedItem: (args) => `${args.item} kijel\xf6lve.`,
  },
  "it-IT": {
    deselectedItem: (args) => `${args.item} non selezionato.`,
    selectedAll: `Tutti gli elementi selezionati.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nessun elemento selezionato`,
        one: () => `${formatter.number(args.count)} elemento selezionato`,
        other: () => `${formatter.number(args.count)} elementi selezionati`,
      })}.`,
    selectedItem: (args) => `${args.item} selezionato.`,
  },
  "ja-JP": {
    deselectedItem: (args) =>
      `${args.item} \u{304C}\u{9078}\u{629E}\u{3055}\u{308C}\u{3066}\u{3044}\u{307E}\u{305B}\u{3093}\u{3002}`,
    selectedAll: `\u{3059}\u{3079}\u{3066}\u{306E}\u{9805}\u{76EE}\u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{9805}\u{76EE}\u{304C}\u{9078}\u{629E}\u{3055}\u{308C}\u{3066}\u{3044}\u{307E}\u{305B}\u{3093}`,
        one: () =>
          `${formatter.number(args.count)} \u{9805}\u{76EE}\u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}`,
        other: () =>
          `${formatter.number(args.count)} \u{9805}\u{76EE}\u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}`,
      })}\u{3002}`,
    selectedItem: (args) => `${args.item} \u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}`,
  },
  "ko-KR": {
    deselectedItem: (args) =>
      `${args.item}\u{C774}(\u{AC00}) \u{C120}\u{D0DD}\u{B418}\u{C9C0} \u{C54A}\u{C558}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    selectedAll: `\u{BAA8}\u{B4E0} \u{D56D}\u{BAA9}\u{C774} \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{C120}\u{D0DD}\u{B41C} \u{D56D}\u{BAA9}\u{C774} \u{C5C6}\u{C2B5}\u{B2C8}\u{B2E4}`,
        one: () =>
          `${formatter.number(args.count)}\u{AC1C} \u{D56D}\u{BAA9}\u{C774} \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}`,
        other: () =>
          `${formatter.number(args.count)}\u{AC1C} \u{D56D}\u{BAA9}\u{C774} \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}`,
      })}.`,
    selectedItem: (args) => `${args.item}\u{C774}(\u{AC00}) \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}.`,
  },
  "lt-LT": {
    deselectedItem: (args) => `${args.item} nepasirinkta.`,
    selectedAll: `Pasirinkti visi elementai.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nepasirinktas n\u{117} vienas elementas`,
        one: () => `Pasirinktas ${formatter.number(args.count)} elementas`,
        other: () => `Pasirinkta element\u{173}: ${formatter.number(args.count)}`,
      })}.`,
    selectedItem: (args) => `Pasirinkta: ${args.item}.`,
  },
  "lv-LV": {
    deselectedItem: (args) => `Vienums ${args.item} nav atlas\u{12B}ts.`,
    selectedAll: `Atlas\u{12B}ti visi vienumi.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nav atlas\u{12B}ts neviens vienums`,
        one: () => `Atlas\u{12B}to vienumu skaits: ${formatter.number(args.count)}`,
        other: () => `Atlas\u{12B}to vienumu skaits: ${formatter.number(args.count)}`,
      })}.`,
    selectedItem: (args) => `Atlas\u{12B}ts vienums ${args.item}.`,
  },
  "nb-NO": {
    deselectedItem: (args) => `${args.item} er ikke valgt.`,
    selectedAll: `Alle elementer er valgt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ingen elementer er valgt`,
        one: () => `${formatter.number(args.count)} element er valgt`,
        other: () => `${formatter.number(args.count)} elementer er valgt`,
      })}.`,
    selectedItem: (args) => `${args.item} er valgt.`,
  },
  "nl-NL": {
    deselectedItem: (args) => `${args.item} niet geselecteerd.`,
    selectedAll: `Alle items geselecteerd.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Geen items geselecteerd`,
        one: () => `${formatter.number(args.count)} item geselecteerd`,
        other: () => `${formatter.number(args.count)} items geselecteerd`,
      })}.`,
    selectedItem: (args) => `${args.item} geselecteerd.`,
  },
  "pl-PL": {
    deselectedItem: (args) => `Nie zaznaczono ${args.item}.`,
    selectedAll: `Wszystkie zaznaczone elementy.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nie zaznaczono \u{17C}adnych element\xf3w`,
        one: () => `${formatter.number(args.count)} zaznaczony element`,
        other: () => `${formatter.number(args.count)} zaznaczonych element\xf3w`,
      })}.`,
    selectedItem: (args) => `Zaznaczono ${args.item}.`,
  },
  "pt-BR": {
    deselectedItem: (args) => `${args.item} n\xe3o selecionado.`,
    selectedAll: `Todos os itens selecionados.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nenhum item selecionado`,
        one: () => `${formatter.number(args.count)} item selecionado`,
        other: () => `${formatter.number(args.count)} itens selecionados`,
      })}.`,
    selectedItem: (args) => `${args.item} selecionado.`,
  },
  "pt-PT": {
    deselectedItem: (args) => `${args.item} n\xe3o selecionado.`,
    selectedAll: `Todos os itens selecionados.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nenhum item selecionado`,
        one: () => `${formatter.number(args.count)} item selecionado`,
        other: () => `${formatter.number(args.count)} itens selecionados`,
      })}.`,
    selectedItem: (args) => `${args.item} selecionado.`,
  },
  "ro-RO": {
    deselectedItem: (args) => `${args.item} neselectat.`,
    selectedAll: `Toate elementele selectate.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Niciun element selectat`,
        one: () => `${formatter.number(args.count)} element selectat`,
        other: () => `${formatter.number(args.count)} elemente selectate`,
      })}.`,
    selectedItem: (args) => `${args.item} selectat.`,
  },
  "ru-RU": {
    deselectedItem: (args) => `${args.item} \u{43D}\u{435} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    selectedAll: `\u{412}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{44B} \u{432}\u{441}\u{435} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{44B}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{41D}\u{435}\u{442} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{445} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432}`,
        one: () =>
          `${formatter.number(args.count)} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}`,
        other: () =>
          `${formatter.number(args.count)} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43E}`,
      })}.`,
    selectedItem: (args) => `${args.item} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
  },
  "sk-SK": {
    deselectedItem: (args) => `Nevybrat\xe9 polo\u{17E}ky: ${args.item}.`,
    selectedAll: `V\u{161}etky vybrat\xe9 polo\u{17E}ky.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{17D}iadne vybrat\xe9 polo\u{17E}ky`,
        one: () => `${formatter.number(args.count)} vybrat\xe1 polo\u{17E}ka`,
        other: () => `Po\u{10D}et vybrat\xfdch polo\u{17E}iek:${formatter.number(args.count)}`,
      })}.`,
    selectedItem: (args) => `Vybrat\xe9 polo\u{17E}ky: ${args.item}.`,
  },
  "sl-SI": {
    deselectedItem: (args) => `Element ${args.item} ni izbran.`,
    selectedAll: `Vsi elementi so izbrani.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Noben element ni izbran`,
        one: () => `${formatter.number(args.count)} element je izbran`,
        other: () => `${formatter.number(args.count)} elementov je izbranih`,
      })}.`,
    selectedItem: (args) => `Element ${args.item} je izbran.`,
  },
  "sr-SP": {
    deselectedItem: (args) => `${args.item} nije izabrano.`,
    selectedAll: `Izabrane su sve stavke.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nije izabrana nijedna stavka`,
        one: () => `Izabrana je ${formatter.number(args.count)} stavka`,
        other: () => `Izabrano je ${formatter.number(args.count)} stavki`,
      })}.`,
    selectedItem: (args) => `${args.item} je izabrano.`,
  },
  "sv-SE": {
    deselectedItem: (args) => `${args.item} ej markerat.`,
    selectedAll: `Alla markerade objekt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Inga markerade objekt`,
        one: () => `${formatter.number(args.count)} markerat objekt`,
        other: () => `${formatter.number(args.count)} markerade objekt`,
      })}.`,
    selectedItem: (args) => `${args.item} markerat.`,
  },
  "tr-TR": {
    deselectedItem: (args) => `${args.item} se\xe7ilmedi.`,
    selectedAll: `T\xfcm \xf6geler se\xe7ildi.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Hi\xe7bir \xf6ge se\xe7ilmedi`,
        one: () => `${formatter.number(args.count)} \xf6ge se\xe7ildi`,
        other: () => `${formatter.number(args.count)} \xf6ge se\xe7ildi`,
      })}.`,
    selectedItem: (args) => `${args.item} se\xe7ildi.`,
  },
  "uk-UA": {
    deselectedItem: (args) => `${args.item} \u{43D}\u{435} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    selectedAll: `\u{423}\u{441}\u{456} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{416}\u{43E}\u{434}\u{43D}\u{438}\u{445} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{456}\u{432} \u{43D}\u{435} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}`,
        one: () =>
          `${formatter.number(args.count)} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}`,
        other: () =>
          `\u{412}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{456}\u{432}: ${formatter.number(args.count)}`,
      })}.`,
    selectedItem: (args) => `${args.item} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
  },
  "zh-CN": {
    deselectedItem: (args) => `\u{672A}\u{9009}\u{62E9} ${args.item}\u{3002}`,
    selectedAll: `\u{5DF2}\u{9009}\u{62E9}\u{6240}\u{6709}\u{9879}\u{76EE}\u{3002}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{672A}\u{9009}\u{62E9}\u{9879}\u{76EE}`,
        one: () => `\u{5DF2}\u{9009}\u{62E9} ${formatter.number(args.count)} \u{4E2A}\u{9879}\u{76EE}`,
        other: () => `\u{5DF2}\u{9009}\u{62E9} ${formatter.number(args.count)} \u{4E2A}\u{9879}\u{76EE}`,
      })}\u{3002}`,
    selectedItem: (args) => `\u{5DF2}\u{9009}\u{62E9} ${args.item}\u{3002}`,
  },
  "zh-TW": {
    deselectedItem: (args) => `\u{672A}\u{9078}\u{53D6}\u{300C}${args.item}\u{300D}\u{3002}`,
    selectedAll: `\u{5DF2}\u{9078}\u{53D6}\u{6240}\u{6709}\u{9805}\u{76EE}\u{3002}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{672A}\u{9078}\u{53D6}\u{4EFB}\u{4F55}\u{9805}\u{76EE}`,
        one: () => `\u{5DF2}\u{9078}\u{53D6} ${formatter.number(args.count)} \u{500B}\u{9805}\u{76EE}`,
        other: () => `\u{5DF2}\u{9078}\u{53D6} ${formatter.number(args.count)} \u{500B}\u{9805}\u{76EE}`,
      })}\u{3002}`,
    selectedItem: (args) => `\u{5DF2}\u{9078}\u{53D6}\u{300C}${args.item}\u{300D}\u{3002}`,
  },
}
