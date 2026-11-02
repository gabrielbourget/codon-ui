/* Copyright 2020, 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
/* Received message subset from pinned react-aria3.48.0; no DOM runtime imports. */
type TSortMessage = (args: { columnName: string }) => string
type TTableMessages = {
  ascendingSort: TSortMessage
  descendingSort: TSortMessage
  sortable: string
  ascending: string
  descending: string
  expand: string
  collapse: string
}
export const nativeTableSortMessages: Record<string, TTableMessages> = {
  "ar-AE": {
    ascendingSort: (args) =>
      `\u{62A}\u{631}\u{62A}\u{64A}\u{628} \u{62D}\u{633}\u{628} \u{627}\u{644}\u{639}\u{645}\u{648}\u{62F} ${args.columnName} \u{628}\u{62A}\u{631}\u{62A}\u{64A}\u{628} \u{62A}\u{635}\u{627}\u{639}\u{62F}\u{64A}`,
    descendingSort: (args) =>
      `\u{62A}\u{631}\u{62A}\u{64A}\u{628} \u{62D}\u{633}\u{628} \u{627}\u{644}\u{639}\u{645}\u{648}\u{62F} ${args.columnName} \u{628}\u{62A}\u{631}\u{62A}\u{64A}\u{628} \u{62A}\u{646}\u{627}\u{632}\u{644}\u{64A}`,
    sortable: `\u{639}\u{645}\u{648}\u{62F} \u{642}\u{627}\u{628}\u{644} \u{644}\u{644}\u{62A}\u{631}\u{62A}\u{64A}\u{628}`,
    ascending: `\u{62A}\u{635}\u{627}\u{639}\u{62F}\u{64A}`,
    descending: `\u{62A}\u{646}\u{627}\u{632}\u{644}\u{64A}`,
    expand: `\u{62A}\u{645}\u{62F}\u{64A}\u{62F}`,
    collapse: `\u{637}\u{64A}`,
  },
  "bg-BG": {
    ascendingSort: (args) =>
      `\u{441}\u{43E}\u{440}\u{442}\u{438}\u{440}\u{430}\u{43D}\u{43E} \u{43F}\u{43E} \u{43A}\u{43E}\u{43B}\u{43E}\u{43D}\u{430} ${args.columnName} \u{432}\u{44A}\u{432} \u{432}\u{44A}\u{437}\u{445}\u{43E}\u{434}\u{44F}\u{449} \u{440}\u{435}\u{434}`,
    descendingSort: (args) =>
      `\u{441}\u{43E}\u{440}\u{442}\u{438}\u{440}\u{430}\u{43D}\u{43E} \u{43F}\u{43E} \u{43A}\u{43E}\u{43B}\u{43E}\u{43D}\u{430} ${args.columnName} \u{432} \u{43D}\u{438}\u{437}\u{445}\u{43E}\u{434}\u{44F}\u{449} \u{440}\u{435}\u{434}`,
    sortable: `\u{441}\u{43E}\u{440}\u{442}\u{438}\u{440}\u{430}\u{449}\u{430} \u{43A}\u{43E}\u{43B}\u{43E}\u{43D}\u{430}`,
    ascending: `\u{432}\u{44A}\u{437}\u{445}\u{43E}\u{434}\u{44F}\u{449}`,
    descending: `\u{43D}\u{438}\u{437}\u{445}\u{43E}\u{434}\u{44F}\u{449}`,
    expand: `\u{420}\u{430}\u{437}\u{448}\u{438}\u{440}\u{44F}\u{432}\u{430}\u{43D}\u{435}`,
    collapse: `\u{421}\u{432}\u{438}\u{432}\u{430}\u{43D}\u{435}`,
  },
  "cs-CZ": {
    ascendingSort: (args) => `\u{159}azeno vzestupn\u{11B} podle sloupce ${args.columnName}`,
    descendingSort: (args) => `\u{159}azeno sestupn\u{11B} podle sloupce ${args.columnName}`,
    sortable: `sloupec s mo\u{17E}nost\xed \u{159}azen\xed`,
    ascending: `vzestupn\u{11B}`,
    descending: `sestupn\u{11B}`,
    expand: `Rozt\xe1hnout`,
    collapse: `Sbalit`,
  },
  "da-DK": {
    ascendingSort: (args) => `sorteret efter kolonne ${args.columnName} i stigende r\xe6kkef\xf8lge`,
    descendingSort: (args) => `sorteret efter kolonne ${args.columnName} i faldende r\xe6kkef\xf8lge`,
    sortable: `sorterbar kolonne`,
    ascending: `stigende`,
    descending: `faldende`,
    expand: `Udvid`,
    collapse: `Skjul`,
  },
  "de-DE": {
    ascendingSort: (args) => `sortiert nach Spalte ${args.columnName} in aufsteigender Reihenfolge`,
    descendingSort: (args) => `sortiert nach Spalte ${args.columnName} in absteigender Reihenfolge`,
    sortable: `sortierbare Spalte`,
    ascending: `aufsteigend`,
    descending: `absteigend`,
    expand: `Erweitern`,
    collapse: `Reduzieren`,
  },
  "el-GR": {
    ascendingSort: (args) =>
      `\u{3B4}\u{3B9}\u{3B1}\u{3BB}\u{3BF}\u{3B3}\u{3AE} \u{3B1}\u{3BD}\u{3AC} \u{3C3}\u{3C4}\u{3AE}\u{3BB}\u{3B7} ${args.columnName} \u{3C3}\u{3B5} \u{3B1}\u{3CD}\u{3BE}\u{3BF}\u{3C5}\u{3C3}\u{3B1} \u{3C3}\u{3B5}\u{3B9}\u{3C1}\u{3AC}`,
    descendingSort: (args) =>
      `\u{3B4}\u{3B9}\u{3B1}\u{3BB}\u{3BF}\u{3B3}\u{3AE} \u{3B1}\u{3BD}\u{3AC} \u{3C3}\u{3C4}\u{3AE}\u{3BB}\u{3B7} ${args.columnName} \u{3C3}\u{3B5} \u{3C6}\u{3B8}\u{3AF}\u{3BD}\u{3BF}\u{3C5}\u{3C3}\u{3B1} \u{3C3}\u{3B5}\u{3B9}\u{3C1}\u{3AC}`,
    sortable: `\u{3A3}\u{3C4}\u{3AE}\u{3BB}\u{3B7} \u{3B4}\u{3B9}\u{3B1}\u{3BB}\u{3BF}\u{3B3}\u{3AE}\u{3C2}`,
    ascending: `\u{3B1}\u{3CD}\u{3BE}\u{3BF}\u{3C5}\u{3C3}\u{3B1}`,
    descending: `\u{3C6}\u{3B8}\u{3AF}\u{3BD}\u{3BF}\u{3C5}\u{3C3}\u{3B1}`,
    expand: `\u{391}\u{3BD}\u{3AC}\u{3C0}\u{3C4}\u{3C5}\u{3BE}\u{3B7}`,
    collapse: `\u{3A3}\u{3CD}\u{3BC}\u{3C0}\u{3C4}\u{3C5}\u{3BE}\u{3B7}`,
  },
  "en-US": {
    ascendingSort: (args) => `sorted by column ${args.columnName} in ascending order`,
    descendingSort: (args) => `sorted by column ${args.columnName} in descending order`,
    sortable: `sortable column`,
    ascending: `ascending`,
    descending: `descending`,
    expand: `Expand`,
    collapse: `Collapse`,
  },
  "es-ES": {
    ascendingSort: (args) => `ordenado por columna ${args.columnName} en sentido ascendente`,
    descendingSort: (args) => `ordenado por columna ${args.columnName} en orden descendente`,
    sortable: `columna ordenable`,
    ascending: `ascendente`,
    descending: `descendente`,
    expand: `Ampliar`,
    collapse: `Contraer`,
  },
  "et-EE": {
    ascendingSort: (args) => `sorditud veeru j\xe4rgi ${args.columnName} t\xf5usvas j\xe4rjestuses`,
    descendingSort: (args) => `sorditud veeru j\xe4rgi ${args.columnName} laskuvas j\xe4rjestuses`,
    sortable: `sorditav veerg`,
    ascending: `t\xf5usev j\xe4rjestus`,
    descending: `laskuv j\xe4rjestus`,
    expand: `Laienda`,
    collapse: `Ahenda`,
  },
  "fi-FI": {
    ascendingSort: (args) => `lajiteltu sarakkeen ${args.columnName} mukaan nousevassa j\xe4rjestyksess\xe4`,
    descendingSort: (args) => `lajiteltu sarakkeen ${args.columnName} mukaan laskevassa j\xe4rjestyksess\xe4`,
    sortable: `lajiteltava sarake`,
    ascending: `nouseva`,
    descending: `laskeva`,
    expand: `Laajenna`,
    collapse: `Pienenn\xe4`,
  },
  "fr-FR": {
    ascendingSort: (args) => `tri\xe9 en fonction de la colonne\xa0${args.columnName} par ordre croissant`,
    descendingSort: (args) => `tri\xe9 en fonction de la colonne\xa0${args.columnName} par ordre d\xe9croissant`,
    sortable: `colonne triable`,
    ascending: `croissant`,
    descending: `d\xe9croissant`,
    expand: `D\xe9velopper`,
    collapse: `R\xe9duire`,
  },
  "he-IL": {
    ascendingSort: (args) =>
      `\u{5DE}\u{5D5}\u{5D9}\u{5DF} \u{5DC}\u{5E4}\u{5D9} \u{5E2}\u{5DE}\u{5D5}\u{5D3}\u{5D4} ${args.columnName} \u{5D1}\u{5E1}\u{5D3}\u{5E8} \u{5E2}\u{5D5}\u{5DC}\u{5D4}`,
    descendingSort: (args) =>
      `\u{5DE}\u{5D5}\u{5D9}\u{5DF} \u{5DC}\u{5E4}\u{5D9} \u{5E2}\u{5DE}\u{5D5}\u{5D3}\u{5D4} ${args.columnName} \u{5D1}\u{5E1}\u{5D3}\u{5E8} \u{5D9}\u{5D5}\u{5E8}\u{5D3}`,
    sortable: `\u{5E2}\u{5DE}\u{5D5}\u{5D3}\u{5D4} \u{5E9}\u{5E0}\u{5D9}\u{5EA}\u{5DF} \u{5DC}\u{5DE}\u{5D9}\u{5D9}\u{5DF}`,
    ascending: `\u{5E2}\u{5D5}\u{5DC}\u{5D4}`,
    descending: `\u{5D9}\u{5D5}\u{5E8}\u{5D3}`,
    expand: `\u{5D4}\u{5E8}\u{5D7}\u{5D1}`,
    collapse: `\u{5DB}\u{5D5}\u{5D5}\u{5E5}`,
  },
  "hr-HR": {
    ascendingSort: (args) => `razvrstano po stupcima ${args.columnName} rastu\u{107}em redoslijedom`,
    descendingSort: (args) => `razvrstano po stupcima ${args.columnName} padaju\u{107}im redoslijedom`,
    sortable: `stupac koji se mo\u{17E}e razvrstati`,
    ascending: `rastu\u{107}i`,
    descending: `padaju\u{107}i`,
    expand: `Pro\u{161}iri`,
    collapse: `Sa\u{17E}mi`,
  },
  "hu-HU": {
    ascendingSort: (args) => `rendezve a(z) ${args.columnName} oszlop szerint, n\xf6vekv\u{151} sorrendben`,
    descendingSort: (args) => `rendezve a(z) ${args.columnName} oszlop szerint, cs\xf6kken\u{151} sorrendben`,
    sortable: `rendezend\u{151} oszlop`,
    ascending: `n\xf6vekv\u{151}`,
    descending: `cs\xf6kken\u{151}`,
    expand: `Kibont\xe1s`,
    collapse: `\xd6sszecsuk\xe1s`,
  },
  "it-IT": {
    ascendingSort: (args) => `in ordine crescente in base alla colonna ${args.columnName}`,
    descendingSort: (args) => `in ordine decrescente in base alla colonna ${args.columnName}`,
    sortable: `colonna ordinabile`,
    ascending: `crescente`,
    descending: `decrescente`,
    expand: `Espandi`,
    collapse: `Comprimi`,
  },
  "ja-JP": {
    ascendingSort: (args) =>
      `\u{5217} ${args.columnName} \u{3092}\u{6607}\u{9806}\u{3067}\u{4E26}\u{3079}\u{66FF}\u{3048}`,
    descendingSort: (args) =>
      `\u{5217} ${args.columnName} \u{3092}\u{964D}\u{9806}\u{3067}\u{4E26}\u{3079}\u{66FF}\u{3048}`,
    sortable: `\u{4E26}\u{3079}\u{66FF}\u{3048}\u{53EF}\u{80FD}\u{306A}\u{5217}`,
    ascending: `\u{6607}\u{9806}`,
    descending: `\u{964D}\u{9806}`,
    expand: `\u{5C55}\u{958B}`,
    collapse: `\u{6298}\u{308A}\u{305F}\u{305F}\u{3080}`,
  },
  "ko-KR": {
    ascendingSort: (args) =>
      `${args.columnName} \u{C5F4}\u{C744} \u{AE30}\u{C900}\u{C73C}\u{B85C} \u{C624}\u{B984}\u{CC28}\u{C21C}\u{C73C}\u{B85C} \u{C815}\u{B82C}\u{B428}`,
    descendingSort: (args) =>
      `${args.columnName} \u{C5F4}\u{C744} \u{AE30}\u{C900}\u{C73C}\u{B85C} \u{B0B4}\u{B9BC}\u{CC28}\u{C21C}\u{C73C}\u{B85C} \u{C815}\u{B82C}\u{B428}`,
    sortable: `\u{C815}\u{B82C} \u{AC00}\u{B2A5}\u{D55C} \u{C5F4}`,
    ascending: `\u{C624}\u{B984}\u{CC28}\u{C21C}`,
    descending: `\u{B0B4}\u{B9BC}\u{CC28}\u{C21C}`,
    expand: `\u{D3BC}\u{CE58}\u{AE30}`,
    collapse: `\u{C811}\u{AE30}`,
  },
  "lt-LT": {
    ascendingSort: (args) => `surikiuota pagal stulpel\u{12F} ${args.columnName} did\u{117}jan\u{10D}ia tvarka`,
    descendingSort: (args) => `surikiuota pagal stulpel\u{12F} ${args.columnName} ma\u{17E}\u{117}jan\u{10D}ia tvarka`,
    sortable: `rikiuojamas stulpelis`,
    ascending: `did\u{117}jan\u{10D}ia tvarka`,
    descending: `ma\u{17E}\u{117}jan\u{10D}ia tvarka`,
    expand: `I\u{161}skleisti`,
    collapse: `Sutraukti`,
  },
  "lv-LV": {
    ascendingSort: (args) =>
      `k\u{101}rtots p\u{113}c kolonnas ${args.columnName} augo\u{161}\u{101} sec\u{12B}b\u{101}`,
    descendingSort: (args) =>
      `k\u{101}rtots p\u{113}c kolonnas ${args.columnName} dilsto\u{161}\u{101} sec\u{12B}b\u{101}`,
    sortable: `k\u{101}rtojam\u{101} kolonna`,
    ascending: `augo\u{161}\u{101} sec\u{12B}b\u{101}`,
    descending: `dilsto\u{161}\u{101} sec\u{12B}b\u{101}`,
    expand: `Izv\u{113}rst`,
    collapse: `Sak\u{13C}aut`,
  },
  "nb-NO": {
    ascendingSort: (args) => `sortert etter kolonne ${args.columnName} i stigende rekkef\xf8lge`,
    descendingSort: (args) => `sortert etter kolonne ${args.columnName} i synkende rekkef\xf8lge`,
    sortable: `kolonne som kan sorteres`,
    ascending: `stigende`,
    descending: `synkende`,
    expand: `Utvid`,
    collapse: `Skjul`,
  },
  "nl-NL": {
    ascendingSort: (args) => `gesorteerd in oplopende volgorde in kolom ${args.columnName}`,
    descendingSort: (args) => `gesorteerd in aflopende volgorde in kolom ${args.columnName}`,
    sortable: `sorteerbare kolom`,
    ascending: `oplopend`,
    descending: `aflopend`,
    expand: `Uitvouwen`,
    collapse: `Samenvouwen`,
  },
  "pl-PL": {
    ascendingSort: (args) => `posortowano wed\u{142}ug kolumny ${args.columnName} w porz\u{105}dku rosn\u{105}cym`,
    descendingSort: (args) => `posortowano wed\u{142}ug kolumny ${args.columnName} w porz\u{105}dku malej\u{105}cym`,
    sortable: `kolumna z mo\u{17C}liwo\u{15B}ci\u{105} sortowania`,
    ascending: `rosn\u{105}co`,
    descending: `malej\u{105}co`,
    expand: `Rozwi\u{144}`,
    collapse: `Zwi\u{144}`,
  },
  "pt-BR": {
    ascendingSort: (args) => `classificado pela coluna ${args.columnName} em ordem crescente`,
    descendingSort: (args) => `classificado pela coluna ${args.columnName} em ordem decrescente`,
    sortable: `coluna classific\xe1vel`,
    ascending: `crescente`,
    descending: `decrescente`,
    expand: `Expandir`,
    collapse: `Recolher`,
  },
  "pt-PT": {
    ascendingSort: (args) => `Ordenar por coluna ${args.columnName} em ordem ascendente`,
    descendingSort: (args) => `Ordenar por coluna ${args.columnName} em ordem descendente`,
    sortable: `Coluna orden\xe1vel`,
    ascending: `ascendente`,
    descending: `descendente`,
    expand: `Expandir`,
    collapse: `Colapsar`,
  },
  "ro-RO": {
    ascendingSort: (args) => `sortate dup\u{103} coloana ${args.columnName} \xeen ordine cresc\u{103}toare`,
    descendingSort: (args) => `sortate dup\u{103} coloana ${args.columnName} \xeen ordine descresc\u{103}toare`,
    sortable: `coloan\u{103} sortabil\u{103}`,
    ascending: `cresc\u{103}toare`,
    descending: `descresc\u{103}toare`,
    expand: `Extinde\u{21B}i`,
    collapse: `Restr\xe2nge\u{21B}i`,
  },
  "ru-RU": {
    ascendingSort: (args) =>
      `\u{441}\u{43E}\u{440}\u{442}\u{438}\u{440}\u{43E}\u{432}\u{430}\u{442}\u{44C} \u{441}\u{442}\u{43E}\u{43B}\u{431}\u{435}\u{446} ${args.columnName} \u{432} \u{43F}\u{43E}\u{440}\u{44F}\u{434}\u{43A}\u{435} \u{432}\u{43E}\u{437}\u{440}\u{430}\u{441}\u{442}\u{430}\u{43D}\u{438}\u{44F}`,
    descendingSort: (args) =>
      `\u{441}\u{43E}\u{440}\u{442}\u{438}\u{440}\u{43E}\u{432}\u{430}\u{442}\u{44C} \u{441}\u{442}\u{43E}\u{43B}\u{431}\u{435}\u{446} ${args.columnName} \u{432} \u{43F}\u{43E}\u{440}\u{44F}\u{434}\u{43A}\u{435} \u{443}\u{431}\u{44B}\u{432}\u{430}\u{43D}\u{438}\u{44F}`,
    sortable: `\u{441}\u{43E}\u{440}\u{442}\u{438}\u{440}\u{443}\u{435}\u{43C}\u{44B}\u{439} \u{441}\u{442}\u{43E}\u{43B}\u{431}\u{435}\u{446}`,
    ascending: `\u{432}\u{43E}\u{437}\u{440}\u{430}\u{441}\u{442}\u{430}\u{43D}\u{438}\u{435}`,
    descending: `\u{443}\u{431}\u{44B}\u{432}\u{430}\u{43D}\u{438}\u{435}`,
    expand: `\u{420}\u{430}\u{437}\u{432}\u{435}\u{440}\u{43D}\u{443}\u{442}\u{44C}`,
    collapse: `\u{421}\u{432}\u{435}\u{440}\u{43D}\u{443}\u{442}\u{44C}`,
  },
  "sk-SK": {
    ascendingSort: (args) => `zoraden\xe9 zostupne pod\u{13E}a st\u{13A}pca ${args.columnName}`,
    descendingSort: (args) => `zoraden\xe9 zostupne pod\u{13E}a st\u{13A}pca ${args.columnName}`,
    sortable: `zoradite\u{13E}n\xfd st\u{13A}pec`,
    ascending: `vzostupne`,
    descending: `zostupne`,
    expand: `Rozbali\u{165}`,
    collapse: `Zbali\u{165}`,
  },
  "sl-SI": {
    ascendingSort: (args) =>
      `razvr\u{161}\u{10D}eno po stolpcu ${args.columnName} v nara\u{161}\u{10D}ajo\u{10D}em vrstnem redu`,
    descendingSort: (args) => `razvr\u{161}\u{10D}eno po stolpcu ${args.columnName} v padajo\u{10D}em vrstnem redu`,
    sortable: `razvrstljivi stolpec`,
    ascending: `nara\u{161}\u{10D}ajo\u{10D}e`,
    descending: `padajo\u{10D}e`,
    expand: `Raz\u{161}iri`,
    collapse: `Strni`,
  },
  "sr-SP": {
    ascendingSort: (args) => `sortirano po kolonama ${args.columnName} rastu\u{107}im redosledom`,
    descendingSort: (args) => `sortirano po kolonama ${args.columnName} padaju\u{107}im redosledom`,
    sortable: `kolona koja se mo\u{17E}e sortirati`,
    ascending: `rastu\u{107}i`,
    descending: `padaju\u{107}i`,
    expand: `Pro\u{161}iri`,
    collapse: ` Skupi`,
  },
  "sv-SE": {
    ascendingSort: (args) => `sorterat p\xe5 kolumn ${args.columnName} i stigande ordning`,
    descendingSort: (args) => `sorterat p\xe5 kolumn ${args.columnName} i fallande ordning`,
    sortable: `sorterbar kolumn`,
    ascending: `stigande`,
    descending: `fallande`,
    expand: `Expandera`,
    collapse: `D\xf6lj`,
  },
  "tr-TR": {
    ascendingSort: (args) => `${args.columnName} s\xfctuna g\xf6re artan d\xfczende s\u{131}rala`,
    descendingSort: (args) => `${args.columnName} s\xfctuna g\xf6re azalan d\xfczende s\u{131}rala`,
    sortable: `S\u{131}ralanabilir s\xfctun`,
    ascending: `artan s\u{131}rada`,
    descending: `azalan s\u{131}rada`,
    expand: `Geni\u{15F}let`,
    collapse: `Daralt`,
  },
  "uk-UA": {
    ascendingSort: (args) =>
      `\u{432}\u{456}\u{434}\u{441}\u{43E}\u{440}\u{442}\u{43E}\u{432}\u{430}\u{43D}\u{43E} \u{437}\u{430} \u{441}\u{442}\u{43E}\u{432}\u{43F}\u{446}\u{435}\u{43C} ${args.columnName} \u{443} \u{432}\u{438}\u{441}\u{445}\u{456}\u{434}\u{43D}\u{43E}\u{43C}\u{443} \u{43F}\u{43E}\u{440}\u{44F}\u{434}\u{43A}\u{443}`,
    descendingSort: (args) =>
      `\u{432}\u{456}\u{434}\u{441}\u{43E}\u{440}\u{442}\u{43E}\u{432}\u{430}\u{43D}\u{43E} \u{437}\u{430} \u{441}\u{442}\u{43E}\u{432}\u{43F}\u{446}\u{435}\u{43C} ${args.columnName} \u{443} \u{43D}\u{438}\u{437}\u{445}\u{456}\u{434}\u{43D}\u{43E}\u{43C}\u{443} \u{43F}\u{43E}\u{440}\u{44F}\u{434}\u{43A}\u{443}`,
    sortable: `\u{441}\u{43E}\u{440}\u{442}\u{443}\u{432}\u{430}\u{43B}\u{44C}\u{43D}\u{438}\u{439} \u{441}\u{442}\u{43E}\u{432}\u{43F}\u{435}\u{446}\u{44C}`,
    ascending: `\u{432}\u{438}\u{441}\u{445}\u{456}\u{434}\u{43D}\u{438}\u{439}`,
    descending: `\u{43D}\u{438}\u{437}\u{445}\u{456}\u{434}\u{43D}\u{438}\u{439}`,
    expand: `\u{420}\u{43E}\u{437}\u{433}\u{43E}\u{440}\u{43D}\u{443}\u{442}\u{438}`,
    collapse: `\u{417}\u{433}\u{43E}\u{440}\u{43D}\u{443}\u{442}\u{438}`,
  },
  "zh-CN": {
    ascendingSort: (args) => `\u{6309}\u{5217} ${args.columnName} \u{5347}\u{5E8F}\u{6392}\u{5E8F}`,
    descendingSort: (args) => `\u{6309}\u{5217} ${args.columnName} \u{964D}\u{5E8F}\u{6392}\u{5E8F}`,
    sortable: `\u{53EF}\u{6392}\u{5E8F}\u{7684}\u{5217}`,
    ascending: `\u{5347}\u{5E8F}`,
    descending: `\u{964D}\u{5E8F}`,
    expand: `\u{6269}\u{5C55}`,
    collapse: `\u{6298}\u{53E0}`,
  },
  "zh-TW": {
    ascendingSort: (args) =>
      `\u{5DF2}\u{4F9D}\u{64DA}\u{300C}${args.columnName}\u{300D}\u{6B04}\u{905E}\u{589E}\u{6392}\u{5E8F}`,
    descendingSort: (args) =>
      `\u{5DF2}\u{4F9D}\u{64DA}\u{300C}${args.columnName}\u{300D}\u{6B04}\u{905E}\u{6E1B}\u{6392}\u{5E8F}`,
    sortable: `\u{53EF}\u{6392}\u{5E8F}\u{7684}\u{6B04}`,
    ascending: `\u{905E}\u{589E}`,
    descending: `\u{905E}\u{6E1B}`,
    expand: `\u{5C55}\u{958B}`,
    collapse: `\u{6536}\u{5408}`,
  },
}
