/* Copyright 2020, 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
/* Received message subset from pinned react-aria3.48.0; no DOM runtime imports. */
export type TNativeTableGridMessageKey =
  | "selectedItem"
  | "deselectedItem"
  | "selectedCount"
  | "selectedAll"
  | "longPressToSelect"
export type TNativeTableGridMessageArguments = { item: string; count: number }
export type TNativeTableGridFormatter = {
  number: (value: number) => string
  plural: (count: number, cases: Record<string, string | (() => string)>) => string
}
type TMessage = string | ((args: TNativeTableGridMessageArguments, formatter: TNativeTableGridFormatter) => string)
export const nativeTableGridMessages: Record<string, Record<TNativeTableGridMessageKey, TMessage>> = {
  "ar-AE": {
    selectedItem: (args) => `${args.item} \u{627}\u{644}\u{645}\u{62D}\u{62F}\u{62F}`,
    deselectedItem: (args) => `${args.item} \u{63A}\u{64A}\u{631} \u{627}\u{644}\u{645}\u{62D}\u{62F}\u{62F}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{644}\u{645} \u{64A}\u{62A}\u{645} \u{62A}\u{62D}\u{62F}\u{64A}\u{62F} \u{639}\u{646}\u{627}\u{635}\u{631}`,
        one: () => `${formatter.number(args.count)} \u{639}\u{646}\u{635}\u{631} \u{645}\u{62D}\u{62F}\u{62F}`,
        other: () => `${formatter.number(args.count)} \u{639}\u{646}\u{635}\u{631} \u{645}\u{62D}\u{62F}\u{62F}`,
      })}.`,
    selectedAll: `\u{62C}\u{645}\u{64A}\u{639} \u{627}\u{644}\u{639}\u{646}\u{627}\u{635}\u{631} \u{627}\u{644}\u{645}\u{62D}\u{62F}\u{62F}\u{629}.`,
    longPressToSelect: `\u{627}\u{636}\u{63A}\u{637} \u{645}\u{637}\u{648}\u{644}\u{64B}\u{627} \u{644}\u{644}\u{62F}\u{62E}\u{648}\u{644} \u{625}\u{644}\u{649} \u{648}\u{636}\u{639} \u{627}\u{644}\u{62A}\u{62D}\u{62F}\u{64A}\u{62F}.`,
  },
  "bg-BG": {
    selectedItem: (args) => `${args.item} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}.`,
    deselectedItem: (args) => `${args.item} \u{43D}\u{435} \u{435} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{41D}\u{44F}\u{43C}\u{430} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
        one: () =>
          `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}`,
        other: () =>
          `${formatter.number(args.count)} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438}`,
      })}.`,
    selectedAll: `\u{412}\u{441}\u{438}\u{447}\u{43A}\u{438} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438} \u{441}\u{430} \u{438}\u{437}\u{431}\u{440}\u{430}\u{43D}\u{438}.`,
    longPressToSelect: `\u{41D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{442}\u{435} \u{438} \u{437}\u{430}\u{434}\u{440}\u{44A}\u{436}\u{442}\u{435} \u{437}\u{430} \u{434}\u{430} \u{432}\u{43B}\u{435}\u{437}\u{435}\u{442}\u{435} \u{432} \u{438}\u{437}\u{431}\u{438}\u{440}\u{430}\u{442}\u{435}\u{43B}\u{435}\u{43D} \u{440}\u{435}\u{436}\u{438}\u{43C}.`,
  },
  "cs-CZ": {
    selectedItem: (args) => `Vybr\xe1na polo\u{17E}ka ${args.item}.`,
    deselectedItem: (args) => `Polo\u{17E}ka ${args.item} nen\xed vybr\xe1na.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nevybr\xe1ny \u{17E}\xe1dn\xe9 polo\u{17E}ky`,
        one: () => `Vybr\xe1na ${formatter.number(args.count)} polo\u{17E}ka`,
        other: () => `Vybr\xe1no ${formatter.number(args.count)} polo\u{17E}ek`,
      })}.`,
    selectedAll: `Vybr\xe1ny v\u{161}echny polo\u{17E}ky.`,
    longPressToSelect: `Dlouh\xfdm stisknut\xedm p\u{159}ejdete do re\u{17E}imu v\xfdb\u{11B}ru.`,
  },
  "da-DK": {
    selectedItem: (args) => `${args.item} valgt.`,
    deselectedItem: (args) => `${args.item} ikke valgt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ingen elementer valgt`,
        one: () => `${formatter.number(args.count)} element valgt`,
        other: () => `${formatter.number(args.count)} elementer valgt`,
      })}.`,
    selectedAll: `Alle elementer valgt.`,
    longPressToSelect: `Lav et langt tryk for at aktivere valgtilstand.`,
  },
  "de-DE": {
    selectedItem: (args) => `${args.item} ausgew\xe4hlt.`,
    deselectedItem: (args) => `${args.item} nicht ausgew\xe4hlt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Keine Elemente ausgew\xe4hlt`,
        one: () => `${formatter.number(args.count)} Element ausgew\xe4hlt`,
        other: () => `${formatter.number(args.count)} Elemente ausgew\xe4hlt`,
      })}.`,
    selectedAll: `Alle Elemente ausgew\xe4hlt.`,
    longPressToSelect: `Gedr\xfcckt halten, um Auswahlmodus zu \xf6ffnen.`,
  },
  "el-GR": {
    selectedItem: (args) =>
      `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B5} \u{3C4}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF} ${args.item}.`,
    deselectedItem: (args) =>
      `\u{394}\u{3B5}\u{3BD} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B5} \u{3C4}\u{3BF} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF} ${args.item}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{394}\u{3B5}\u{3BD} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B1}\u{3BD} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
        one: () =>
          `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B5} ${formatter.number(args.count)} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3BF}`,
        other: () =>
          `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B1}\u{3BD} ${formatter.number(args.count)} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}`,
      })}.`,
    selectedAll: `\u{395}\u{3C0}\u{3B9}\u{3BB}\u{3AD}\u{3C7}\u{3B8}\u{3B7}\u{3BA}\u{3B1}\u{3BD} \u{3CC}\u{3BB}\u{3B1} \u{3C4}\u{3B1} \u{3C3}\u{3C4}\u{3BF}\u{3B9}\u{3C7}\u{3B5}\u{3AF}\u{3B1}.`,
    longPressToSelect: `\u{3A0}\u{3B1}\u{3C4}\u{3AE}\u{3C3}\u{3C4}\u{3B5} \u{3C0}\u{3B1}\u{3C1}\u{3B1}\u{3C4}\u{3B5}\u{3C4}\u{3B1}\u{3BC}\u{3AD}\u{3BD}\u{3B1} \u{3B3}\u{3B9}\u{3B1} \u{3BD}\u{3B1} \u{3BC}\u{3C0}\u{3B5}\u{3AF}\u{3C4}\u{3B5} \u{3C3}\u{3B5} \u{3BB}\u{3B5}\u{3B9}\u{3C4}\u{3BF}\u{3C5}\u{3C1}\u{3B3}\u{3AF}\u{3B1} \u{3B5}\u{3C0}\u{3B9}\u{3BB}\u{3BF}\u{3B3}\u{3AE}\u{3C2}.`,
  },
  "en-US": {
    selectedItem: (args) => `${args.item} selected.`,
    deselectedItem: (args) => `${args.item} not selected.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `No items selected`,
        one: () => `${formatter.number(args.count)} item selected`,
        other: () => `${formatter.number(args.count)} items selected`,
      })}.`,
    selectedAll: `All items selected.`,
    longPressToSelect: `Long press to enter selection mode.`,
  },
  "es-ES": {
    selectedItem: (args) => `${args.item} seleccionado.`,
    deselectedItem: (args) => `${args.item} no seleccionado.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ning\xfan elemento seleccionado`,
        one: () => `${formatter.number(args.count)} elemento seleccionado`,
        other: () => `${formatter.number(args.count)} elementos seleccionados`,
      })}.`,
    selectedAll: `Todos los elementos seleccionados.`,
    longPressToSelect: `Mantenga pulsado para abrir el modo de selecci\xf3n.`,
  },
  "et-EE": {
    selectedItem: (args) => `${args.item} valitud.`,
    deselectedItem: (args) => `${args.item} pole valitud.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\xdcksusi pole valitud`,
        one: () => `${formatter.number(args.count)} \xfcksus valitud`,
        other: () => `${formatter.number(args.count)} \xfcksust valitud`,
      })}.`,
    selectedAll: `K\xf5ik \xfcksused valitud.`,
    longPressToSelect: `Valikure\u{17E}iimi sisenemiseks vajutage pikalt.`,
  },
  "fi-FI": {
    selectedItem: (args) => `${args.item} valittu.`,
    deselectedItem: (args) => `Kohdetta ${args.item} ei valittu.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ei yht\xe4\xe4n kohdetta valittu`,
        one: () => `${formatter.number(args.count)} kohde valittu`,
        other: () => `${formatter.number(args.count)} kohdetta valittu`,
      })}.`,
    selectedAll: `Kaikki kohteet valittu.`,
    longPressToSelect: `Siirry valintatilaan painamalla pitk\xe4\xe4n.`,
  },
  "fr-FR": {
    selectedItem: (args) => `${args.item} s\xe9lectionn\xe9.`,
    deselectedItem: (args) => `${args.item} non s\xe9lectionn\xe9.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Aucun \xe9l\xe9ment s\xe9lectionn\xe9`,
        one: () => `${formatter.number(args.count)} \xe9l\xe9ment s\xe9lectionn\xe9`,
        other: () => `${formatter.number(args.count)} \xe9l\xe9ments s\xe9lectionn\xe9s`,
      })}.`,
    selectedAll: `Tous les \xe9l\xe9ments s\xe9lectionn\xe9s.`,
    longPressToSelect: `Appuyez de mani\xe8re prolong\xe9e pour passer en mode de s\xe9lection.`,
  },
  "he-IL": {
    selectedItem: (args) => `${args.item} \u{5E0}\u{5D1}\u{5D7}\u{5E8}.`,
    deselectedItem: (args) => `${args.item} \u{5DC}\u{5D0} \u{5E0}\u{5D1}\u{5D7}\u{5E8}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{5DC}\u{5D0} \u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD}`,
        one: () => `\u{5E4}\u{5E8}\u{5D9}\u{5D8} ${formatter.number(args.count)} \u{5E0}\u{5D1}\u{5D7}\u{5E8}`,
        other: () =>
          `${formatter.number(args.count)} \u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}`,
      })}.`,
    selectedAll: `\u{5DB}\u{5DC} \u{5D4}\u{5E4}\u{5E8}\u{5D9}\u{5D8}\u{5D9}\u{5DD} \u{5E0}\u{5D1}\u{5D7}\u{5E8}\u{5D5}.`,
    longPressToSelect: `\u{5D4}\u{5E7}\u{5E9}\u{5D4} \u{5D0}\u{5E8}\u{5D5}\u{5DB}\u{5D4} \u{5DC}\u{5DB}\u{5E0}\u{5D9}\u{5E1}\u{5D4} \u{5DC}\u{5DE}\u{5E6}\u{5D1} \u{5D1}\u{5D7}\u{5D9}\u{5E8}\u{5D4}.`,
  },
  "hr-HR": {
    selectedItem: (args) => `Stavka ${args.item} je odabrana.`,
    deselectedItem: (args) => `Stavka ${args.item} nije odabrana.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nije odabrana nijedna stavka`,
        one: () => `Odabrana je ${formatter.number(args.count)} stavka`,
        other: () => `Odabrano je ${formatter.number(args.count)} stavki`,
      })}.`,
    selectedAll: `Odabrane su sve stavke.`,
    longPressToSelect: `Dugo pritisnite za ulazak u na\u{10D}in odabira.`,
  },
  "hu-HU": {
    selectedItem: (args) => `${args.item} kijel\xf6lve.`,
    deselectedItem: (args) => `${args.item} nincs kijel\xf6lve.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Egy elem sincs kijel\xf6lve`,
        one: () => `${formatter.number(args.count)} elem kijel\xf6lve`,
        other: () => `${formatter.number(args.count)} elem kijel\xf6lve`,
      })}.`,
    selectedAll: `Az \xf6sszes elem kijel\xf6lve.`,
    longPressToSelect: `Nyomja hosszan a kijel\xf6l\xe9shez.`,
  },
  "it-IT": {
    selectedItem: (args) => `${args.item} selezionato.`,
    deselectedItem: (args) => `${args.item} non selezionato.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nessun elemento selezionato`,
        one: () => `${formatter.number(args.count)} elemento selezionato`,
        other: () => `${formatter.number(args.count)} elementi selezionati`,
      })}.`,
    selectedAll: `Tutti gli elementi selezionati.`,
    longPressToSelect: `Premi a lungo per passare alla modalit\xe0 di selezione.`,
  },
  "ja-JP": {
    selectedItem: (args) => `${args.item} \u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}`,
    deselectedItem: (args) =>
      `${args.item} \u{304C}\u{9078}\u{629E}\u{3055}\u{308C}\u{3066}\u{3044}\u{307E}\u{305B}\u{3093}\u{3002}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{9805}\u{76EE}\u{304C}\u{9078}\u{629E}\u{3055}\u{308C}\u{3066}\u{3044}\u{307E}\u{305B}\u{3093}`,
        one: () =>
          `${formatter.number(args.count)} \u{9805}\u{76EE}\u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}`,
        other: () =>
          `${formatter.number(args.count)} \u{9805}\u{76EE}\u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}`,
      })}\u{3002}`,
    selectedAll: `\u{3059}\u{3079}\u{3066}\u{306E}\u{9805}\u{76EE}\u{3092}\u{9078}\u{629E}\u{3057}\u{307E}\u{3057}\u{305F}\u{3002}`,
    longPressToSelect: `\u{9577}\u{62BC}\u{3057}\u{3057}\u{3066}\u{9078}\u{629E}\u{30E2}\u{30FC}\u{30C9}\u{3092}\u{958B}\u{304D}\u{307E}\u{3059}\u{3002}`,
  },
  "ko-KR": {
    selectedItem: (args) => `${args.item}\u{C774}(\u{AC00}) \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    deselectedItem: (args) =>
      `${args.item}\u{C774}(\u{AC00}) \u{C120}\u{D0DD}\u{B418}\u{C9C0} \u{C54A}\u{C558}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{C120}\u{D0DD}\u{B41C} \u{D56D}\u{BAA9}\u{C774} \u{C5C6}\u{C2B5}\u{B2C8}\u{B2E4}`,
        one: () =>
          `${formatter.number(args.count)}\u{AC1C} \u{D56D}\u{BAA9}\u{C774} \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}`,
        other: () =>
          `${formatter.number(args.count)}\u{AC1C} \u{D56D}\u{BAA9}\u{C774} \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}`,
      })}.`,
    selectedAll: `\u{BAA8}\u{B4E0} \u{D56D}\u{BAA9}\u{C774} \u{C120}\u{D0DD}\u{B418}\u{C5C8}\u{C2B5}\u{B2C8}\u{B2E4}.`,
    longPressToSelect: `\u{C120}\u{D0DD} \u{BAA8}\u{B4DC}\u{B85C} \u{B4E4}\u{C5B4}\u{AC00}\u{B824}\u{BA74} \u{AE38}\u{AC8C} \u{B204}\u{B974}\u{C2ED}\u{C2DC}\u{C624}.`,
  },
  "lt-LT": {
    selectedItem: (args) => `Pasirinkta: ${args.item}.`,
    deselectedItem: (args) => `${args.item} nepasirinkta.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nepasirinktas n\u{117} vienas elementas`,
        one: () => `Pasirinktas ${formatter.number(args.count)} elementas`,
        other: () => `Pasirinkta element\u{173}: ${formatter.number(args.count)}`,
      })}.`,
    selectedAll: `Pasirinkti visi elementai.`,
    longPressToSelect: `Nor\u{117}dami \u{12F}jungti pasirinkimo re\u{17E}im\u{105}, paspauskite ir palaikykite.`,
  },
  "lv-LV": {
    selectedItem: (args) => `Atlas\u{12B}ts vienums ${args.item}.`,
    deselectedItem: (args) => `Vienums ${args.item} nav atlas\u{12B}ts.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nav atlas\u{12B}ts neviens vienums`,
        one: () => `Atlas\u{12B}to vienumu skaits: ${formatter.number(args.count)}`,
        other: () => `Atlas\u{12B}to vienumu skaits: ${formatter.number(args.count)}`,
      })}.`,
    selectedAll: `Atlas\u{12B}ti visi vienumi.`,
    longPressToSelect: `Ilgi turiet nospiestu. lai iesl\u{113}gtu atlases re\u{17E}\u{12B}mu.`,
  },
  "nb-NO": {
    selectedItem: (args) => `${args.item} er valgt.`,
    deselectedItem: (args) => `${args.item} er ikke valgt.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Ingen elementer er valgt`,
        one: () => `${formatter.number(args.count)} element er valgt`,
        other: () => `${formatter.number(args.count)} elementer er valgt`,
      })}.`,
    selectedAll: `Alle elementer er valgt.`,
    longPressToSelect: `Bruk et langt trykk for \xe5 g\xe5 inn i valgmodus.`,
  },
  "nl-NL": {
    selectedItem: (args) => `${args.item} geselecteerd.`,
    deselectedItem: (args) => `${args.item} niet geselecteerd.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Geen items geselecteerd`,
        one: () => `${formatter.number(args.count)} item geselecteerd`,
        other: () => `${formatter.number(args.count)} items geselecteerd`,
      })}.`,
    selectedAll: `Alle items geselecteerd.`,
    longPressToSelect: `Druk lang om de selectiemodus te openen.`,
  },
  "pl-PL": {
    selectedItem: (args) => `Zaznaczono ${args.item}.`,
    deselectedItem: (args) => `Nie zaznaczono ${args.item}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nie zaznaczono \u{17C}adnych element\xf3w`,
        one: () => `${formatter.number(args.count)} zaznaczony element`,
        other: () => `${formatter.number(args.count)} zaznaczonych element\xf3w`,
      })}.`,
    selectedAll: `Wszystkie zaznaczone elementy.`,
    longPressToSelect: `Naci\u{15B}nij i przytrzymaj, aby wej\u{15B}\u{107} do trybu wyboru.`,
  },
  "pt-BR": {
    selectedItem: (args) => `${args.item} selecionado.`,
    deselectedItem: (args) => `${args.item} n\xe3o selecionado.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nenhum item selecionado`,
        one: () => `${formatter.number(args.count)} item selecionado`,
        other: () => `${formatter.number(args.count)} itens selecionados`,
      })}.`,
    selectedAll: `Todos os itens selecionados.`,
    longPressToSelect: `Mantenha pressionado para entrar no modo de sele\xe7\xe3o.`,
  },
  "pt-PT": {
    selectedItem: (args) => `${args.item} selecionado.`,
    deselectedItem: (args) => `${args.item} n\xe3o selecionado.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nenhum item selecionado`,
        one: () => `${formatter.number(args.count)} item selecionado`,
        other: () => `${formatter.number(args.count)} itens selecionados`,
      })}.`,
    selectedAll: `Todos os itens selecionados.`,
    longPressToSelect: `Prima continuamente para entrar no modo de sele\xe7\xe3o.`,
  },
  "ro-RO": {
    selectedItem: (args) => `${args.item} selectat.`,
    deselectedItem: (args) => `${args.item} neselectat.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Niciun element selectat`,
        one: () => `${formatter.number(args.count)} element selectat`,
        other: () => `${formatter.number(args.count)} elemente selectate`,
      })}.`,
    selectedAll: `Toate elementele selectate.`,
    longPressToSelect: `Ap\u{103}sa\u{21B}i lung pentru a intra \xeen modul de selectare.`,
  },
  "ru-RU": {
    selectedItem: (args) => `${args.item} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    deselectedItem: (args) => `${args.item} \u{43D}\u{435} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{41D}\u{435}\u{442} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43D}\u{44B}\u{445} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432}`,
        one: () =>
          `${formatter.number(args.count)} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}`,
        other: () =>
          `${formatter.number(args.count)} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{43E}\u{432} \u{432}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{43E}`,
      })}.`,
    selectedAll: `\u{412}\u{44B}\u{431}\u{440}\u{430}\u{43D}\u{44B} \u{432}\u{441}\u{435} \u{44D}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{44B}.`,
    longPressToSelect: `\u{41D}\u{430}\u{436}\u{43C}\u{438}\u{442}\u{435} \u{438} \u{443}\u{434}\u{435}\u{440}\u{436}\u{438}\u{432}\u{430}\u{439}\u{442}\u{435} \u{434}\u{43B}\u{44F} \u{432}\u{445}\u{43E}\u{434}\u{430} \u{432} \u{440}\u{435}\u{436}\u{438}\u{43C} \u{432}\u{44B}\u{431}\u{43E}\u{440}\u{430}.`,
  },
  "sk-SK": {
    selectedItem: (args) => `Vybrat\xe9 polo\u{17E}ky: ${args.item}.`,
    deselectedItem: (args) => `Nevybrat\xe9 polo\u{17E}ky: ${args.item}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{17D}iadne vybrat\xe9 polo\u{17E}ky`,
        one: () => `${formatter.number(args.count)} vybrat\xe1 polo\u{17E}ka`,
        other: () => `Po\u{10D}et vybrat\xfdch polo\u{17E}iek:${formatter.number(args.count)}`,
      })}.`,
    selectedAll: `V\u{161}etky vybrat\xe9 polo\u{17E}ky.`,
    longPressToSelect: `Dlh\u{161}\xedm stla\u{10D}en\xedm prejdite do re\u{17E}imu v\xfdberu.`,
  },
  "sl-SI": {
    selectedItem: (args) => `Element ${args.item} je izbran.`,
    deselectedItem: (args) => `Element ${args.item} ni izbran.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Noben element ni izbran`,
        one: () => `${formatter.number(args.count)} element je izbran`,
        other: () => `${formatter.number(args.count)} elementov je izbranih`,
      })}.`,
    selectedAll: `Vsi elementi so izbrani.`,
    longPressToSelect: `Za izbirni na\u{10D}in pritisnite in dlje \u{10D}asa dr\u{17E}ite.`,
  },
  "sr-SP": {
    selectedItem: (args) => `${args.item} je izabrano.`,
    deselectedItem: (args) => `${args.item} nije izabrano.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Nije izabrana nijedna stavka`,
        one: () => `Izabrana je ${formatter.number(args.count)} stavka`,
        other: () => `Izabrano je ${formatter.number(args.count)} stavki`,
      })}.`,
    selectedAll: `Izabrane su sve stavke.`,
    longPressToSelect: `Dugo pritisnite za ulazak u re\u{17E}im biranja.`,
  },
  "sv-SE": {
    selectedItem: (args) => `${args.item} markerat.`,
    deselectedItem: (args) => `${args.item} ej markerat.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Inga markerade objekt`,
        one: () => `${formatter.number(args.count)} markerat objekt`,
        other: () => `${formatter.number(args.count)} markerade objekt`,
      })}.`,
    selectedAll: `Alla markerade objekt.`,
    longPressToSelect: `Tryck l\xe4nge n\xe4r du vill \xf6ppna v\xe4ljarl\xe4ge.`,
  },
  "tr-TR": {
    selectedItem: (args) => `${args.item} se\xe7ildi.`,
    deselectedItem: (args) => `${args.item} se\xe7ilmedi.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `Hi\xe7bir \xf6ge se\xe7ilmedi`,
        one: () => `${formatter.number(args.count)} \xf6ge se\xe7ildi`,
        other: () => `${formatter.number(args.count)} \xf6ge se\xe7ildi`,
      })}.`,
    selectedAll: `T\xfcm \xf6geler se\xe7ildi.`,
    longPressToSelect: `Se\xe7im moduna girmek i\xe7in uzun bas\u{131}n.`,
  },
  "uk-UA": {
    selectedItem: (args) => `${args.item} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    deselectedItem: (args) => `${args.item} \u{43D}\u{435} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{416}\u{43E}\u{434}\u{43D}\u{438}\u{445} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{456}\u{432} \u{43D}\u{435} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}`,
        one: () =>
          `${formatter.number(args.count)} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}`,
        other: () =>
          `\u{412}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{456}\u{432}: ${formatter.number(args.count)}`,
      })}.`,
    selectedAll: `\u{423}\u{441}\u{456} \u{435}\u{43B}\u{435}\u{43C}\u{435}\u{43D}\u{442}\u{438} \u{432}\u{438}\u{431}\u{440}\u{430}\u{43D}\u{43E}.`,
    longPressToSelect: `\u{412}\u{438}\u{43A}\u{43E}\u{43D}\u{430}\u{439}\u{442}\u{435} \u{434}\u{43E}\u{432}\u{433}\u{435} \u{43D}\u{430}\u{442}\u{438}\u{441}\u{43D}\u{435}\u{43D}\u{43D}\u{44F}, \u{449}\u{43E}\u{431} \u{43F}\u{435}\u{440}\u{435}\u{439}\u{442}\u{438} \u{432} \u{440}\u{435}\u{436}\u{438}\u{43C} \u{432}\u{438}\u{431}\u{43E}\u{440}\u{443}.`,
  },
  "zh-CN": {
    selectedItem: (args) => `\u{5DF2}\u{9009}\u{62E9} ${args.item}\u{3002}`,
    deselectedItem: (args) => `\u{672A}\u{9009}\u{62E9} ${args.item}\u{3002}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{672A}\u{9009}\u{62E9}\u{9879}\u{76EE}`,
        one: () => `\u{5DF2}\u{9009}\u{62E9} ${formatter.number(args.count)} \u{4E2A}\u{9879}\u{76EE}`,
        other: () => `\u{5DF2}\u{9009}\u{62E9} ${formatter.number(args.count)} \u{4E2A}\u{9879}\u{76EE}`,
      })}\u{3002}`,
    selectedAll: `\u{5DF2}\u{9009}\u{62E9}\u{6240}\u{6709}\u{9879}\u{76EE}\u{3002}`,
    longPressToSelect: `\u{957F}\u{6309}\u{4EE5}\u{8FDB}\u{5165}\u{9009}\u{62E9}\u{6A21}\u{5F0F}\u{3002}`,
  },
  "zh-TW": {
    selectedItem: (args) => `\u{5DF2}\u{9078}\u{53D6}\u{300C}${args.item}\u{300D}\u{3002}`,
    deselectedItem: (args) => `\u{672A}\u{9078}\u{53D6}\u{300C}${args.item}\u{300D}\u{3002}`,
    selectedCount: (args, formatter) =>
      `${formatter.plural(args.count, {
        "=0": `\u{672A}\u{9078}\u{53D6}\u{4EFB}\u{4F55}\u{9805}\u{76EE}`,
        one: () => `\u{5DF2}\u{9078}\u{53D6} ${formatter.number(args.count)} \u{500B}\u{9805}\u{76EE}`,
        other: () => `\u{5DF2}\u{9078}\u{53D6} ${formatter.number(args.count)} \u{500B}\u{9805}\u{76EE}`,
      })}\u{3002}`,
    selectedAll: `\u{5DF2}\u{9078}\u{53D6}\u{6240}\u{6709}\u{9805}\u{76EE}\u{3002}`,
    longPressToSelect: `\u{9577}\u{6309}\u{4EE5}\u{9032}\u{5165}\u{9078}\u{64C7}\u{6A21}\u{5F0F}\u{3002}`,
  },
}
