import XCTest

// Add to the existing showcase UI-test target. Main owns each native method and its SDK witnesses.
final class ButtonG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "acf215feaedcb1d80b5c8f1e35d4836eb86e1e844ed0f60e430d817ed0e57434"
    private var originalRootTag = 0

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        guard ProcessInfo.processInfo.environment["CODON_BUTTON_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the exact LibraryScene fixture before execution")
            throw NSError(domain: "ButtonG02Admission", code: 1)
        }
        for key in ["CODON_BUTTON_PRODUCT_SHA256", "CODON_BUTTON_INPUT_RECEIPT_SHA256",
                    "CODON_BUTTON_SDK_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
        }
        // Coordinator prepares the default Text/Button scene and genuine current SDK binding first.
        // No replacement launch, warm-up target press or implicit failure-path reset.
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product")
            throw NSError(domain: "ButtonG02Admission", code: 2)
        }
        if app.state != .runningForeground { app.activate() }
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        XCTAssertTrue(primary.waitForExistence(timeout: 10))
        try exact(try owner()["actions"], 0)
        try exact(try owner()["longActions"], 0)
        try exact(try owner()["longPressEnabled"], false)
        try exact(try owner()["disabled"], false)
        try exact(try owner()["pending"], false)
        try exact(try owner()["pressStartTakeover"], "none")
        try exact(try receipts(), [])
        originalRootTag = try XCTUnwrap(try owner()["rootTag"] as? Int)
        XCTAssertGreaterThan(originalRootTag, 0)
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "button-g02-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "button-g02-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
    }

    private var primary: XCUIElement { app.buttons.matching(identifier: "library-button").firstMatch }
    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func control(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    private func reveal(_ target: XCUIElement, allowDisabled: Bool = false) {
        let visible = {
            guard target.exists, target.frame.width > 0, target.frame.height > 0 else { return false }
            let center = CGPoint(x: target.frame.midX, y: target.frame.midY)
            return self.app.windows.firstMatch.frame.contains(center) &&
                self.app.scrollViews.allElementsBoundByIndex.contains { $0.isHittable && $0.frame.contains(center) }
        }
        for _ in 0..<12 {
            if target.exists && (target.isHittable || (allowDisabled && visible())) { return }
            guard let scroll = app.scrollViews.allElementsBoundByIndex.first(where: { $0.isHittable }) else { break }
            if target.exists && target.frame.minY < scroll.frame.minY { scroll.swipeDown() }
            else { scroll.swipeUp() }
        }
        XCTAssertTrue(target.exists && (target.isHittable || (allowDisabled && visible())), "Unreachable original target: " + target.debugDescription)
    }
    private func tapControl(_ label: String) {
        let target = control(label)
        XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap()
    }
    private func read(_ id: String) throws -> Any {
        let target = node(id)
        XCTAssertTrue(target.exists, "Missing original fixture receipt " + id)
        return try JSONSerialization.jsonObject(with: Data(target.label.utf8))
    }
    private func owner() throws -> [String: Any] {
        try XCTUnwrap(try read("library-button-behavior") as? [String: Any])
    }
    private func receipts() throws -> [[String: Any]] {
        try XCTUnwrap(try read("library-button-callbacks") as? [[String: Any]])
    }
    private func rows(_ kind: String) throws -> [[String: Any]] {
        try receipts().filter { $0["kind"] as? String == kind }
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let lhs = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let rhs = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: lhs, as: UTF8.self), String(decoding: rhs, as: UTF8.self))
    }
    private func waitUntil(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }
    private func settled(actions: Int, longActions: Int = 0, cycles: Int) {
        waitUntil("One original contact did not settle to the required public outcome") {
            (try? self.owner()["actions"] as? Int) == actions &&
            (try? self.owner()["longActions"] as? Int) == longActions &&
            (try? self.rows("press:end").count) == cycles
        }
    }
    private func count(_ kind: String, _ expected: Int) throws {
        XCTAssertEqual(try rows(kind).count, expected, kind)
    }
    private func balanced(_ cycles: Int) throws {
        try count("press:start", cycles); try count("press:end", cycles)
        try exact(try rows("press:change").map { try XCTUnwrap($0["data"]) },
                  (0..<cycles).flatMap { _ in [true, false] })
    }
    private func sequence(_ row: [String: Any]) throws -> Int { try XCTUnwrap(row["sequence"] as? Int) }
    private func event(_ row: [String: Any]) throws -> [String: Any] {
        try XCTUnwrap(row["data"] as? [String: Any])
    }
    private func pointerCallbacks(_ cycles: Int, ordinary: Int, long: Int) throws {
        try balanced(cycles)
        for kind in ["native:pressIn", "native:pressOut", "press:up"] { try count(kind, cycles) }
        try count("press", ordinary); try count("long:press", long)
        let starts = try rows("press:start"), ends = try rows("press:end")
        let changes = try rows("press:change"), ins = try rows("native:pressIn"), outs = try rows("native:pressOut")
        for index in 0..<cycles {
            XCTAssertLessThan(try sequence(starts[index]), try sequence(changes[index * 2]))
            XCTAssertLessThan(try sequence(changes[index * 2]), try sequence(ins[index]))
            XCTAssertLessThan(try sequence(starts[index]), try sequence(ends[index]))
            XCTAssertLessThan(try sequence(ends[index]), try sequence(changes[index * 2 + 1]))
            XCTAssertLessThan(try sequence(changes[index * 2 + 1]), try sequence(outs[index]))
            try exact(try event(starts[index]), try event(ins[index]))
            try exact(try event(ends[index]), try event(outs[index]))
        }
        let trace = try receipts()
        XCTAssertEqual(try trace.map { try sequence($0) }, Array(1...trace.count))
        // Short native activation may precede delayed press-out. Do not impose virtual-event ordering on touch.
        for row in try receipts() where row["kind"] as? String != "press:change" {
            let data = try event(row)
            XCTAssertGreaterThan(try XCTUnwrap(data["eventIdentity"] as? Int), 0)
            XCTAssertGreaterThan(try XCTUnwrap(data["nativeIdentity"] as? Int), 0)
            try exact(data["rootTag"], originalRootTag)
            XCTAssertTrue(data["kind"] is NSNull, "This cohort requires actual touch, not a virtual/key substitute")
            XCTAssertNotNil(data["target"], "Preserve the actual native target; it may be an original descendant")
        }
    }
    private func record(_ stage: String) throws {
        let root = primary.frame, window = app.windows.firstMatch.frame
        let payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "owner": try owner(), "callbacks": try receipts(),
            "originalRootTag": originalRootTag, "capturedAt": Date().timeIntervalSince1970,
            "buttonEnabled": primary.isEnabled, "keyboardActive": app.keyboards.firstMatch.exists,
            "buttonFrame": [root.minX, root.minY, root.width, root.height],
            "windowFrame": [window.minX, window.minY, window.width, window.height],
            "scope": "Public XCTest outcomes; JS identity tokens/observation clocks do not replace original SDK provenance, timing or lifetime witnesses"
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func ordinaryTouch() {
        reveal(primary); primary.tap() // One unpaced original target activation.
    }
    private func guarded(_ kind: String) throws {
        tapControl("Toggle library " + kind)
        reveal(primary, allowDisabled: kind == "disabled")
        XCTAssertEqual(primary.isEnabled, kind == "pending")
        primary.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        try exact(try owner()["actions"], 0)
        try exact(try receipts(), [])
        try record("S02-" + kind + "-guard")
        tapControl("Toggle library " + kind)
        ordinaryTouch(); settled(actions: 1, cycles: 1)
        try pointerCallbacks(1, ordinary: 1, long: 0)
        try record("S02-" + kind + "-first-reenabled-touch")
    }
    private func takeover(_ kind: String) throws {
        tapControl("Next library button press-start takeover")
        if kind == "pending" { tapControl("Next library button press-start takeover") }
        try exact(try owner()["pressStartTakeover"], kind)
        ordinaryTouch(); settled(actions: 0, cycles: 1)
        try exact(try owner()[kind], true)
        try exact(try owner()["pressStartTakeover"], "none")
        try balanced(1); try count("press", 0); try count("press:up", 0)
        try record("S02-" + kind + "-takes-over-original-contact")
        tapControl("Toggle library " + kind)
        ordinaryTouch(); settled(actions: 1, cycles: 2)
        try balanced(2); try count("press", 1); try count("press:up", 1)
        try record("S02-" + kind + "-distinct-recovery-contact")
    }

    func testS02FirstOriginalTouchBalancesCallbacksAndActsOnce() throws {
        ordinaryTouch(); settled(actions: 1, cycles: 1)
        try pointerCallbacks(1, ordinary: 1, long: 0)
        try record("S02-first-original-touch")
    }
    func testS02ThreeDistinctTouchesProduceThreeActions() throws {
        for expected in 1...3 {
            ordinaryTouch(); settled(actions: expected, cycles: expected)
            try pointerCallbacks(expected, ordinary: expected, long: 0)
        }
        try record("S02-three-distinct-contacts")
    }
    func testS02HeldReleaseWithoutLongActionActsOnce() throws {
        reveal(primary); primary.press(forDuration: 0.8)
        settled(actions: 1, cycles: 1)
        try pointerCallbacks(1, ordinary: 1, long: 0)
        try record("S02-held-release-no-long-action")
    }
    func testS02AuthoredLongActionDoesNotAlsoActivateOrdinaryAction() throws {
        tapControl("Toggle library long press action")
        reveal(primary); primary.press(forDuration: 0.8)
        settled(actions: 0, longActions: 1, cycles: 1)
        try pointerCallbacks(1, ordinary: 0, long: 1)
        try record("S02-authored-long-action")
    }
    func testS02DisabledGuardAndFirstReenabledTouch() throws { try guarded("disabled") }
    func testS02PendingGuardAndFirstReenabledTouch() throws { try guarded("pending") }
    func testS02DisabledOwnerTakeoverCancelsCurrentContact() throws { try takeover("disabled") }
    func testS02PendingOwnerTakeoverCancelsCurrentContact() throws { try takeover("pending") }
    func testS02OriginalContactCancelledOutsideTargetDoesNotAct() throws {
        reveal(primary)
        let window = app.windows.firstMatch
        let outside = CGPoint(x: window.frame.minX + 2, y: window.frame.minY + 2)
        XCTAssertFalse(primary.frame.contains(outside))
        let destination = window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: outside.x - window.frame.minX, dy: outside.y - window.frame.minY))
        primary.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.1, thenDragTo: destination)
        settled(actions: 0, cycles: 1)
        try balanced(1); try count("press", 0); try count("press:up", 0)
        try record("S02-original-contact-cancelled-outside")
    }
    func testS12LiveThemeAndFixtureRetainActionAndCallbackState() throws {
        ordinaryTouch(); settled(actions: 1, cycles: 1)
        let before = try receipts()
        tapControl("Dark theme"); tapControl("Compact width")
        try exact(try owner()["actions"], 1)
        try exact(try owner()["rootTag"], originalRootTag)
        try exact(try receipts(), before)
        ordinaryTouch(); settled(actions: 2, cycles: 2)
        try pointerCallbacks(2, ordinary: 2, long: 0)
        try record("S12-live-context-retains-native-button-state")
    }
}
