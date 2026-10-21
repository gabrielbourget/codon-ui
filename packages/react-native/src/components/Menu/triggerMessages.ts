/* Copyright 2020 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
// Complete pinned react-aria 3.48.0 menu message dictionaries.
export const nativeMenuTriggerMessages: Readonly<Record<string, string>> = {
  "ar-AE": "اضغط مطولاً أو اضغط على Alt + السهم لأسفل لفتح القائمة",
  "bg-BG": "Натиснете продължително или натиснете Alt+ стрелка надолу, за да отворите менюто",
  "cs-CZ": "Dlouhým stiskem nebo stisknutím kláves Alt + šipka dolů otevřete nabídku",
  "da-DK": "Langt tryk eller tryk på Alt + pil ned for at åbne menuen",
  "de-DE": "Drücken Sie lange oder drücken Sie Alt + Nach-unten, um das Menü zu öffnen",
  "el-GR": "Πιέστε παρατεταμένα ή πατήστε Alt + κάτω βέλος για να ανοίξετε το μενού",
  "en-US": "Long press or press Alt + ArrowDown to open menu",
  "es-ES": "Mantenga pulsado o pulse Alt + flecha abajo para abrir el menú",
  "et-EE": "Menüü avamiseks vajutage pikalt või vajutage klahve Alt + allanool",
  "fi-FI": "Avaa valikko painamalla pohjassa tai näppäinyhdistelmällä Alt + Alanuoli",
  "fr-FR": "Appuyez de manière prolongée ou appuyez sur Alt + Flèche vers le bas pour ouvrir le menu.",
  "he-IL": "לחץ לחיצה ארוכה או הקש Alt + ArrowDown כדי לפתוח את התפריט",
  "hr-HR": "Dugo pritisnite ili pritisnite Alt + strelicu prema dolje za otvaranje izbornika",
  "hu-HU": "Nyomja meg hosszan, vagy nyomja meg az Alt + lefele nyíl gombot a menü megnyitásához",
  "it-IT": "Premi a lungo o premi Alt + Freccia giù per aprire il menu",
  "ja-JP": "長押しまたは Alt+下矢印キーでメニューを開く",
  "ko-KR": "길게 누르거나 Alt + 아래쪽 화살표를 눌러 메뉴 열기",
  "lt-LT": "Norėdami atidaryti meniu, nuspaudę palaikykite arba paspauskite „Alt + ArrowDown“.",
  "lv-LV": "Lai atvērtu izvēlni, turiet nospiestu vai nospiediet taustiņu kombināciju Alt + lejupvērstā bultiņa",
  "nb-NO": "Langt trykk eller trykk Alt + PilNed for å åpne menyen",
  "nl-NL": "Druk lang op Alt + pijl-omlaag of druk op Alt om het menu te openen",
  "pl-PL": "Naciśnij i przytrzymaj lub naciśnij klawisze Alt + Strzałka w dół, aby otworzyć menu",
  "pt-BR": "Pressione e segure ou pressione Alt + Seta para baixo para abrir o menu",
  "pt-PT": "Prima continuamente ou prima Alt + Seta Para Baixo para abrir o menu",
  "ro-RO": "Apăsați lung sau apăsați pe Alt + săgeată în jos pentru a deschide meniul",
  "ru-RU": "Нажмите и удерживайте или нажмите Alt + Стрелка вниз, чтобы открыть меню",
  "sk-SK": "Ponuku otvoríte dlhým stlačením alebo stlačením klávesu Alt + klávesu so šípkou nadol",
  "sl-SI": "Za odprtje menija pritisnite in držite gumb ali pritisnite Alt+puščica navzdol",
  "sr-SP": "Dugo pritisnite ili pritisnite Alt + strelicu prema dole da otvorite meni",
  "sv-SE": "Håll nedtryckt eller tryck på Alt + pil nedåt för att öppna menyn",
  "tr-TR": "Menüyü açmak için uzun basın veya Alt + Aşağı Ok tuşuna basın",
  "uk-UA": "Довго або звичайно натисніть комбінацію клавіш Alt і стрілка вниз, щоб відкрити меню",
  "zh-CN": "长按或按 Alt + 向下方向键以打开菜单",
  "zh-TW": "長按或按 Alt+向下鍵以開啟功能表",
}

export const nativeMenuLongPressDescription = (locale = new Intl.DateTimeFormat().resolvedOptions().locale) => {
  const language = typeof Intl.Locale === "function" ? new Intl.Locale(locale).language : locale.split("-")[0]
  const key = nativeMenuTriggerMessages[locale]
    ? locale
    : nativeMenuTriggerMessages[language]
      ? language
      : (Object.keys(nativeMenuTriggerMessages).find((name) => name.startsWith(language + "-")) ?? "en-US")
  return nativeMenuTriggerMessages[key]
}
