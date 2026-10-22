import XCTest

final class KeyboardDefaultTrialTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
  private var previousSnapshot = 0
  private var originalIdentity: [String] = []

  override func setUpWithError() throws {
    continueAfterFailure = false
    XCTAssertTrue(app.state == .runningForeground || app.state == .runningBackground,
                  "The single host launch must already have started the product")
    app.activate()
  }

  override func tearDownWithError() throws {
    let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screen.lifetime = .keepAlways
    add(screen)
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = "original-final-accessibility-tree"
    tree.lifetime = .keepAlways
    add(tree)
  }

  private func element(_ id: String) -> XCUIElement {
    return app.descendants(matching: .any).matching(identifier: id).firstMatch
  }

  private func waitLabel(_ id: String, _ value: String) {
    let predicate = NSPredicate(format: "label == %@", value)
    XCTAssertTrue(expectation(for: predicate, evaluatedWith: element(id)).isInverted == false)
    waitForExpectations(timeout: 20)
  }

  @discardableResult
  private func snapshot(_ name: String, text: String, focused: Bool = true,
                        sameOriginal: Bool = true) throws -> [String: Any] {
    element("keyboard-inspect").tap()
    let label = element("keyboard-snapshot")
    let old = previousSnapshot
    let fresh = NSPredicate { _, _ in
      guard let data = label.label.data(using: .utf8),
            let row = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let sequence = row["sequence"] as? Int else { return false }
      return sequence > old
    }
    expectation(for: fresh, evaluatedWith: label)
    waitForExpectations(timeout: 20)
    let row = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(label.label.utf8)) as? [String: Any])
    previousSnapshot = try XCTUnwrap(row["sequence"] as? Int)
    let response = try XCTUnwrap(row["response"] as? [String: Any])
    let inspection = try XCTUnwrap(response["inspection"] as? [String: Any])
    let fields = try XCTUnwrap(inspection["fields"] as? [[String: Any]])
    let editor = try XCTUnwrap(fields.first { $0["descriptorId"] as? String == "editor" })
    XCTAssertEqual(editor["resolved"] as? Bool, true)
    XCTAssertEqual(editor["currentDescriptor"] as? Bool, true)
    XCTAssertEqual(editor["metadataOnly"] as? Bool, true)
    XCTAssertEqual(editor["stateUnchanged"] as? Bool, true)
    let state = try XCTUnwrap(editor["state"] as? [String: Any])
    XCTAssertEqual(state["text"] as? String, text, "Actual SDK editing result: " + name)
    XCTAssertEqual(state["focused"] as? Bool, focused, "Actual SDK focus: " + name)
    XCTAssertEqual(state["selection"] as? [Int], [text.utf16.count, text.utf16.count])
    let identity = try ["originalInstance", "editorInstance", "metadataInstance"].map {
      try XCTUnwrap(editor[$0] as? String)
    }
    if originalIdentity.isEmpty { originalIdentity = identity }
    else if sameOriginal { XCTAssertEqual(identity, originalIdentity) }
    else { XCTAssertNotEqual(identity[0], originalIdentity[0]); originalIdentity = identity }
    let attachment = XCTAttachment(string: label.label)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    return row
  }

  func testOriginalEditorDefaults() throws {
    waitLabel("keyboard-ready", "ready")
    let editor = element("keyboard-default-editor")
    XCTAssertTrue(editor.waitForExistence(timeout: 20))
    editor.tap()
    try snapshot("initial-original", text: "")
    editor.typeKey("a", modifierFlags: [])
    try snapshot("veto-a", text: "")
    editor.typeKey("b", modifierFlags: [])
    try snapshot("allow-b-once", text: "b")
    element("keyboard-next-mode").tap()
    waitLabel("keyboard-mode", "mode allow")
    editor.typeKey("a", modifierFlags: [])
    try snapshot("callback-replacement-allow-a", text: "ba")
    element("keyboard-next-mode").tap()
    waitLabel("keyboard-mode", "mode late")
    editor.typeKey("c", modifierFlags: [])
    try snapshot("late-veto-cannot-capture-c", text: "bac")
    element("keyboard-next-mode").tap()
    waitLabel("keyboard-mode", "mode throw")
    editor.typeKey("d", modifierFlags: [])
    try snapshot("exception-settles-d-veto", text: "bac")
    element("keyboard-replay").tap()
    waitLabel("keyboard-mode", "stale ack false")
    editor.typeKey("a", modifierFlags: .shift)
    try snapshot("shift-modifier-original", text: "bacA")
    let independent = element("keyboard-independent-editor")
    independent.tap()
    independent.typeKey("a", modifierFlags: [])
    XCTAssertEqual(independent.value as? String, "a")
    try snapshot("unregistered-editor-unchanged-owner", text: "bacA", focused: false)
    element("keyboard-modal").tap()
    let modal = element("keyboard-modal-editor")
    XCTAssertTrue(modal.waitForExistence(timeout: 20))
    modal.tap()
    modal.typeKey("a", modifierFlags: [])
    XCTAssertEqual(modal.value as? String, "a")
    element("keyboard-close-modal").tap()
    waitLabel("keyboard-ready", "ready")
    editor.tap()
    try snapshot("modal-window-retirement", text: "bacA")
    element("keyboard-hide").tap()
    element("keyboard-hide").tap()
    waitLabel("keyboard-ready", "ready")
    editor.tap()
    try snapshot("activity-retained-original", text: "bacA")
    element("keyboard-replace").tap()
    waitLabel("keyboard-ready", "ready")
    let replacement = element("keyboard-default-editor")
    replacement.tap()
    try snapshot("replacement-new-original", text: "", sameOriginal: false)
    replacement.typeKey("b", modifierFlags: [])
    try snapshot("replacement-allows-once", text: "b")
    element("keyboard-export").tap()
  }
}
