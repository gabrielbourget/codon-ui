import XCTest

final class ResponderTrialTests: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
  private var sequence = 0
  private var identity: [String] = []

  override func setUpWithError() throws {
    continueAfterFailure = false
    XCTAssertTrue(app.state == .runningForeground || app.state == .runningBackground)
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
    expectation(for: NSPredicate(format: "label == %@", value), evaluatedWith: element(id))
    waitForExpectations(timeout: 20)
  }

  private func inspect(_ name: String, focused: Bool) throws -> [Int] {
    element("responder-inspect").tap()
    let label = element("responder-snapshot"), old = sequence
    let fresh = NSPredicate { _, _ in
      guard let row = try? JSONSerialization.jsonObject(with: Data(label.label.utf8)) as? [String: Any],
            let next = row["sequence"] as? Int else { return false }
      return next > old
    }
    expectation(for: fresh, evaluatedWith: label)
    waitForExpectations(timeout: 20)
    let row = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(label.label.utf8)) as? [String: Any])
    sequence = try XCTUnwrap(row["sequence"] as? Int)
    let response = try XCTUnwrap(row["response"] as? [String: Any])
    let inspection = try XCTUnwrap(response["inspection"] as? [String: Any])
    let fields = try XCTUnwrap(inspection["fields"] as? [[String: Any]])
    let field = try XCTUnwrap(fields.first { $0["descriptorId"] as? String == "editor" })
    for flag in ["resolved", "available", "currentDescriptor", "metadataOnly", "stateUnchanged"] {
      XCTAssertEqual(field[flag] as? Bool, true, flag)
    }
    let state = try XCTUnwrap(field["state"] as? [String: Any])
    XCTAssertEqual(state["text"] as? String, "")
    XCTAssertEqual(state["focused"] as? Bool, focused, name)
    let currentIdentity = try ["originalInstance", "editorInstance", "metadataInstance"].map { try XCTUnwrap(field[$0] as? String) }
    if identity.isEmpty { identity = currentIdentity } else { XCTAssertEqual(identity, currentIdentity) }
    let attachment = XCTAttachment(string: label.label)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
    return try XCTUnwrap(state["selection"] as? [Int])
  }

  func testOriginalResponderFocusDefault() throws {
    waitLabel("responder-ready", "ready")
    let editor = element("responder-default-editor")
    XCTAssertTrue(editor.exists)
    let initialSelection = try inspect("initial-original", focused: false)
    editor.tap()
    let vetoedSelection = try inspect("vetoed-original-focus", focused: false)
    XCTAssertEqual(vetoedSelection, initialSelection)
    element("responder-toggle").tap()
    waitLabel("responder-mode", "allow")
    editor.tap()
    let allowedSelection = try inspect("allowed-original-focus", focused: true)
    XCTAssertEqual(allowedSelection, [0, 0])
  }
}
