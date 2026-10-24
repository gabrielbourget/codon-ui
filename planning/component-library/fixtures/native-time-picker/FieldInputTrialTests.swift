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
    if !button.isHittable { app.swipeUp() }
    XCTAssertTrue(button.isHittable)
    button.tap()
  }
  private func revealHour() -> XCUIElement {
    let hour = element("outer-hour")
    if !hour.isHittable { app.swipeDown() }
    XCTAssertTrue(hour.isHittable)
    return hour
  }
  private func checkpoint(_ name: String, requestCount: Int) throws -> [String: Any] {
    let previous = read("field-sdk-receipt-snapshot")?["batch"] as? Int ?? 0
    element("field-sdk-checkpoint").tap()
    let row = try wait("field-sdk-receipt-snapshot") { ($0["batch"] as? Int ?? 0) > previous }
    XCTAssertEqual(row["dropped"] as? Int, 0)
    XCTAssertTrue(try XCTUnwrap(row["failures"] as? [[String: Any]]).isEmpty)
    let frames = try XCTUnwrap(row["frames"] as? [[String: Any]])
    let keys = frames.filter { $0["kind"] as? String == "key" && $0["phase"] as? String == "down" }
    XCTAssertFalse(keys.isEmpty, "Original key frame missing: " + name)
    for key in keys {
      let identity = try XCTUnwrap(key["identity"] as? [String: Any])
      let target = try XCTUnwrap(identity["target"] as? Int)
      if let originalHourTarget { XCTAssertEqual(target, originalHourTarget) }
      else { originalHourTarget = target }
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
    let attachment = XCTAttachment(string: element("field-sdk-receipt-snapshot").label)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    return row
  }
  private func guardCheckpoint(_ name: String, requestCount: Int) throws {
    let previous = read("field-sdk-receipt-snapshot")?["batch"] as? Int ?? 0
    element("field-sdk-checkpoint").tap()
    let row = try wait("field-sdk-receipt-snapshot") { ($0["batch"] as? Int ?? 0) > previous }
    XCTAssertEqual(row["dropped"] as? Int, 0)
    XCTAssertTrue(try XCTUnwrap(row["failures"] as? [[String: Any]]).isEmpty)
    let observation = try XCTUnwrap((row["observations"] as? [[String: Any]])?.last)
    XCTAssertEqual(observation["field"] as? String, "outer")
    XCTAssertEqual(observation[name] as? Bool, true)
    XCTAssertEqual((observation["data"] as? [String: Any])?["key"] as? String, "9")
    XCTAssertEqual((observation["data"] as? [String: Any])?["focusedTarget"] as? Int, originalHourTarget)
    XCTAssertEqual((row["requests"] as? [[String: Any]])?.count, requestCount)
    let frames = try XCTUnwrap(row["frames"] as? [[String: Any]])
    XCTAssertTrue(frames.allSatisfy { ($0["error"] as? String) == "" })
    let attachment = XCTAttachment(string: element("field-sdk-receipt-snapshot").label)
    attachment.name = "original-" + name + "-key-refusal"
    attachment.lifetime = .keepAlways
    add(attachment)
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
  }
}
