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
  private func receipt(_ name: String, nativeEditors: [String] = []) throws -> [String: Any] {
    let previous = read("field-sdk-receipt-snapshot")?["batch"] as? Int ?? 0
    element("field-sdk-checkpoint").tap()
    let row = try wait("field-sdk-receipt-snapshot") { ($0["batch"] as? Int ?? 0) > previous }
    XCTAssertEqual(row["dropped"] as? Int, 0)
    XCTAssertTrue(try XCTUnwrap(row["failures"] as? [[String: Any]]).isEmpty)
    var report = row
    report["case"] = name
    report["nativeValues"] = Dictionary(uniqueKeysWithValues: nativeEditors.map { ($0, element($0).value as? String ?? "") })
    let encoded = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
    let attachment = XCTAttachment(string: String(decoding: encoded, as: UTF8.self))
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    return row
  }
  private func checkpoint(_ name: String, requestCount: Int, hourTarget: Bool = true, nativeEditors: [String] = []) throws -> [String: Any] {
    let row = try receipt(name, nativeEditors: nativeEditors)
    let frames = try XCTUnwrap(row["frames"] as? [[String: Any]])
    let keys = frames.filter { $0["kind"] as? String == "key" && $0["phase"] as? String == "down" }
    XCTAssertFalse(keys.isEmpty, "Original key frame missing: " + name)
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

    reveal("outer-button", towardStart: false).tap()
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
    reveal("outer-button", towardStart: false).tap()
    _ = try receipt("authored-child-navigation-setup")
    element("outer-button").typeKey(.rightArrow, modifierFlags: [])
    let navigated = try checkpoint("authored-child-before-group-navigation", requestCount: count, hourTarget: false)
    let navigationKeys = try XCTUnwrap(navigated["frames"] as? [[String: Any]])
      .filter { $0["kind"] as? String == "key" && $0["phase"] as? String == "down" }
    let navigationToken = try XCTUnwrap(navigationKeys.last?["token"] as? Int)
    let navigationCallbacks = try XCTUnwrap(navigated["callbacks"] as? [[String: Any]])
      .filter { $0["token"] as? Int == navigationToken }
    XCTAssertEqual(navigationCallbacks.map { $0["kind"] as? String }, ["child-key", "field-key"])

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
  }
}
