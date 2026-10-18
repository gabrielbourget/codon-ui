export type TReceiptFileSystem = {
  cacheDirectory: string | null
  writeAsStringAsync: (uri: string, contents: string, options: { encoding: "utf8"; append: false }) => Promise<void>
}

export const createReceiptJournal = (
  probe: string,
  getFileSystem: () => TReceiptFileSystem,
  log: (line: string) => void,
) => {
  if (!/^codon-native-menu-focus-v[1-9]\d*$/.test(probe)) throw new TypeError("Invalid private receipt identity")
  const lines: string[] = []
  let closed = false
  let writing: Promise<string> | undefined
  return {
    append: (record: Record<string, unknown>) => {
      if (closed) throw new Error("Receipt is already complete")
      const line = `CUI_MENU_FOCUS ${JSON.stringify({ probe, ...record })}`
      lines.push(line)
      log(line)
    },
    flush: (): Promise<string> => {
      if (writing) return writing
      closed = true
      const contents = lines.join("\n") + "\n"
      writing = Promise.resolve().then(async () => {
        const fileSystem = getFileSystem()
        if (!fileSystem.cacheDirectory?.startsWith("file://")) throw new Error("App cache directory unavailable")
        const uri = `${fileSystem.cacheDirectory.replace(/\/?$/, "/")}${probe}.jsonl`
        await fileSystem.writeAsStringAsync(uri, contents, { encoding: "utf8", append: false })
        return uri
      })
      return writing
    },
  }
}
