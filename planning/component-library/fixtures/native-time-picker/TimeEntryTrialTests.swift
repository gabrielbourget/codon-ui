import XCTest

final class TimeEntryTrialTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
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
    tree.name = "original-final-accessibility-tree"
    tree.lifetime = .keepAlways
    add(tree)
  }
  private func element(_ id: String) -> XCUIElement {
    return app.descendants(matching: .any).matching(identifier: id).firstMatch
  }
  private func waitLabel(_ id: String, _ value: String) {
    expectation(for: NSPredicate(format: "label == %@", value), evaluatedWith: element(id))
    waitForExpectations(timeout: 20)
  }
  private func read() -> [String: Any]? {
    return try? JSONSerialization.jsonObject(with: Data(element("time-sdk-snapshot").label.utf8)) as? [String: Any]
  }
  @discardableResult private func snapshot(_ name: String, _ predicate: @escaping ([String: Any]) -> Bool) throws -> [String: Any] {
    expectation(for: NSPredicate { _, _ in
      guard let row = self.read() else { return false }
      return predicate(row)
    }, evaluatedWith: element("time-sdk-snapshot"))
    waitForExpectations(timeout: 20)
    let row = try XCTUnwrap(read())
    let attachment = XCTAttachment(string: element("time-sdk-snapshot").label)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    return row
  }
  private func requests(_ row: [String: Any]) -> [[String: Any]] { return row["requests"] as? [[String: Any]] ?? [] }
  private func expectLast(_ row: [String: Any], _ value: String, _ valueClass: String) {
    let last = requests(row).last
    XCTAssertEqual(last?["value"] as? String, value)
    XCTAssertEqual(last?["valueClass"] as? String, valueClass)
  }
  func testOwnedSegmentEntry() throws {
    waitLabel("time-sdk-hour-ready", "ready")
    waitLabel("time-sdk-scope-ready", "ready")
    let originalCoreValue = element("time-sdk-existing-core").value as? String
    let hour = element("time-sdk-hour")
    XCTAssertTrue(hour.exists)
    hour.tap()
    try snapshot("initial-owned-focus") { $0["focused"] as? String == "hour" }
    hour.typeKey(.upArrow, modifierFlags: [])
    let first = try snapshot("time-veto-first") { self.requests($0).count == 1 }
    expectLast(first, "14:45:07", "Time")
    XCTAssertEqual(first["value"] as? String, "13:45:07")
    hour.typeKey(.upArrow, modifierFlags: [])
    let second = try snapshot("time-veto-repeat") { self.requests($0).count == 2 }
    expectLast(second, "14:45:07", "Time")
    XCTAssertEqual(second["value"] as? String, "13:45:07")

    element("time-sdk-readonly").tap()
    let readonly = try snapshot("readonly-owned-focus") { ($0["readonly"] as? Bool) == true && ($0["scopeReady"] as? Bool) == true }
    let observed = try XCTUnwrap(readonly["observations"] as? Int)
    hour.typeKey("9", modifierFlags: [])
    let refused = try snapshot("readonly-original-key-refused") { ($0["observations"] as? Int ?? 0) > observed }
    XCTAssertEqual(requests(refused).count, 2)
    XCTAssertEqual(refused["value"] as? String, "13:45:07")
    XCTAssertEqual(refused["focused"] as? String, "hour")
    element("time-sdk-readonly").tap()
    try snapshot("readonly-retired") { ($0["readonly"] as? Bool) == false && ($0["scopeReady"] as? Bool) == true }
    element("time-sdk-echo").tap()
    hour.typeKey("8", modifierFlags: [])
    let echo = try snapshot("time-owner-echo") { self.requests($0).count == 3 && $0["value"] as? String == "08:45:07" }
    expectLast(echo, "08:45:07", "Time")

    element("time-sdk-class").tap()
    try snapshot("calendar-owner-replaced") { $0["valueClass"] as? String == "CalendarDateTime" }
    hour.tap()
    hour.typeKey(.upArrow, modifierFlags: [])
    let calendar = try snapshot("calendar-original-class-request") { self.requests($0).count == 4 }
    expectLast(calendar, "2024-10-01T14:45:07", "CalendarDateTime")
    XCTAssertEqual(calendar["value"] as? String, "2024-10-01T13:45:07")
    element("time-sdk-class").tap()
    try snapshot("zoned-owner-replaced") { $0["valueClass"] as? String == "ZonedDateTime" }
    hour.tap()
    hour.typeKey(.upArrow, modifierFlags: [])
    let zoned = try snapshot("zoned-original-class-request") { self.requests($0).count == 5 }
    expectLast(zoned, "2024-10-01T14:45:07-04:00[America/New_York]", "ZonedDateTime")
    XCTAssertEqual(zoned["value"] as? String, "2024-10-01T13:45:07-04:00[America/New_York]")

    element("time-sdk-locale").tap()
    try snapshot("actual-arabic-locale") { $0["locale"] as? String == "ar-EG" }
    hour.tap()
    hour.typeText("٢")
    let localized = try snapshot("original-unicode-input-commit") { self.requests($0).count == 6 }
    expectLast(localized, "2024-10-01T02:45:07-04:00[America/New_York]", "ZonedDateTime")
    element("time-sdk-hidden").tap()
    try snapshot("hidden-owned-editor-retired") { ($0["hidden"] as? Bool) == true && $0["focused"] as? String == nil }
    element("time-sdk-hidden").tap()
    waitLabel("time-sdk-hour-ready", "ready")
    hour.tap()
    try snapshot("shown-original-editor-refocused") { ($0["hidden"] as? Bool) == false && $0["focused"] as? String == "hour" }
    element("time-sdk-disabled").tap()
    try snapshot("disabled-original-editor-focus-retained") { ($0["disabled"] as? Bool) == true && $0["focused"] as? String == "hour" && ($0["scopeReady"] as? Bool) == true }
    XCTAssertEqual(element("time-sdk-existing-core").value as? String, originalCoreValue)
  }
}
