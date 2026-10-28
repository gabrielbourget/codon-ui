import NativeModule from "../../../input/specs/NativeCUIDragAndDrop"
import { NativeDragDataBinding } from "../nativeData"

jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "native-module"),
    readItems: jest.fn(),
    adoptItems: jest.fn(() => true),
    readText: jest.fn(),
    readFile: jest.fn(),
    adoptFile: jest.fn(() => true),
    readDirectory: jest.fn(),
    closeDirectory: jest.fn(),
    releaseData: jest.fn(),
  },
}))
jest.mock("react-native/Libraries/Blob/NativeBlobModule", () => ({
  __esModule: true,
  default: { release: jest.fn() },
}))

const native = NativeModule as jest.Mocked<NonNullable<typeof NativeModule>>
const SDKBlob = jest.requireActual<{ default: typeof Blob }>("react-native/Libraries/Blob/Blob").default
const SDKBlobModule = jest.requireMock<{ default: { release: jest.Mock } }>(
  "react-native/Libraries/Blob/NativeBlobModule",
).default
const handle = (suffix: string) => `native-module:${suffix}`
const request = (suffix: string, extra: object = {}) =>
  JSON.stringify({ moduleId: "native-module", handle: handle(suffix), ...extra })
const fileRecord = (suffix = "file") => ({
  handle: handle(suffix),
  kind: "file",
  name: "Original.bin",
  type: "application/octet-stream",
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  jest.clearAllMocks()
  native.adoptItems.mockReturnValue(true)
  native.adoptFile.mockReturnValue(true)
})

it("claims one original native transfer, preserving representation order, empty names and empty maps", async () => {
  const binding = new NativeDragDataBinding()
  native.readItems.mockResolvedValue(
    JSON.stringify([
      { kind: "text", handle: handle("text"), types: ["application/custom", "", "text/plain"] },
      { kind: "text", handle: handle("empty"), types: [] },
    ]),
  )
  native.readText.mockResolvedValue("")
  const items = await binding.takeItems(handle("transfer"), () => true)
  expect(native.readItems).toHaveBeenCalledWith(request("transfer"))
  expect(native.adoptItems).toHaveBeenCalledWith(request("transfer"))
  const item = items[0]
  if (item.kind !== "text" || items[1].kind !== "text") throw new Error("Expected original text records")
  expect([...item.types]).toEqual(["application/custom", "", "text/plain"])
  expect(items[1].types.size).toBe(0)
  expect(await item.getText("")).toBe("")
  expect(native.readText).toHaveBeenCalledWith(request("text", { type: "" }))
  binding.dispose()
  expect(native.releaseData).toHaveBeenCalledWith(request("text"))
  expect(native.releaseData).toHaveBeenCalledWith(request("empty"))
  expect(native.releaseData).not.toHaveBeenCalledWith(request("transfer"))
})

it("adopts an actual pinned SDK Blob and preserves its slice reference count after the original file release", async () => {
  const binding = new NativeDragDataBinding()
  const [item] = binding.items([fileRecord()])
  if (item.kind !== "file") throw new Error("Expected original file")
  native.readFile.mockResolvedValue(
    JSON.stringify({
      handle: handle("body"),
      blobId: "original-sdk-blob",
      offset: 0,
      size: 11,
      name: "Original.bin",
      type: "application/octet-stream",
      lastModified: 0,
      uri: "file:///owned/copy/data",
    }),
  )
  const file = await item.getFile()
  expect(file).toBeInstanceOf(SDKBlob)
  expect(native.adoptFile).toHaveBeenCalledWith(request("body"))
  expect(file).toMatchObject({ name: "Original.bin", size: 11, type: "application/octet-stream", lastModified: 0 })
  expect(Object.getOwnPropertyDescriptor(file, "lastModified")!.writable).toBe(false)
  const slice = file.slice(2, 6)
  expect(slice).toBeInstanceOf(SDKBlob)
  expect(slice.size).toBe(4)
  item.release()
  file.release()
  expect(native.releaseData).toHaveBeenCalledWith(request("body"))
  expect(SDKBlobModule.release).not.toHaveBeenCalled()
  ;(slice as Blob & { close: () => void }).close()
  expect(SDKBlobModule.release).toHaveBeenCalledWith("original-sdk-blob")
  binding.dispose()
})

it("keeps an absent original modification date absent and releases a rejected body before publishing it", async () => {
  const binding = new NativeDragDataBinding()
  const [item] = binding.items([fileRecord()])
  if (item.kind !== "file") throw new Error("Expected original file")
  native.readFile.mockResolvedValue(
    JSON.stringify({
      handle: handle("undated-body"),
      blobId: "undated-sdk-blob",
      offset: 0,
      size: 0,
      name: "",
      type: "",
      uri: "file:///owned/copy/empty",
    }),
  )
  const file = await item.getFile()
  expect(Object.hasOwn(file, "lastModified")).toBe(false)
  file.release()
  native.adoptFile.mockReturnValue(false)
  native.readFile.mockResolvedValue(
    JSON.stringify({
      handle: handle("rejected-body"),
      blobId: "rejected-sdk-blob",
      offset: 0,
      size: 0,
      name: "",
      type: "",
    }),
  )
  await expect(item.getFile()).rejects.toThrow("retired before adoption")
  expect(native.releaseData).toHaveBeenCalledWith(request("rejected-body"))
  expect(SDKBlobModule.release).toHaveBeenCalledWith("rejected-sdk-blob")
  binding.dispose()
})

it("does not adopt pending transfer data when its collection retires and rejects concurrent claims", async () => {
  const binding = new NativeDragDataBinding(),
    data = deferred<string>()
  let live = true
  native.readItems.mockReturnValue(data.promise)
  const first = binding.takeItems(handle("transfer"), () => live)
  await expect(binding.takeItems(handle("transfer"), () => live)).rejects.toThrow("already claimed")
  live = false
  data.resolve(JSON.stringify([fileRecord()]))
  await expect(first).rejects.toThrow("owner retired")
  expect(native.adoptItems).not.toHaveBeenCalled()
  expect(native.releaseData).toHaveBeenCalledWith(request("transfer"))
  binding.dispose()
})

it("cleans partial data adoption while retaining the native failure", async () => {
  const binding = new NativeDragDataBinding()
  native.readItems.mockResolvedValue(JSON.stringify([fileRecord(), { handle: handle("invalid"), kind: "unknown" }]))
  await expect(binding.takeItems(handle("transfer"), () => true)).rejects.toThrow("unknown original item kind")
  expect(native.releaseData).toHaveBeenCalledWith(request("file"))
  expect(native.releaseData).toHaveBeenCalledWith(request("transfer"))
  binding.dispose()
})

it("cleans an entire late native directory page and cursor after binding disposal", async () => {
  const binding = new NativeDragDataBinding(),
    data = deferred<string>()
  const [item] = binding.items([{ kind: "directory", handle: handle("directory"), name: "Original" }])
  if (item.kind !== "directory") throw new Error("Expected original directory")
  native.readDirectory.mockReturnValue(data.promise)
  const iterator = item.getEntries()[Symbol.asyncIterator](),
    pending = iterator.next()
  binding.dispose()
  data.resolve(JSON.stringify({ items: [fileRecord("child")], cursor: handle("cursor") }))
  await expect(pending).rejects.toThrow("released")
  expect(native.releaseData).toHaveBeenCalledWith(request("child"))
  expect(native.closeDirectory).toHaveBeenCalledWith(request("directory", { cursor: handle("cursor") }))
})

it("releases all issued children and the real cursor when one directory descriptor is invalid", async () => {
  const binding = new NativeDragDataBinding()
  const [item] = binding.items([{ kind: "directory", handle: handle("directory"), name: "Original" }])
  if (item.kind !== "directory") throw new Error("Expected original directory")
  native.readDirectory.mockResolvedValue(
    JSON.stringify({
      items: [fileRecord("child"), { kind: "unknown", handle: handle("other") }],
      cursor: handle("cursor"),
    }),
  )
  await expect(item.getEntries()[Symbol.asyncIterator]().next()).rejects.toThrow("unknown original item kind")
  expect(native.releaseData).toHaveBeenCalledWith(request("child"))
  expect(native.releaseData).toHaveBeenCalledWith(request("other"))
  expect(native.closeDirectory).toHaveBeenCalledWith(request("directory", { cursor: handle("cursor") }))
  binding.dispose()
})
