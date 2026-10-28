import Foundation
import UniformTypeIdentifiers

@objc(CUIDragDataStore)
final class CUIDragDataStore: NSObject {
  static let stringMapType = "app.codon-ui.drag-string-map"
  private final class WeakStore {
    weak var value: CUIDragDataStore?
    init(_ value: CUIDragDataStore) { self.value = value }
  }
  private static let registryLock = NSLock()
  private static var registry: [String: WeakStore] = [:]
  private final class Backing {
    let directory: URL
    var references = 0
    init(_ directory: URL) { self.directory = directory }
  }
  private final class Entry {
    let kind: String
    let backing: Backing?
    let url: URL?
    let name: String
    let type: String
    let modified: Double?
    let text: [String: String]
    let representations: [String]
    var blobId: String?
    var adopted = false
    init(kind: String, backing: Backing? = nil, url: URL? = nil, name: String = "", type: String = "",
         modified: Double? = nil, text: [String: String] = [:], representations: [String] = []) {
      self.kind = kind; self.backing = backing; self.url = url; self.name = name
      self.type = type; self.modified = modified; self.text = text; self.representations = representations
    }
  }
  private final class Cursor {
    let parent: String
    let backing: Backing
    let urls: [URL]
    var offset = 0
    var busy = false
    init(parent: String, backing: Backing, urls: [URL]) {
      self.parent = parent; self.backing = backing; self.urls = urls
    }
  }
  private final class Import {
    var results: [[String: Any]?]
    var progress: [Progress] = []
    let complete: ([[String: Any]]?, NSError?) -> Void
    init(count: Int, complete: @escaping ([[String: Any]]?, NSError?) -> Void) {
      results = Array(repeating: nil, count: count); self.complete = complete
    }
  }
  private final class Transfer {
    var importId = ""
    var results: [[String: Any]]?
    var error: NSError?
    var claimed = false
    var waiters: [([[String: Any]]?, NSError?) -> Void] = []
  }
  @objc let moduleId: String
  private let lock = NSRecursiveLock()
  private let cleanup = DispatchQueue(label: "codon.drag.data.cleanup", qos: .utility)
  private var cleanupErrors: [NSError] = []
  private let worker: DispatchQueue
  private let root: URL
  private let writer: (Data, String) -> [String: Any]?
  private let releaser: (String) -> Void
  private var live = true
  private var operations = 0
  private var entries: [String: Entry] = [:]
  private var cursors: [String: Cursor] = [:]
  private var imports: [String: Import] = [:]
  private var transfers: [String: Transfer] = [:]

  @objc(initWithModuleId:blobWriter:blobReleaser:)
  init?(moduleId: String, blobWriter: @escaping (Data, String) -> [String: Any]?, blobReleaser: @escaping (String) -> Void) {
    guard UUID(uuidString: moduleId) != nil else { return nil }
    self.moduleId = moduleId; writer = blobWriter; releaser = blobReleaser
    worker = DispatchQueue(label: "codon.drag.data.\(moduleId)", qos: .userInitiated, attributes: .concurrent)
    root = FileManager.default.temporaryDirectory.appendingPathComponent("codon-drag-\(moduleId)", isDirectory: true)
    super.init()
    Self.registryLock.lock(); Self.registry[moduleId] = WeakStore(self); Self.registryLock.unlock()
  }
  deinit { invalidate() }
  @objc(storeForModuleId:)
  static func store(moduleId: String) -> CUIDragDataStore? {
    registryLock.lock(); let result = registry[moduleId]?.value; registryLock.unlock()
    guard let result = result else { return nil }; return result.state({ result.live }) ? result : nil
  }
  private func state<T>(_ body: () throws -> T) rethrows -> T {
    lock.lock(); defer { lock.unlock() }; return try body()
  }
  private func failure(_ message: String) -> NSError {
    NSError(domain: "CUI.DragData", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
  }
  private func identity(_ request: [String: Any]) throws -> String {
    guard live, request["moduleId"] as? String == moduleId,
          let handle = request["handle"] as? String, handle.hasPrefix(moduleId + ":") else {
      throw failure("Native drag data: foreign or retired module resource")
    }
    return handle
  }
  private func insert(_ entry: Entry) -> String {
    let handle = moduleId + ":" + UUID().uuidString
    entry.backing?.references += 1; entries[handle] = entry; return handle
  }
  private func describe(_ handle: String, _ entry: Entry) -> [String: Any] {
    var result: [String: Any] = ["handle": handle, "kind": entry.kind]
    if entry.kind == "text" { result["types"] = entry.representations }
    else { result["name"] = entry.name; if entry.kind == "file" { result["type"] = entry.type } }
    return result
  }
  private func discard(_ url: URL) {
    cleanup.async { [self] in
      do { if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) } }
      catch { state { cleanupErrors.append(error as NSError) } }
    }
  }
  private func unpin(_ backing: Backing?) {
    guard let backing = backing else { return }
    backing.references -= 1
    if backing.references == 0 { discard(backing.directory) }
  }
  private func remove(_ handle: String) -> String? {
    guard let entry = entries.removeValue(forKey: handle) else { return nil }
    for (id, cursor) in Array(cursors) where cursor.parent == handle { cursors.removeValue(forKey: id); unpin(cursor.backing) }
    unpin(entry.backing)
    return entry.adopted ? nil : entry.blobId
  }
  private func read(_ request: [String: Any]) throws -> (String, Entry) {
    try state {
      let handle = try identity(request)
      guard let entry = entries[handle] else { throw failure("Native drag data: original resource was released") }
      entry.backing?.references += 1; operations += 1; return (handle, entry)
    }
  }
  private func finish(_ entry: Entry) {
    let removeRoot = state { () -> Bool in unpin(entry.backing); operations -= 1; return !live && operations == 0 }
    if removeRoot { discard(root) }
  }
  private func current(_ handle: String, _ entry: Entry) throws {
    try state { guard live, entries[handle] === entry else { throw failure("Native drag data: original resource retired during read") } }
  }
  private func safeURL(_ url: URL, _ backing: Backing) throws -> URL {
    let actual = url.standardizedFileURL.resolvingSymlinksInPath()
    let directory = backing.directory.standardizedFileURL.resolvingSymlinksInPath().path + "/"
    guard actual.isFileURL, actual.path.hasPrefix(directory) else { throw failure("Native drag data: file left its original owned copy") }
    return actual
  }
  private func metadata(_ url: URL, backing: Backing, name: String? = nil, type: String? = nil, modified: Double? = nil, originalModification: Bool = false) throws -> Entry {
    let actual = try safeURL(url, backing)
    let values = try actual.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey, .nameKey, .contentTypeKey, .contentModificationDateKey])
    guard values.isDirectory == true || values.isRegularFile == true else { throw failure("Native drag data: unsupported original file resource") }
    return Entry(kind: values.isDirectory == true ? "directory" : "file", backing: backing, url: actual,
      name: name ?? values.name ?? url.lastPathComponent, type: type ?? values.contentType?.preferredMIMEType ?? "",
      modified: originalModification ? modified : values.contentModificationDate.map { $0.timeIntervalSince1970 * 1000 })
  }
  private func mime(_ type: String) -> String { UTType(type)?.preferredMIMEType ?? type }
  private func text(_ data: Data, type: String? = nil) -> String {
    let bytes = Array(data)
    if bytes.starts(with: [0xff, 0xfe]) || bytes.starts(with: [0xfe, 0xff]) || type == "public.utf16-plain-text" {
      let little = bytes.starts(with: [0xff, 0xfe]) || !bytes.starts(with: [0xfe, 0xff])
      let offset = bytes.starts(with: [0xff, 0xfe]) || bytes.starts(with: [0xfe, 0xff]) ? 2 : 0
      var units: [UInt16] = []
      for index in stride(from: offset, to: bytes.count, by: 2) {
        if index + 1 == bytes.count { units.append(0xfffd); break }
        units.append(little ? UInt16(bytes[index]) | UInt16(bytes[index + 1]) << 8 : UInt16(bytes[index]) << 8 | UInt16(bytes[index + 1]))
      }
      return String(decoding: units, as: UTF16.self)
    }
    return String(decoding: bytes.dropFirst(bytes.starts(with: [0xef, 0xbb, 0xbf]) ? 3 : 0), as: UTF8.self)
  }

  @objc(importProviders:completion:)
  func importProviders(_ providers: [NSItemProvider], completion: @escaping ([[String: Any]]?, NSError?) -> Void) -> String {
    guard !providers.isEmpty else { completion([], nil); return "" }
    let id = UUID().uuidString, operation = Import(count: providers.count, complete: completion)
    let admitted = state { () -> Bool in guard live else { return false }; imports[id] = operation; return true }
    guard admitted else { completion(nil, failure("Native drag data: module retired before original drop")); return "" }
    for (index, provider) in providers.enumerated() {
      if !state({ live && imports[id] === operation }) { break }
      capture(provider, importId: id, index: index)
    }
    return id
  }
  private func progress(_ progress: Progress, importId: String) {
    let keep = state { () -> Bool in guard let operation = imports[importId], live else { return false }; operation.progress.append(progress); return true }
    if !keep { progress.cancel() }
  }
  private func imported(_ entry: Entry?, backingToDiscard: Backing? = nil, importId: String, index: Int, error: Error?) {
    var completed: Import?, values: [[String: Any]]?, resultError: NSError?
    var cancel: [Progress] = [], blobs: [String] = []
    state {
      guard live, let operation = imports[importId] else { return }
      if let error = error {
        imports.removeValue(forKey: importId); completed = operation; resultError = error as NSError; cancel = operation.progress
        for result in operation.results { if let handle = result?["handle"] as? String, let blob = remove(handle) { blobs.append(blob) } }
      } else if let entry = entry {
        let handle = insert(entry); operation.results[index] = describe(handle, entry)
        if operation.results.allSatisfy({ $0 != nil }) {
          imports.removeValue(forKey: importId); completed = operation; values = operation.results.compactMap { $0 }
        }
      }
    }
    if let backing = backingToDiscard, state({ backing.references == 0 }) { discard(backing.directory) }
    for item in cancel { item.cancel() }; for blob in blobs { releaser(blob) }
    completed?.complete(values, resultError)
  }
  private func capture(_ provider: NSItemProvider, importId: String, index: Int) {
    let types = provider.registeredTypeIdentifiers
    if types.contains(Self.stringMapType) {
      let task = provider.loadDataRepresentation(forTypeIdentifier: Self.stringMapType) { [weak self] data, error in
        guard let self = self else { return }
        do {
          if let error = error { throw error }
          guard let data = data, let rows = try JSONSerialization.jsonObject(with: data) as? [[String: String]] else { throw self.failure("Native drag data: invalid original string map") }
          var strings: [String: String] = [:], representations: [String] = []
          for row in rows {
            guard row.count == 2, let type = row["type"], let value = row["data"], strings[type] == nil else { throw self.failure("Native drag data: invalid original representation") }
            strings[type] = value; representations.append(type)
          }
          self.imported(Entry(kind: "text", text: strings, representations: representations), importId: importId, index: index, error: nil)
        } catch { self.imported(nil, importId: importId, index: index, error: error) }
      }; progress(task, importId: importId); return
    }
    let file = types.first { identifier in
      guard let type = UTType(identifier) else { return false }
      return type.conforms(to: .folder) || type.conforms(to: .image) || type.conforms(to: .audio) ||
        type.conforms(to: .movie) || type.conforms(to: .pdf) || type.conforms(to: .archive) ||
        (type.conforms(to: .data) && !type.conforms(to: .text) && !type.conforms(to: .url))
    }
    if let type = file ?? (provider.preferredPresentationStyle == .attachment ? types.first : nil) ?? types.first(where: { UTType($0)?.conforms(to: .fileURL) == true }) {
      captureFile(provider, type: type, importId: importId, index: index); return
    }
    guard !types.isEmpty, types.allSatisfy({ identifier in
      guard let type = UTType(identifier) else { return false }; return type.conforms(to: .text) || type.conforms(to: .url)
    }) else { imported(nil, importId: importId, index: index, error: failure("Native drag data: original provider text representation is unavailable")); return }
    let valuesLock = NSLock(); var strings: [String: String] = [:], remaining = types.count, firstError: Error?
    for type in types {
      let task = provider.loadDataRepresentation(forTypeIdentifier: type) { [weak self] data, error in
        guard let self = self else { return }
        valuesLock.lock()
        if let error = error { firstError = firstError ?? error }
        else if let data = data {
          let value = self.text(data, type: type); strings[type] = value
        } else { firstError = firstError ?? self.failure("Native drag data: missing original representation") }
        remaining -= 1; let done = remaining == 0; let result = strings; let resultError = firstError
        valuesLock.unlock()
        if done {
          var values: [String: String] = [:], representations: [String] = []
          for type in types {
            for key in [self.mime(type), type] where values[key] == nil {
              values[key] = result[type]; representations.append(key)
            }
          }
          self.imported(resultError == nil ? Entry(kind: "text", text: values, representations: representations) : nil, importId: importId, index: index, error: resultError)
        }
      }; progress(task, importId: importId)
    }
  }
  private func captureFile(_ provider: NSItemProvider, type: String, importId: String, index: Int) {
    let task = provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, error in
      guard let self = self else { return }
      let admitted = self.state { () -> Bool in guard self.live, self.imports[importId] != nil else { return false }; self.operations += 1; return true }
      guard admitted else { return }
      let directory = self.root.appendingPathComponent(UUID().uuidString, isDirectory: true), backing = Backing(directory)
      defer {
        let removeRoot = self.state { () -> Bool in self.operations -= 1; return !self.live && self.operations == 0 }
        if removeRoot { self.discard(self.root) }
      }
      do {
        if let error = error { throw error }; guard let url = url, url.isFileURL else { throw self.failure("Native drag data: missing original provider file") }
        let original = try url.resourceValues(forKeys: [.contentModificationDateKey])
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let destination = directory.appendingPathComponent("data")
        // NSItemProvider deletes its temporary file when this callback returns.
        // Complete the owned copy here, on its internal completion queue.
        try FileManager.default.copyItem(at: url, to: destination)
        let entry = try self.metadata(destination, backing: backing, name: provider.suggestedName ?? url.lastPathComponent,
          type: UTType(type)?.preferredMIMEType, modified: original.contentModificationDate.map { $0.timeIntervalSince1970 * 1000 }, originalModification: true)
        self.imported(entry, backingToDiscard: backing, importId: importId, index: index, error: nil)
      } catch { self.imported(nil, backingToDiscard: backing, importId: importId, index: index, error: error) }
    }; progress(task, importId: importId)
  }

  @objc(beginImportProviders:)
  func beginImportProviders(_ providers: [NSItemProvider]) -> String {
    let handle = moduleId + ":transfer:" + UUID().uuidString, transfer = Transfer()
    guard state({ () -> Bool in guard live else { return false }; transfers[handle] = transfer; return true }) else { return "" }
    let id = importProviders(providers) { [weak self] results, error in
      guard let self = self else { return }
      let waiters: [([[String: Any]]?, NSError?) -> Void] = self.state {
        guard self.live, self.transfers[handle] === transfer else {
          for row in results ?? [] { if let handle = row["handle"] as? String { _ = self.remove(handle) } }
          return []
        }
        transfer.results = results; transfer.error = error
        let waiters = transfer.waiters; transfer.waiters.removeAll(); return waiters
      }
      for waiter in waiters { waiter(results, error) }
    }
    let retained = state { () -> Bool in transfer.importId = id; return live && transfers[handle] === transfer }
    if !retained { cancelImport(id) }
    return handle
  }
  private func cancelImport(_ id: String) {
    var blobs: [String] = []
    let operation: Import? = state {
      guard let operation = imports.removeValue(forKey: id) else { return nil }
      for row in operation.results.compactMap({ $0 }) {
        if let handle = row["handle"] as? String, let blob = remove(handle) { blobs.append(blob) }
      }
      return operation
    }
    for task in operation?.progress ?? [] { task.cancel() }
    for blob in blobs { releaser(blob) }
    operation?.complete(nil, failure("Native drag data: original transfer was released"))
  }
  @objc(readItems:completion:)
  func readItems(_ request: [String: Any], completion: @escaping ([[String: Any]]?, NSError?) -> Void) {
    do {
      let ready: ([[String: Any]]?, NSError?)? = try state {
        let handle = try identity(request)
        guard let transfer = transfers[handle], !transfer.claimed else { throw failure("Native drag data: original drop transfer retired or already claimed") }
        transfer.claimed = true
        if transfer.results != nil || transfer.error != nil { return (transfer.results, transfer.error) }
        transfer.waiters.append(completion); return nil
      }
      if let ready = ready { completion(ready.0, ready.1) }
    } catch { completion(nil, error as NSError) }
  }
  @objc(adoptItems:)
  func adoptItems(_ request: [String: Any]) -> Bool {
    state {
      guard let handle = try? identity(request), let transfer = transfers[handle], transfer.claimed,
            transfer.results != nil, transfer.error == nil else { return false }
      transfers.removeValue(forKey: handle); return true
    }
  }

  @objc(readText:completion:)
  func readText(_ request: [String: Any], completion: @escaping (String?, NSError?) -> Void) {
    worker.async { [self] in
      do {
        let (handle, entry) = try read(request); defer { finish(entry) }
        let value: String
        if entry.kind == "text" {
          guard let type = request["type"] as? String, let text = entry.text[type] else { throw failure("Native drag data: original text type unavailable") }
          value = text
        } else {
          guard entry.kind == "file", let backing = entry.backing, let url = entry.url else { throw failure("Native drag data: resource is not a file") }
          value = text(try Data(contentsOf: safeURL(url, backing), options: .mappedIfSafe))
        }
        try current(handle, entry); completion(value, nil)
      } catch { completion(nil, error as NSError) }
    }
  }
  @objc(readFile:completion:)
  func readFile(_ request: [String: Any], completion: @escaping ([String: Any]?, NSError?) -> Void) {
    worker.async { [self] in
      var unownedBlob: String?
      do {
        let (handle, entry) = try read(request); defer { finish(entry) }
        guard entry.kind == "file", let backing = entry.backing, let url = entry.url else { throw failure("Native drag data: resource is not a file") }
        let data = try Data(contentsOf: safeURL(url, backing), options: .mappedIfSafe)
        try current(handle, entry)
        guard let blob = writer(data, entry.type), let blobId = blob["blobId"] as? String else { throw failure("Native drag data: original SDK Blob writer unavailable") }
        unownedBlob = blobId
        let result: [String: Any] = try state {
          try current(handle, entry)
          let body = Entry(kind: "body", backing: backing, url: url, name: entry.name, type: entry.type, modified: entry.modified)
          body.blobId = blobId; let bodyHandle = insert(body)
          var result: [String: Any] = ["handle": bodyHandle, "blobId": blobId, "offset": 0, "size": data.count,
            "name": entry.name, "type": entry.type, "uri": url.absoluteString]
          if let modified = entry.modified { result["lastModified"] = modified }; return result
        }
        unownedBlob = nil; completion(result, nil)
      } catch { if let blob = unownedBlob { releaser(blob) }; completion(nil, error as NSError) }
    }
  }
  @objc(adoptFile:)
  func adoptFile(_ request: [String: Any]) -> Bool {
    state {
      guard let handle = try? identity(request), let entry = entries[handle], entry.kind == "body", !entry.adopted else { return false }
      entry.adopted = true; return true
    }
  }
  @objc(readDirectory:completion:)
  func readDirectory(_ request: [String: Any], completion: @escaping ([String: Any]?, NSError?) -> Void) {
    worker.async { [self] in
      var cursorId: String?
      do {
        let (handle, entry) = try read(request); defer { finish(entry) }
        guard entry.kind == "directory", let backing = entry.backing, let url = entry.url else { throw failure("Native drag data: resource is not a directory") }
        if let existing = request["cursor"] as? String { cursorId = existing }
        else {
          let paths = try FileManager.default.contentsOfDirectory(at: safeURL(url, backing), includingPropertiesForKeys: nil)
          cursorId = try state { try current(handle, entry); let id = moduleId + ":cursor:" + UUID().uuidString
            cursors[id] = Cursor(parent: handle, backing: backing, urls: paths); backing.references += 1; return id }
        }
        guard let id = cursorId else { throw failure("Native drag data: missing original directory cursor") }
        let page: (Cursor, Int, [URL]) = try state {
          try current(handle, entry)
          guard let cursor = cursors[id], cursor.parent == handle, !cursor.busy else { throw failure("Native drag data: original directory cursor retired or busy") }
          cursor.busy = true; let end = min(cursor.urls.count, cursor.offset + 64)
          return (cursor, end, Array(cursor.urls[cursor.offset..<end]))
        }
        let children = try page.2.map { try metadata($0, backing: backing) }
        let result: [String: Any] = try state {
          try current(handle, entry)
          guard cursors[id] === page.0 else { throw failure("Native drag data: directory retired during enumeration") }
          let rows = children.map { child -> [String: Any] in let key = insert(child); return describe(key, child) }
          page.0.offset = page.1; page.0.busy = false
          let ended = page.1 == page.0.urls.count
          if ended { cursors.removeValue(forKey: id); unpin(backing) }
          return ["items": rows, "cursor": ended ? NSNull() : id]
        }
        completion(result, nil)
      } catch {
        if let id = cursorId { state { if let cursor = cursors.removeValue(forKey: id) { unpin(cursor.backing) } } }
        completion(nil, error as NSError)
      }
    }
  }
  @objc(closeDirectory:)
  func closeDirectory(_ request: [String: Any]) {
    state {
      guard let parent = try? identity(request), let id = request["cursor"] as? String,
            let cursor = cursors[id], cursor.parent == parent else { return }
      cursors.removeValue(forKey: id); unpin(cursor.backing)
    }
  }
  @objc(releaseData:)
  func releaseData(_ request: [String: Any]) {
    var operation: Import?, waiters: [([[String: Any]]?, NSError?) -> Void] = [], blobs: [String] = []
    state {
      guard let handle = try? identity(request) else { return }
      if let transfer = transfers.removeValue(forKey: handle) {
        operation = imports.removeValue(forKey: transfer.importId); waiters = transfer.waiters
        for row in transfer.results ?? operation?.results.compactMap({ $0 }) ?? [] {
          if let handle = row["handle"] as? String, let blob = remove(handle) { blobs.append(blob) }
        }
      } else if let blob = remove(handle) { blobs.append(blob) }
    }
    for task in operation?.progress ?? [] { task.cancel() }
    let error = failure("Native drag data: original transfer was released")
    operation?.complete(nil, error); for waiter in waiters { waiter(nil, error) }
    for blob in blobs { releaser(blob) }
  }
  @objc func invalidate() {
    let result: ([Import], [String], Bool, [([[String: Any]]?, NSError?) -> Void]) = state {
      guard live else { return ([], [], false, []) }; live = false
      let pending = Array(imports.values); imports.removeAll()
      let waiters = transfers.values.flatMap { $0.waiters }; transfers.removeAll()
      var blobs: [String] = []
      for handle in Array(entries.keys) { if let blob = remove(handle) { blobs.append(blob) } }
      return (pending, blobs, operations == 0, waiters)
    }
    Self.registryLock.lock(); Self.registry.removeValue(forKey: moduleId); Self.registryLock.unlock()
    for operation in result.0 { for progress in operation.progress { progress.cancel() }; operation.complete(nil, failure("Native drag data: module retired during original transfer")) }
    for waiter in result.3 { waiter(nil, failure("Native drag data: module retired during original transfer")) }
    for blob in result.1 { releaser(blob) }
    if result.2 { discard(root) }
  }
}
