import "../../../../apps/native-showcase/src/runtime/number-format"

import { registerRootComponent, requireNativeModule } from "expo"
import { useCallback, useState } from "react"

import { FieldInputSDKScene } from "./FieldInputSDKApp"
import { SOURCE_PRODUCER } from "./identity"
import { createTimeEntryJournal, TIME_ENTRY_PROBE } from "./sdk"

const App = () => {
  const [journal] = useState(() =>
    createTimeEntryJournal(SOURCE_PRODUCER, async (encoded) => {
      const fs = requireNativeModule<{
        cacheDirectory: string | null
        writeAsStringAsync: (path: string, text: string, options: { encoding: "utf8" }) => Promise<void>
      }>("ExponentFileSystem")
      if (!fs.cacheDirectory) throw new Error("Original native cache unavailable")
      await fs.writeAsStringAsync(`${fs.cacheDirectory.replace(/\/?$/, "/")}${TIME_ENTRY_PROBE}.jsonl`, encoded, {
        encoding: "utf8",
      })
    }),
  )
  const record = useCallback(
    (row: Record<string, unknown>) => {
      void journal.record(row).catch((error: unknown) => console.warn(`CUI_FIELD_INPUT_SDK_PERSIST ${String(error)}`))
    },
    [journal],
  )
  return <FieldInputSDKScene record={record} />
}
registerRootComponent(App)
