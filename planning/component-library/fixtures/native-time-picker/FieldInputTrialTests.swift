import XCTest

// Construction checkpoint only. The complete original-input/pointer matrix and
// adoption parser must be finished before this source can use the one cohort.
final class FieldInputTrialTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
  private var originalWindow: String?
  private var originalHourTarget: Int?
  private var originalObjects: [Int: (String, String)] = [:]
  override func setUpWithError() throws {
    continueAfterFailure = false
    XCTAssertTrue(app.state == .runningForeground || app.state == .runningBackground)
    app.activate()
  }
  override func tearDownWithError() throws {
    let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    image.lifetime = .keepAlways
    add(image)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = "combined-field-original-final-tree"
    tree.lifetime = .keepAlways
    add(tree)
  }
  private func element(_ id: String) -> XCUIElement {
    app.descendants(matching: .any).matching(identifier: id).firstMatch
  }
  private func read(_ id: String) -> [String: Any]? {
    try? JSONSerialization.jsonObject(with: Data(element(id).label.utf8)) as? [String: Any]
  }
  private func wait(_ id: String, _ predicate: @escaping ([String: Any]) -> Bool) throws -> [String: Any] {
    expectation(for: NSPredicate { _, _ in
      guard let row = self.read(id) else { return false }
      return predicate(row)
    }, evaluatedWith: element(id))
    waitForExpectations(timeout: 20)
    return try XCTUnwrap(read(id))
  }
  private func control(_ name: String) {
    let button = element("field-sdk-" + name)
    XCTAssertTrue(button.isHittable)
    button.tap()
  }
  private func reveal(_ id: String, towardStart: Bool) -> XCUIElement {
    let target = element(id)
    let content = element("field-sdk-content")
    for _ in 0..<4 where !target.isHittable {
      let top = content.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: content.frame.width / 2, dy: 15))
      let lower = top.withOffset(CGVector(dx: 0, dy: 100))
      if towardStart { top.press(forDuration: 0.05, thenDragTo: lower) }
      else { lower.press(forDuration: 0.05, thenDragTo: top) }
    }
    XCTAssertTrue(target.isHittable)
    return target
  }
  private func revealHour() -> XCUIElement { reveal("outer-hour", towardStart: true) }
  private func focusAuthoredButton() throws {
    _ = reveal("outer-button", towardStart: false)
    control("focus-button")
    _ = try wait("outer-value") { row in
      guard let target = row["buttonTarget"] as? Int, target > 0 else { return false }
      return row["observedFocusTarget"] as? Int == target
    }
  }
  private func receipt(_ name: String, nativeEditors: [String] = [], nativeActionSeconds: Double? = nil) throws -> [String: Any] {
    let previous = read("field-sdk-receipt-snapshot")?["batch"] as? Int ?? 0
    element("field-sdk-checkpoint").tap()
    let row = try wait("field-sdk-receipt-snapshot") { ($0["batch"] as? Int ?? 0) > previous }
    XCTAssertEqual(row["dropped"] as? Int, 0)
    XCTAssertTrue(try XCTUnwrap(row["failures"] as? [[String: Any]]).isEmpty)
    var report = row
    report["case"] = name
    if let nativeActionSeconds { report["nativeActionElapsedSeconds"] = nativeActionSeconds }
    report["scene"] = try XCTUnwrap(read("field-sdk-scene-state"))
    report["nativeValues"] = Dictionary(uniqueKeysWithValues: nativeEditors.map { ($0, element($0).value as? String ?? element($0).label) })
    let encoded = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
    let attachment = XCTAttachment(string: String(decoding: encoded, as: UTF8.self))
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    return row
  }
  private func checkpoint(_ name: String, requestCount: Int, hourTarget: Bool = true, nativeEditors: [String] = [], requiresKey: Bool = true) throws -> [String: Any] {
    let row = try receipt(name, nativeEditors: nativeEditors)
    let frames = try XCTUnwrap(row["frames"] as? [[String: Any]])
    let keys = frames.filter { $0["kind"] as? String == "key" && $0["phase"] as? String == "down" }
    if requiresKey { XCTAssertFalse(keys.isEmpty, "Original key frame missing: " + name) }
    for key in keys {
      let identity = try XCTUnwrap(key["identity"] as? [String: Any])
      let target = try XCTUnwrap(identity["target"] as? Int)
      if hourTarget {
        if let originalHourTarget { XCTAssertEqual(target, originalHourTarget) }
        else { originalHourTarget = target }
      }
    }
    for key in frames {
      let identity = try XCTUnwrap(key["identity"] as? [String: Any])
      let window = try XCTUnwrap(identity["windowId"] as? String)
      if let originalWindow { XCTAssertEqual(window, originalWindow) }
      else { originalWindow = window }
      let target = try XCTUnwrap(identity["target"] as? Int)
      let native = try XCTUnwrap(identity["nativeInstance"] as? String)
      let editor = try XCTUnwrap(identity["editorInstance"] as? String)
      if let original = originalObjects[target] {
        XCTAssertEqual(native, original.0)
        XCTAssertEqual(editor, original.1)
      } else { originalObjects[target] = (native, editor) }
      XCTAssertEqual(key["deliveryStarted"] as? Bool, true)
      XCTAssertEqual(key["deliveryReturned"] as? Bool, true)
      XCTAssertEqual(key["renderPhasesComplete"] as? Bool, true)
      XCTAssertEqual(key["scopeCurrent"] as? Bool, true)
      XCTAssertEqual(key["error"] as? String, "")
      XCTAssertTrue(["allowed", "prevented"].contains(key["decision"] as? String ?? ""))
    }
    XCTAssertEqual((row["requests"] as? [[String: Any]])?.count, requestCount)
    return row
  }
  private func guardCheckpoint(_ name: String, requestCount: Int) throws {
    let row = try receipt("original-" + name + "-key-refusal")
    let observation = try XCTUnwrap((row["observations"] as? [[String: Any]])?.last)
    XCTAssertEqual(observation["field"] as? String, "outer")
    XCTAssertEqual(observation[name] as? Bool, true)
    XCTAssertEqual((observation["data"] as? [String: Any])?["key"] as? String, "9")
    XCTAssertEqual((observation["data"] as? [String: Any])?["focusedTarget"] as? Int, originalHourTarget)
    XCTAssertEqual((row["requests"] as? [[String: Any]])?.count, requestCount)
    let frames = try XCTUnwrap(row["frames"] as? [[String: Any]])
    XCTAssertTrue(frames.allSatisfy { ($0["error"] as? String) == "" })
  }
  private func navigationProfile(_ name: String, requestCount: Int, mask: Int, steps: Int) throws {
    let row = try checkpoint(name, requestCount: requestCount, hourTarget: false)
    let frames = try XCTUnwrap(row["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "key" && $0["key"] as? String == "ArrowRight" }
    let focuses = try XCTUnwrap(row["focusActions"] as? [[String: Any]])
    XCTAssertEqual(frames.count, steps * 2)
    XCTAssertEqual(focuses.count, steps)
    for (index, frame) in frames.enumerated() {
      XCTAssertEqual(frame["phase"] as? String, index % 2 == 0 ? "down" : "up")
      let flags = try XCTUnwrap(frame["modifiers"] as? [String: Bool])
      for (bit, flag) in ["shiftKey", "altKey", "ctrlKey", "metaKey"].enumerated() {
        XCTAssertEqual(flags[flag], mask & (1 << bit) != 0)
      }
      XCTAssertEqual(frame["repeat"] as? Bool, false)
      XCTAssertGreaterThan(try XCTUnwrap(frame["nativeCode"] as? Int), 0)
      XCTAssertFalse(try XCTUnwrap(frame["nativeModifierData"] as? String).isEmpty)
      if index % 2 == 0 {
        let focus = focuses[index / 2]
        XCTAssertEqual(focus["token"] as? Int, frame["token"] as? Int)
        XCTAssertEqual(focus["action"] as? String, "next")
        XCTAssertEqual(focus["observed"] as? Bool, true)
        let target = try XCTUnwrap((frame["identity"] as? [String: Any])?["target"] as? Int)
        let originals = try XCTUnwrap((focus["after"] as? [String: Any])?["originals"] as? [[String: Any]])
          .filter { $0["eligible"] as? Bool == true }
        let position = try XCTUnwrap(originals.firstIndex { $0["target"] as? Int == target })
        XCTAssertLessThan(position + 1, originals.count)
        XCTAssertEqual(focus["target"] as? Int, originals[position + 1]["target"] as? Int)
        XCTAssertEqual((frames[index + 1]["identity"] as? [String: Any])?["target"] as? Int, focus["target"] as? Int)
        if index > 0 {
          XCTAssertEqual(target, (frames[index - 1]["identity"] as? [String: Any])?["target"] as? Int)
        }
      }
    }
  }
  func testOriginalValueClassRequestsCheckpoint() throws {
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    control("echo")
    var count = 0
    for (controlName, valueClass, held, requested) in [
      ("time", "Time", "13:45:07", "14:45:07"),
      ("calendar", "CalendarDateTime", "2024-10-01T13:45:07", "2024-10-01T14:45:07"),
      ("zoned", "ZonedDateTime", "2024-10-01T13:45:07-04:00[America/New_York]", "2024-10-01T14:45:07-04:00[America/New_York]")
    ] {
      control(controlName)
      let original = try wait("outer-value") { $0["valueClass"] as? String == valueClass && $0["value"] as? String == held }
      _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
      let hour = revealHour()
      hour.tap()
      hour.typeKey(.upArrow, modifierFlags: [])
      count += 1
      let receipt = try checkpoint("original-" + valueClass + "-veto", requestCount: count)
      let request = try XCTUnwrap((receipt["requests"] as? [[String: Any]])?.last)
      XCTAssertEqual(request["value"] as? String, requested)
      XCTAssertEqual(request["valueClass"] as? String, valueClass)
      XCTAssertEqual(request["held"] as? String, held)
      XCTAssertEqual(request["heldClass"] as? String, valueClass)
      let retained = try XCTUnwrap(read("outer-value"))
      XCTAssertEqual(retained["value"] as? String, held)
      XCTAssertEqual(retained["outerTarget"] as? Int, original["outerTarget"] as? Int)
      XCTAssertEqual(retained["inputTarget"] as? Int, original["inputTarget"] as? Int)
      control("locale")
      _ = try wait("outer-value") { $0["locale"] as? String == "ar-EG" && $0["direction"] as? String == "rtl" }
      _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
      revealHour().tap()
      element("outer-hour").typeKey(.upArrow, modifierFlags: [])
      count += 1
      let localized = try checkpoint("original-" + valueClass + "-Arabic-veto", requestCount: count)
      XCTAssertEqual((localized["requests"] as? [[String: Any]])?.last?["value"] as? String, requested)
      XCTAssertEqual((localized["requests"] as? [[String: Any]])?.last?["valueClass"] as? String, valueClass)
      control("locale")
    }
    for guardName in ["readonly", "disabled"] {
      revealHour().tap()
      control(guardName)
      _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
      _ = try wait("outer-value") { $0[guardName] as? Bool == true && $0["keyboardReady"] as? Bool == true }
      element("outer-hour").typeKey("9", modifierFlags: [])
      _ = try wait("field-sdk-observation-snapshot") { row in
        let data = row["data"] as? [String: Any]
        return row[guardName] as? Bool == true && data?["key"] as? String == "9" &&
          data?["focusedTarget"] as? Int == self.originalHourTarget
      }
      try guardCheckpoint(guardName, requestCount: count)
      XCTAssertEqual(read("outer-value")?["value"] as? String, "2024-10-01T13:45:07-04:00[America/New_York]")
      control(guardName)
    }

    try focusAuthoredButton()
    control("stop")
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    _ = try receipt("authored-child-stop-setup")
    element("outer-button").typeKey(.rightArrow, modifierFlags: [])
    let stopped = try checkpoint("authored-child-stops-group", requestCount: count, hourTarget: false)
    let stoppedKeys = try XCTUnwrap(stopped["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "key" && $0["phase"] as? String == "down" }
    let stoppedToken = try XCTUnwrap(stoppedKeys.last?["token"] as? Int)
    let stoppedCallbacks = try XCTUnwrap(stopped["callbacks"] as? [[String: Any]])
      .filter { $0["token"] as? Int == stoppedToken }
    XCTAssertEqual(stoppedCallbacks.map { $0["kind"] as? String }, ["child-key"])
    XCTAssertTrue(try XCTUnwrap(stopped["focusActions"] as? [[String: Any]]).isEmpty)
    control("stop")
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    try focusAuthoredButton()
    _ = try receipt("authored-child-navigation-setup")
    element("outer-button").typeKey(.rightArrow, modifierFlags: [])
    let navigated = try checkpoint("authored-child-before-group-navigation", requestCount: count, hourTarget: false)
    let navigationKeys = try XCTUnwrap(navigated["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "key" && $0["phase"] as? String == "down" }
    let navigationToken = try XCTUnwrap(navigationKeys.last?["token"] as? Int)
    let navigationCallbacks = try XCTUnwrap(navigated["callbacks"] as? [[String: Any]])
      .filter { $0["token"] as? Int == navigationToken }
    let navigationGroups = try XCTUnwrap(navigationKeys.last?["groupTargets"] as? [Int])
    XCTAssertEqual(navigationCallbacks.map { $0["kind"] as? String }, ["child-key"] + Array(repeating: "field-key", count: navigationGroups.count))
    _ = try receipt("negative-tab-navigation-setup")
    element("outer-negative-tab").typeKey(.rightArrow, modifierFlags: [])
    _ = try checkpoint("negative-tab-to-original-core", requestCount: count, hourTarget: false)

    let core = reveal("outer-core-editor", towardStart: false)
    core.tap()
    _ = try receipt("core-editor-default-setup", nativeEditors: ["outer-core-editor"])
    core.typeKey("7", modifierFlags: [])
    let changed = try checkpoint("original-core-editor-default", requestCount: count, hourTarget: false, nativeEditors: ["outer-core-editor"])
    XCTAssertEqual(core.value as? String, "7")
    let changes = try XCTUnwrap(changed["callbacks"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "core-change" && $0["field"] as? String == "outer" }
    XCTAssertEqual(changes.count, 1)
    XCTAssertEqual(changes.last?["text"] as? String, "7")
    control("veto")
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    _ = try receipt("core-editor-veto-setup", nativeEditors: ["outer-core-editor"])
    core.typeKey("9", modifierFlags: [])
    let refused = try checkpoint("group-veto-before-core-editor-default", requestCount: count, hourTarget: false, nativeEditors: ["outer-core-editor"])
    XCTAssertEqual(core.value as? String, "7")
    let refusedChanges = try XCTUnwrap(refused["callbacks"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "core-change" && $0["field"] as? String == "outer" }
    XCTAssertEqual(refusedChanges.count, 1)
    control("veto")

    core.tap()
    control("empty")
    let empty = try wait("outer-value") { row in
      row["value"] is NSNull && row["valueClass"] is NSNull &&
        Set(row["placeholderSegments"] as? [String] ?? []).isSuperset(of: ["hour", "minute"])
    }
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    let tail = reveal("outer-press-tail", towardStart: true)
    _ = try receipt("placeholder-touch-setup")
    tail.tap()
    let pressed = try checkpoint("placeholder-touch-release", requestCount: count, hourTarget: false, requiresKey: false)
    let pressFrames = try XCTUnwrap(pressed["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "pointer" }
    XCTAssertEqual(pressFrames.compactMap { $0["phase"] as? String }, ["pointer-start", "pointer-end", "pointer-click"])
    let click = try XCTUnwrap(pressFrames.last)
    let focus = try XCTUnwrap((pressed["focusActions"] as? [[String: Any]])?.first)
    XCTAssertEqual((pressed["focusActions"] as? [[String: Any]])?.count, 1)
    XCTAssertEqual(focus["token"] as? Int, click["token"] as? Int)
    XCTAssertEqual(focus["action"] as? String, "press")
    XCTAssertEqual(focus["target"] as? Int, originalHourTarget)
    XCTAssertEqual(focus["observed"] as? Bool, true)
    XCTAssertEqual(read("outer-value")?["outerTarget"] as? Int, empty["outerTarget"] as? Int)
    XCTAssertEqual(read("outer-value")?["inputTarget"] as? Int, empty["inputTarget"] as? Int)
    XCTAssertEqual(read("inner-value")?["value"] as? String, "08:15:00")

    let scrollTail = reveal("outer-press-tail", towardStart: true)
    _ = try receipt("placeholder-scroll-setup")
    let start = scrollTail.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let end = start.withOffset(CGVector(dx: 0, dy: 100))
    start.press(forDuration: 0.05, thenDragTo: end)
    let cancelled = try checkpoint("placeholder-scroll-cancel", requestCount: count, hourTarget: false, requiresKey: false)
    let cancelFrames = try XCTUnwrap(cancelled["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "pointer" }
    XCTAssertEqual(cancelFrames.first?["phase"] as? String, "pointer-start")
    XCTAssertFalse(cancelFrames.contains { $0["phase"] as? String == "pointer-click" })
    XCTAssertTrue(try XCTUnwrap(cancelled["focusActions"] as? [[String: Any]]).isEmpty)

    let streamTail = reveal("outer-press-tail", towardStart: true)
    let insideStream = streamTail.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let outsideStream = app.coordinate(withNormalizedOffset: .zero).withOffset(
      CGVector(dx: element("outer-outer").frame.maxX + 8, dy: streamTail.frame.midY))
    _ = try receipt("outside-release-setup")
    insideStream.press(forDuration: 0.05, thenDragTo: outsideStream)
    let outsideRelease = try receipt("outside-release")
    XCTAssertTrue(try XCTUnwrap(outsideRelease["focusActions"] as? [[String: Any]]).isEmpty)
    _ = try receipt("outside-origin-setup")
    outsideStream.press(forDuration: 0.05, thenDragTo: insideStream)
    let outsideOrigin = try receipt("outside-origin")
    XCTAssertTrue(try XCTUnwrap(outsideOrigin["focusActions"] as? [[String: Any]]).isEmpty)
    _ = try receipt("fresh-pointer-stream-setup")
    streamTail.tap()
    let freshStream = try receipt("fresh-pointer-stream")
    let freshFocus = try XCTUnwrap((freshStream["focusActions"] as? [[String: Any]])?.first)
    XCTAssertEqual((freshStream["focusActions"] as? [[String: Any]])?.count, 1)
    XCTAssertEqual(freshFocus["target"] as? Int, originalHourTarget)
    XCTAssertEqual(freshFocus["observed"] as? Bool, true)

    control("stop")
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    let authored = reveal("outer-button", towardStart: false)
    _ = try receipt("authored-pointer-stop-setup")
    authored.tap()
    let childPress = try checkpoint("authored-child-pointer-stop", requestCount: count, hourTarget: false, requiresKey: false)
    let childFrames = try XCTUnwrap(childPress["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "pointer" && $0["phase"] as? String == "pointer-start" }
    let childToken = try XCTUnwrap(childFrames.first?["token"] as? Int)
    let childCallbacks = try XCTUnwrap(childPress["callbacks"] as? [[String: Any]])
      .filter { $0["token"] as? Int == childToken }
    XCTAssertEqual(childCallbacks.compactMap { $0["kind"] as? String }, ["child-pointer"])
    XCTAssertEqual(childCallbacks.first?["stopped"] as? Bool, true)
    XCTAssertTrue(try XCTUnwrap(childPress["focusActions"] as? [[String: Any]]).isEmpty)
    control("stop")

    reveal("outer-core-editor", towardStart: false).tap()
    _ = try receipt("outer-to-nested-setup")
    element("outer-core-editor").typeKey(.rightArrow, modifierFlags: [])
    _ = try checkpoint("outer-core-to-nested-hour", requestCount: count, hourTarget: false)
    _ = try receipt("nested-navigation-setup")
    element("inner-hour").typeKey(.rightArrow, modifierFlags: [])
    _ = try checkpoint("nested-hour-to-minute", requestCount: count, hourTarget: false)
    _ = try receipt("nested-owner-veto-setup")
    element("inner-minute").typeKey(.upArrow, modifierFlags: [])
    count += 1
    let nestedRequest = try checkpoint("nested-owner-veto", requestCount: count, hourTarget: false)
    let request = try XCTUnwrap((nestedRequest["requests"] as? [[String: Any]])?.last)
    XCTAssertEqual(request["field"] as? String, "inner")
    XCTAssertEqual(request["held"] as? String, "08:15:00")
    XCTAssertEqual(request["value"] as? String, "08:16:00")
    XCTAssertEqual(request["valueClass"] as? String, "Time")
    XCTAssertEqual(read("inner-value")?["value"] as? String, "08:15:00")
    XCTAssertTrue(read("outer-value")?["value"] is NSNull)

    for (mode, name, transactions) in [("command-only", "original-ref-command-only", 0), ("command-mixed", "original-ref-mixed-transaction", 1)] {
      control(mode)
      _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
      try focusAuthoredButton()
      _ = try receipt(name + "-setup")
      element("outer-button").typeKey("f", modifierFlags: [])
      let row = try checkpoint(name, requestCount: count, hourTarget: false, nativeEditors: ["outer-core-editor", "outer-command-transactions"])
      let commands = try XCTUnwrap(row["commands"] as? [[String: Any]])
      let nativeCommands = commands.filter { $0["kind"] as? String == "command-native" }
      XCTAssertEqual(nativeCommands.count, 1)
      let command = try XCTUnwrap(nativeCommands.first)
      XCTAssertEqual(command["command"] as? String, "focus")
      XCTAssertEqual(command["callbackCompleted"] as? Bool, true)
      XCTAssertEqual(command["current"] as? Bool, true)
      let value = try XCTUnwrap(read("outer-value"))
      let coreTarget = try XCTUnwrap(value["coreTarget"] as? Int)
      XCTAssertEqual(command["target"] as? Int, coreTarget)
      XCTAssertEqual((command["after"] as? [String: Any])?["focusedTarget"] as? Int, coreTarget)
      XCTAssertEqual(value["commandTransactions"] as? Int, transactions)
      XCTAssertEqual(element("outer-command-transactions").label, String(transactions))
      XCTAssertEqual(element("outer-core-editor").value as? String, "7")
      XCTAssertTrue(try XCTUnwrap(row["focusActions"] as? [[String: Any]]).isEmpty)
    }
    control("command-off")
    for mask in 0..<16 {
      try focusAuthoredButton()
      _ = try receipt("modifier-\(mask)-setup")
      var flags: XCUIElement.KeyModifierFlags = []
      if mask & 1 != 0 { flags.insert(.shift) }
      if mask & 2 != 0 { flags.insert(.option) }
      if mask & 4 != 0 { flags.insert(.control) }
      if mask & 8 != 0 { flags.insert(.command) }
      app.typeKey(.rightArrow, modifierFlags: flags)
      try navigationProfile("modifier-\(mask)", requestCount: count, mask: mask, steps: 1)
    }
    try focusAuthoredButton()
    _ = try receipt("consecutive-original-navigation-setup")
    for _ in 0..<4 { app.typeKey(.rightArrow, modifierFlags: []) }
    try navigationProfile("consecutive-original-navigation", requestCount: count, mask: 0, steps: 4)
    for mutation in ["callback", "disabled", "readonly", "layout", "unmount"] {
      control("mutation")
      let before = try wait("field-sdk-scene-state") { $0["mutation"] as? String == mutation }
      _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
      try focusAuthoredButton()
      _ = try receipt("mutation-" + mutation + "-setup")
      app.typeKey("m", modifierFlags: [])
      _ = try wait("field-sdk-scene-state") { row in
        if mutation == "callback" { return row["revision"] as? Int == (before["revision"] as? Int ?? 0) + 1 }
        if mutation == "disabled" || mutation == "readonly" { return row[mutation] as? Bool == true }
        if mutation == "layout" { return row["layoutRevision"] as? Int == (before["layoutRevision"] as? Int ?? 0) + 1 }
        return row["visible"] as? Bool == false
      }
      let changed = try receipt("mutation-" + mutation)
      let downs = try XCTUnwrap(changed["frames"] as? [[String: Any]])
        .filter { $0["kind"] as? String == "key" && $0["key"] as? String == "m" && $0["phase"] as? String == "down" }
      XCTAssertEqual(downs.count, 1)
      let down = try XCTUnwrap(downs.first)
      XCTAssertEqual(down["deliveryStarted"] as? Bool, true)
      if mutation == "layout" {
        XCTAssertEqual(down["scopeCurrent"] as? Bool, true)
        XCTAssertEqual(down["renderPhasesComplete"] as? Bool, true)
        XCTAssertEqual(down["error"] as? String, "")
        XCTAssertEqual(down["decision"] as? String, "prevented")
      } else {
        XCTAssertEqual(down["scopeCurrent"] as? Bool, false)
        XCTAssertEqual(down["decision"] as? String, "retired")
        XCTAssertEqual(down["wait"] as? String, "retired")
        XCTAssertEqual(down["deliveryReturned"] as? Bool, true)
        XCTAssertEqual(down["renderPhasesComplete"] as? Bool, true)
        XCTAssertTrue(["", "field-input-original-mount-event-retired"].contains(down["error"] as? String ?? "missing"))
      }
      let ups = try XCTUnwrap(changed["frames"] as? [[String: Any]])
        .filter { $0["kind"] as? String == "key" && $0["key"] as? String == "m" && $0["phase"] as? String == "up" }
      if mutation == "layout" { XCTAssertEqual(ups.count, 1) }
      if mutation == "unmount" { XCTAssertTrue(ups.isEmpty) }
      let currentRevision = try XCTUnwrap(read("field-sdk-scene-state")?["revision"] as? Int)
      for up in ups {
        XCTAssertEqual(up["scopeCurrent"] as? Bool, true)
        XCTAssertEqual(up["deliveryReturned"] as? Bool, true)
        XCTAssertEqual(up["renderPhasesComplete"] as? Bool, true)
        XCTAssertEqual(up["error"] as? String, "")
        let callbacks = try XCTUnwrap(changed["callbacks"] as? [[String: Any]])
          .filter { $0["kind"] as? String == "field-key" && $0["token"] as? Int == up["token"] as? Int }
        XCTAssertEqual(callbacks.count, 1)
        XCTAssertEqual(callbacks.first?["revision"] as? Int, currentRevision)
      }
      XCTAssertEqual((changed["requests"] as? [[String: Any]])?.count, count)
      XCTAssertTrue(try XCTUnwrap(changed["focusActions"] as? [[String: Any]]).isEmpty)
      XCTAssertTrue(try XCTUnwrap(changed["commands"] as? [[String: Any]]).isEmpty)
      if mutation == "disabled" || mutation == "readonly" { control(mutation) }
      if mutation == "unmount" {
        XCTAssertFalse(element("outer-root").exists)
        control("show")
      }
      _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
      try focusAuthoredButton()
      _ = try receipt("mutation-" + mutation + "-probe-setup")
      app.typeKey("j", modifierFlags: [])
      let probe = try checkpoint("mutation-" + mutation + "-probe", requestCount: count, hourTarget: false)
      let revision = try XCTUnwrap(read("field-sdk-scene-state")?["revision"] as? Int)
      let tokens = Set(try XCTUnwrap(probe["frames"] as? [[String: Any]]).compactMap { $0["token"] as? Int })
      let callbacks = try XCTUnwrap(probe["callbacks"] as? [[String: Any]])
        .filter { $0["kind"] as? String == "field-key" && tokens.contains($0["token"] as? Int ?? 0) }
      XCTAssertEqual(callbacks.count, 2)
      XCTAssertTrue(callbacks.allSatisfy { $0["revision"] as? Int == revision })
    }
    control("mutation")
    control("portal")
    _ = try wait("field-sdk-scene-state") { $0["portaled"] as? Bool == true }
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    control("focus-button")
    _ = try receipt("portal-original-setup")
    app.typeKey(.rightArrow, modifierFlags: [])
    let portalKeys = try checkpoint("portal-original-keys", requestCount: count, hourTarget: false)
    let buttonTarget = try XCTUnwrap(read("outer-value")?["buttonTarget"] as? Int)
    let keyFrames = try XCTUnwrap(portalKeys["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "key" }
    XCTAssertEqual(keyFrames.count, 2)
    for frame in keyFrames {
      XCTAssertEqual((frame["identity"] as? [String: Any])?["target"] as? Int, buttonTarget)
      XCTAssertEqual(frame["beforeEventFocusedTarget"] as? Int, buttonTarget)
      XCTAssertEqual(frame["afterEventFocusedTarget"] as? Int, buttonTarget)
      XCTAssertEqual(frame["decision"] as? String, "allowed")
      let groups = try XCTUnwrap(frame["groups"] as? [[String: Any]])
      XCTAssertFalse(groups.isEmpty)
      XCTAssertTrue(groups.allSatisfy { $0["containsTarget"] as? Bool == false })
    }
    XCTAssertTrue(try XCTUnwrap(portalKeys["focusActions"] as? [[String: Any]]).isEmpty)
    _ = try receipt("portal-original-press-setup")
    element("outer-button").tap()
    let portalPress = try receipt("portal-original-press")
    XCTAssertTrue(try XCTUnwrap(portalPress["focusActions"] as? [[String: Any]]).isEmpty)
    let pointerFrames = try XCTUnwrap(portalPress["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "pointer" }
    XCTAssertTrue(pointerFrames.contains { $0["phase"] as? String == "pointer-start" })
    XCTAssertTrue(pointerFrames.contains { $0["phase"] as? String == "pointer-click" })
    for frame in pointerFrames {
      XCTAssertGreaterThan(try XCTUnwrap((frame["identity"] as? [String: Any])?["target"] as? Int), 0)
      XCTAssertTrue(try XCTUnwrap(frame["groups"] as? [[String: Any]])
        .allSatisfy { $0["containsTarget"] as? Bool == false })
      XCTAssertEqual(frame["decision"] as? String, "allowed")
    }
    control("portal")
    _ = try wait("field-sdk-scene-state") { $0["portaled"] as? Bool == false }
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    try focusAuthoredButton()
    _ = try receipt("busy-original-setup")
    control("busy")
    _ = try wait("field-sdk-scene-state") { $0["busyPhase"] as? String == "running" }
    let busyStarted = Date()
    app.typeKey("q", modifierFlags: [])
    let busyActionSeconds = Date().timeIntervalSince(busyStarted)
    XCTAssertLessThan(busyActionSeconds, 5)
    _ = try wait("field-sdk-scene-state") { $0["busyPhase"] as? String == "complete" }
    let busy = try receipt("busy-original-expiry", nativeActionSeconds: busyActionSeconds)
    let busyFrames = try XCTUnwrap(busy["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "key" && $0["key"] as? String == "q" }
    XCTAssertEqual(busyFrames.count, 2)
    for frame in busyFrames {
      XCTAssertEqual(frame["decision"] as? String, "timed-out")
      XCTAssertEqual(frame["deliveryStarted"] as? Bool, false)
      XCTAssertEqual(frame["deliveryReturned"] as? Bool, false)
    }
    let busyTokens = Set(busyFrames.compactMap { $0["token"] as? Int })
    XCTAssertFalse(try XCTUnwrap(busy["callbacks"] as? [[String: Any]])
      .contains { busyTokens.contains($0["token"] as? Int ?? 0) })
    app.typeKey("j", modifierFlags: [])
    _ = try checkpoint("busy-original-followup", requestCount: count, hourTarget: false)
    control("zoned")
    control("locale")
    _ = try wait("outer-value") { $0["locale"] as? String == "ar-EG" && $0["valueClass"] as? String == "ZonedDateTime" }
    _ = try wait("outer-binding") { $0["ready"] as? Bool == true }
    let unicodeHour = revealHour()
    unicodeHour.tap()
    _ = try receipt("unicode-original-setup")
    unicodeHour.typeText("٢")
    count += 1
    let unicode = try receipt("unicode-original-commit")
    let unicodeRequest = try XCTUnwrap((unicode["requests"] as? [[String: Any]])?.last)
    XCTAssertEqual(unicodeRequest["value"] as? String, "2024-10-01T02:45:07-04:00[America/New_York]")
    XCTAssertEqual(unicodeRequest["valueClass"] as? String, "ZonedDateTime")
    XCTAssertEqual((unicode["requests"] as? [[String: Any]])?.count, count)
    XCTAssertEqual(read("outer-value")?["value"] as? String, "2024-10-01T13:45:07-04:00[America/New_York]")
    control("candidate")
    let candidateState = try wait("candidate-state") { $0["ready"] as? Bool == true && $0["value"] as? String == "13:45:07" }
    let candidateHour = reveal(try XCTUnwrap(candidateState["hourTestID"] as? String), towardStart: true)
    candidateHour.tap()
    _ = try receipt("candidate-owned-entry-setup")
    candidateHour.typeKey(.upArrow, modifierFlags: [])
    count += 1
    let candidateEntry = try checkpoint("candidate-owned-entry", requestCount: count, hourTarget: false)
    let candidateRequest = try XCTUnwrap((candidateEntry["requests"] as? [[String: Any]])?.last)
    XCTAssertEqual(candidateRequest["field"] as? String, "candidate")
    XCTAssertEqual(candidateRequest["value"] as? String, "14:45:07")
    XCTAssertEqual(read("candidate-state")?["value"] as? String, "13:45:07")
    _ = reveal("candidate-button", towardStart: false)
    control("focus-button")
    _ = try receipt("candidate-original-control-setup")
    app.typeKey(.rightArrow, modifierFlags: [])
    let candidateControl = try checkpoint("candidate-original-control", requestCount: count, hourTarget: false)
    let candidateFocus = try XCTUnwrap((candidateControl["focusActions"] as? [[String: Any]])?.first)
    XCTAssertEqual(candidateFocus["action"] as? String, "next")
    XCTAssertEqual(candidateFocus["observed"] as? Bool, true)
    element("candidate-core").typeText("7")
    XCTAssertEqual(element("candidate-core").value as? String, "7")
    XCTAssertEqual(read("candidate-state")?["value"] as? String, "13:45:07")
    control("locale")
    let rtlCandidate = try wait("candidate-state") { $0["ready"] as? Bool == true && $0["locale"] as? String == "ar-EG" }
    let rtlHour = reveal(try XCTUnwrap(rtlCandidate["hourTestID"] as? String), towardStart: true)
    rtlHour.tap()
    _ = try receipt("candidate-rtl-right-setup")
    rtlHour.typeKey(.leftArrow, modifierFlags: [])
    _ = try checkpoint("candidate-rtl-right", requestCount: count, hourTarget: false)
    _ = try receipt("candidate-rtl-left-setup")
    element(try XCTUnwrap(rtlCandidate["minuteTestID"] as? String)).typeKey(.rightArrow, modifierFlags: [])
    _ = try checkpoint("candidate-rtl-left", requestCount: count, hourTarget: false)
  }
}
