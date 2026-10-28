import { NativeDropDataOwner } from "../transfer"
import type { TNativeDropDataDriver, TNativeDropFileBody, TNativeDropDirectoryPage } from "../transfer"
import type { TNativeFileDropItem, TNativeDirectoryDropItem } from "../types"

const HostBlob = (jest.requireActual("node:buffer") as { Blob: typeof Blob }).Blob

const setup = () => {
  const text = new Map([
    ["text:text/plain", ""],
    ["file:", "original text"],
    ["child:", "retained child"],
  ])
  const driver: TNativeDropDataDriver = {
    readText: jest.fn(async (handle, type) => {
      const value = text.get(`${handle}:${type ?? ""}`)
      if (value === undefined) throw new Error("original native representation unavailable")
      return value
    }),
    readFile: jest.fn(async () => ({
      handle: "body",
      blob: new HostBlob(["abcdef"], { type: "application/octet-stream", lastModified: 17 }),
      name: "original.bin",
      lastModified: 17,
      uri: "content://original/granted-file",
    })),
    readDirectory: jest.fn(
      async (): Promise<TNativeDropDirectoryPage> => ({
        items: [
          { kind: "file", handle: "child", name: "child.txt", type: "text/plain" },
          { kind: "file", handle: "unread", name: "unread.txt", type: "text/plain" },
        ],
        cursor: "original-cursor",
      }),
    ),
    closeDirectory: jest.fn(),
    release: jest.fn(),
  }
  return { driver, owner: new NativeDropDataOwner(driver) }
}

it("preserves empty/custom text values and admits only original representations", async () => {
  const f = setup()
  const item = f.owner.item({ kind: "text", handle: "text", types: ["text/plain"] })
  if (item.kind !== "text") throw new Error("Expected text item")
  expect(await item.getText("text/plain")).toBe("")
  item.types.add("application/not-offered")
  await expect(item.getText("application/not-offered")).rejects.toThrow("unavailable text type")
  item.release()
  item.release()
  await expect(item.getText("text/plain")).rejects.toThrow("released")
  expect(f.driver.release).toHaveBeenCalledTimes(1)
  expect(f.driver.release).toHaveBeenCalledWith("text")
})

it("returns the actual Blob with read-only native metadata and an independent file lifetime", async () => {
  const f = setup()
  const item = f.owner.item({ kind: "file", handle: "file", name: "original.bin", type: "application/octet-stream" })
  if (item.kind !== "file") throw new Error("Expected file item")
  expect(await item.getText()).toBe("original text")
  const file = await item.getFile()
  expect(file).toBeInstanceOf(HostBlob)
  expect(file).toMatchObject({
    name: "original.bin",
    size: 6,
    type: "application/octet-stream",
    lastModified: 17,
    uri: "content://original/granted-file",
  })
  expect(Object.getOwnPropertyDescriptor(file, "name")!.writable).toBe(false)
  item.release()
  expect(f.driver.release).toHaveBeenCalledWith("file")
  expect(f.driver.release).not.toHaveBeenCalledWith("body")
  expect(file.slice(1, 3).size).toBe(2)
  file.release()
  file.release()
  expect(f.driver.release).toHaveBeenCalledWith("body")
  expect(() => file.slice()).toThrow("released")
  expect(f.driver.release).toHaveBeenCalledTimes(2)
})

it("closes cancelled directory cursors and unyielded entries while preserving yielded children", async () => {
  const f = setup()
  const item = f.owner.item({ kind: "directory", handle: "directory", name: "Original directory" })
  if (item.kind !== "directory") throw new Error("Expected directory item")
  let first: TNativeFileDropItem | TNativeDirectoryDropItem | undefined
  for await (const child of item.getEntries()) {
    first = child
    break
  }
  expect(f.driver.closeDirectory).toHaveBeenCalledWith("directory", "original-cursor")
  expect(f.driver.release).toHaveBeenCalledWith("unread")
  expect(f.driver.release).not.toHaveBeenCalledWith("child")
  item.release()
  if (!first || first.kind !== "file") throw new Error("Expected retained file child")
  expect(await first.getText()).toBe("retained child")
  first!.release()
  f.owner.dispose()
  expect(f.driver.release).toHaveBeenCalledTimes(3)
})

it("retains original native read errors without replacing unreadable files with empty data", async () => {
  const f = setup()
  const item = f.owner.item({ kind: "file", handle: "unavailable", name: "original", type: "application/custom" })
  if (item.kind !== "file") throw new Error("Expected file item")
  await expect(item.getText()).rejects.toThrow("original native representation unavailable")
  item.release()
})

it("releases a late native file result if the original item is explicitly released while loading", async () => {
  const f = setup()
  let resolve!: (body: TNativeDropFileBody) => void
  f.driver.readFile = jest.fn(
    () =>
      new Promise<TNativeDropFileBody>((done) => {
        resolve = done
      }),
  )
  const item = f.owner.item({ kind: "file", handle: "file", name: "original", type: "text/plain" })
  if (item.kind !== "file") throw new Error("Expected file item")
  const pending = item.getFile()
  item.release()
  resolve({ handle: "late-body", blob: new HostBlob(["original"]), name: "original" })
  await expect(pending).rejects.toThrow("released")
  expect(f.driver.release).toHaveBeenCalledWith("late-body")
  expect(f.driver.release).toHaveBeenCalledTimes(2)
})

it("cleans a late directory page and closes its actual cursor after module retirement", async () => {
  const f = setup()
  let resolve!: (body: TNativeDropDirectoryPage) => void
  f.driver.readDirectory = jest.fn(
    () =>
      new Promise<TNativeDropDirectoryPage>((done) => {
        resolve = done
      }),
  )
  const item = f.owner.item({ kind: "directory", handle: "directory", name: "original" })
  if (item.kind !== "directory") throw new Error("Expected directory item")
  const iterator = item.getEntries()[Symbol.asyncIterator]()
  const pending = iterator.next()
  f.owner.dispose()
  resolve({
    items: [{ kind: "file", handle: "late-child", type: "text/plain", name: "original.txt" }],
    cursor: "late-cursor",
  })
  await expect(pending).rejects.toThrow("released")
  expect(f.driver.release).toHaveBeenCalledWith("late-child")
  expect(f.driver.closeDirectory).toHaveBeenCalledWith("directory", "late-cursor")
})

it("rejects duplicate transfer handles without releasing the original live value", async () => {
  const f = setup()
  const item = f.owner.item({ kind: "text", handle: "text", types: ["text/plain"] })
  expect(() => f.owner.item({ kind: "text", handle: "text", types: ["text/plain"] })).toThrow("duplicate")
  expect(f.driver.release).not.toHaveBeenCalled()
  if (item.kind !== "text") throw new Error("Expected text item")
  expect(await item.getText("text/plain")).toBe("")
  f.owner.dispose()
})

it("preserves formatless source records and authored empty format names", async () => {
  const f = setup()
  f.driver.readText = jest.fn(async () => "original empty-format value")
  const empty = f.owner.item({ kind: "text", handle: "empty", types: [] })
  const item = f.owner.item({ kind: "text", handle: "empty-format", types: [""] })
  if (empty.kind !== "text" || item.kind !== "text") throw new Error("Expected original text items")
  expect(empty.types.size).toBe(0)
  expect(await item.getText("")).toBe("original empty-format value")
  await expect(empty.getText("")).rejects.toThrow("unavailable text type")
  f.owner.dispose()
})
