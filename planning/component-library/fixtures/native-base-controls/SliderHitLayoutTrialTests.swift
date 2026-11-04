import XCTest

// One iOS P01 translated-thumb slice. A passing method still requires main's independent
// during-hold capture; it cannot establish that checkpoint or whole Slider G01 by itself.
final class SliderHitLayoutTrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let holdSeconds: TimeInterval = 5
    private var admission: [String: String] = [:]

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        for key in ["CODON_SLIDER_SCENE_SHA256", "CODON_SLIDER_PRODUCT_SHA256",
                    "CODON_SLIDER_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing admission identity " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
            admission[key] = value
        }
        XCTAssertEqual(app.state, .runningForeground, "Main must prelaunch the matched Slider product")
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        let window = app.windows.firstMatch.frame
        XCTAssertGreaterThan(window.height, window.width)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        XCTAssertTrue(node("slider-scalar").waitForExistence(timeout: 10))
    }

    override func tearDownWithError() throws {
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = "slider-hit-layout-final-screen"
        screen.lifetime = .keepAlways
        add(screen)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "slider-hit-layout-final-hierarchy"
        tree.lifetime = .keepAlways
        add(tree)
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func tap(_ label: String) {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 10), "Missing " + label)
        for _ in 0..<12 {
            if button.isHittable { break }
            guard let scroll = app.scrollViews.allElementsBoundByIndex.first(where: { $0.isHittable }) else { break }
            if button.frame.minY < scroll.frame.minY { scroll.swipeDown() }
            else { scroll.swipeUp() }
        }
        XCTAssertTrue(button.isHittable, "Unreachable setup control " + label)
        button.tap()
    }

    private func waitUntil(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }

    private func number(_ row: [String: Any], _ key: String) throws -> Double {
        let value = try XCTUnwrap(row[key] as? NSNumber, "Missing numeric " + key).doubleValue
        XCTAssertTrue(value.isFinite, "Nonfinite " + key)
        return value
    }

    private func rect(_ row: [String: Any], _ key: String) throws -> CGRect {
        let value = try XCTUnwrap(row[key] as? [String: Any], "Missing original native frame " + key)
        let frame = CGRect(x: try number(value, "x"), y: try number(value, "y"),
                           width: try number(value, "width"), height: try number(value, "height"))
        XCTAssertGreaterThan(frame.width, 0)
        XCTAssertGreaterThan(frame.height, 0)
        return frame
    }

    private func sameFrame(_ actual: CGRect, _ expected: CGRect, accuracy: CGFloat = 1) {
        for (left, right) in zip([actual.minX, actual.minY, actual.width, actual.height],
                                 [expected.minX, expected.minY, expected.width, expected.height]) {
            XCTAssertEqual(left, right, accuracy: accuracy)
        }
    }

    private func geometry() throws -> [String: Any] {
        let raw = node("slider-layout-native-geometry").label
        let first = try XCTUnwrap(raw.firstIndex(of: "{"), "Native geometry unavailable: " + raw)
        let last = try XCTUnwrap(raw.lastIndex(of: "}"))
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw[first...last].utf8)) as? [String: Any])
    }

    private func measure() throws -> [String: Any] {
        tap("Measure scalar original thumb geometry")
        waitUntil("Original native geometry did not arrive") { (try? self.geometry()) != nil }
        let value = try geometry()
        XCTAssertEqual(value["coordinateSpace"] as? String,
                       "stock-native-viewport-bounds-with-original-root-window-offset")
        let tags = try XCTUnwrap(value["tags"] as? [Int])
        XCTAssertEqual(tags.count, 4)
        XCTAssertEqual(Set(tags).count, 4)
        XCTAssertTrue(tags.allSatisfy { $0 > 0 })
        XCTAssertTrue(try XCTUnwrap(value["targetID"] as? String).hasSuffix(":thumb:0"))
        return value
    }

    private func state() throws -> [String: Any] {
        let raw = node("slider-layout-held-json").label
        let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        try exact(value["dropped"], 0)
        return value
    }

    private func events() throws -> [[String: Any]] {
        try XCTUnwrap(try state()["receipts"] as? [[String: Any]])
    }

    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let left = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let right = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(left, right)
    }

    private func mark(_ name: String, _ values: [String: Any]) throws {
        var row = values
        row["epochSeconds"] = Date().timeIntervalSince1970
        row["uptimeSeconds"] = ProcessInfo.processInfo.systemUptime
        let data = try JSONSerialization.data(withJSONObject: row, options: .sortedKeys)
        FileHandle.standardOutput.write(Data((name + " ").utf8) + data + Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testP01TranslatedOriginalThumbHoldThenDrag() throws {
        tap("Prepare scalar layout witness")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        let baseline = try measure()
        tap("Use scalar layout translated")
        let translated = try measure()
        try exact(translated["tags"], try XCTUnwrap(baseline["tags"]))
        try exact(translated["targetID"], try XCTUnwrap(baseline["targetID"]))
        let before = try XCTUnwrap(baseline["window"] as? [String: Any])
        let current = try XCTUnwrap(translated["window"] as? [String: Any])
        sameFrame(try rect(translated, "rootWindow"), try rect(baseline, "rootWindow"))
        let track = try rect(current, "track")
        sameFrame(track, try rect(before, "track"))
        for key in ["target", "paint"] {
            let original = try rect(before, key)
            sameFrame(try rect(current, key), original.offsetBy(dx: 48, dy: 0))
        }
        let target = try rect(current, "target")
        let paint = try rect(current, "paint")
        let rootWindow = try rect(translated, "rootWindow")
        let viewport = try XCTUnwrap(translated["viewport"] as? [String: Any])
        let rootViewport = try rect(viewport, "root")
        let pageOffset = CGPoint(x: rootWindow.minX - rootViewport.minX, y: rootWindow.minY - rootViewport.minY)
        sameFrame(node("slider-scalar").frame, rootWindow)
        sameFrame(node("slider-scalar-thumb-1-target").frame, target)
        let start = CGPoint(x: paint.midX, y: paint.midY)
        XCTAssertTrue(target.contains(start))
        let inset: CGFloat = track.width > 44 ? 22 : 0
        let span = track.width - 2 * inset
        XCTAssertGreaterThan(span, 0)
        let end = CGPoint(x: start.x + 0.2 * span, y: start.y)
        let window = app.windows.firstMatch
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(start))
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(end))
        XCTAssertTrue(track.contains(start))
        XCTAssertTrue(track.contains(end))
        let hud = node("slider-layout-held-json")
        XCTAssertTrue(hud.exists, "The independent held-state capture needs the compact fixture receipt")
        XCTAssertTrue(window.frame.contains(hud.frame), "Held receipt must be visible without scrolling during input")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        XCTAssertTrue(try events().isEmpty)
        let origin = window.coordinate(withNormalizedOffset: .zero)
        let from = origin.withOffset(CGVector(dx: start.x - window.frame.minX, dy: start.y - window.frame.minY))
        let to = origin.withOffset(CGVector(dx: end.x - window.frame.minX, dy: end.y - window.frame.minY))
        try mark("CODON_SLIDER_GESTURE_BEGIN", [
            "admission": admission, "geometry": translated, "before": try state(),
            "startPoints": [start.x, start.y], "endPoints": [end.x, end.y], "holdSeconds": holdSeconds,
            "heldCheckpoint": "INDEPENDENT_CAPTURE_REQUIRED_NOT_ASSERTED_BY_THIS_METHOD"
        ])
        from.press(forDuration: holdSeconds, thenDragTo: to)
        try mark("CODON_SLIDER_GESTURE_RETURN", ["owner": try state(), "events": try events()])
        waitUntil("Original drag did not produce one end at 0.7") {
            guard let row = try? self.state() else { return false }
            return row["scalar"] as? Double == 0.7 && row["ends"] as? Int == 1
        }
        let result = try state()
        try exact(result["scalar"], 0.7)
        try exact(result["ends"], 1)
        XCTAssertGreaterThan(try XCTUnwrap(result["requests"] as? Int), 0)
        let rows = try events()
        try exact(result["preset"], "translated")
        let tags = try XCTUnwrap(translated["tags"] as? [Int])
        try exact(result["rootTag"], tags[0])
        for (index, row) in rows.enumerated() {
            try exact(row["rootTag"], tags[0])
            try exact(row["preset"], "translated")
            try exact(row["sequence"], index + 1)
        }
        let touches = rows.filter { $0["kind"] as? String == "touch" }
        let downs = touches.filter { $0["phase"] as? String == "start" }
        XCTAssertEqual(downs.count, 1)
        let down = try XCTUnwrap(downs.first, "Original DOWN was lost")
        let moves = touches.filter { $0["phase"] as? String == "move" }
        XCTAssertFalse(moves.isEmpty, "Actual native MOVE receipts are required")
        let ups = touches.filter { $0["phase"] as? String == "end" }
        XCTAssertEqual(ups.count, 1)
        XCTAssertFalse(touches.contains { $0["phase"] as? String == "cancel" })
        let up = try XCTUnwrap(ups.first)
        try exact(down["target"], tags[2])
        XCTAssertEqual(try number(down, "pageX") + Double(pageOffset.x), Double(start.x), accuracy: 1)
        XCTAssertEqual(try number(down, "pageY") + Double(pageOffset.y), Double(start.y), accuracy: 1)
        for row in moves + [up] {
            try exact(row["identifier"], try XCTUnwrap(down["identifier"]))
            try exact(row["target"], tags[2])
            XCTAssertGreaterThanOrEqual(try number(row, "timestamp"), try number(down, "timestamp"))
            XCTAssertLessThanOrEqual(try number(row, "timestamp"), try number(up, "timestamp"))
        }
        XCTAssertLessThan(try number(down, "sequence"), try number(try XCTUnwrap(moves.first), "sequence"))
        XCTAssertLessThan(try number(try XCTUnwrap(moves.last), "sequence"), try number(up, "sequence"))
        XCTAssertEqual(try number(up, "pageX") - number(down, "pageX"), Double(0.2 * span), accuracy: 1)
        XCTAssertEqual(try number(up, "pageY"), try number(down, "pageY"), accuracy: 1)
        let requests = rows.filter { $0["kind"] as? String == "request" }
        let ends = rows.filter { $0["kind"] as? String == "change-end" }
        try exact(result["requests"], requests.count)
        XCTAssertEqual(ends.count, 1)
        try exact(requests.last?["value"], 0.7)
        try exact(ends.first?["value"], 0.7)
        XCTAssertGreaterThan(try number(try XCTUnwrap(ends.first), "sequence"),
                             try number(try XCTUnwrap(requests.last), "sequence"))
        try mark("CODON_SLIDER_FINAL_OUTCOME", ["owner": result, "events": rows,
                 "scope": "iOS P01 translated slice; independent held capture and remaining G01 matrix required"])
    }
}
