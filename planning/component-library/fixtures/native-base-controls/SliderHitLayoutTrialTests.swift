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

    private func revealScalarSetup() {
        let scroll = app.scrollViews.firstMatch
        XCTAssertTrue(scroll.exists)
        for _ in 0..<12 {
            let visible = scroll.frame.insetBy(dx: 4, dy: 20)
            let scalar = node("slider-scalar").frame
            let heldReceipt = node("slider-layout-held-json").frame
            if visible.contains(scalar) && visible.contains(heldReceipt) { return }
            // Scroll through the blank right gutter, outside the original slider's hit region.
            let fromY: CGFloat = scalar.maxY > visible.maxY ? 0.75 : 0.25
            let from = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: fromY))
            let to = scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.50))
            from.press(forDuration: 0.05, thenDragTo: to)
        }
        XCTFail("Original scalar and held receipt must be visible before measuring")
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
        revealScalarSetup()
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

    func testP01RepositionedOriginalThumbHoldThenDrag() throws {
        tap("Prepare scalar layout witness")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        revealScalarSetup()
        let baseline = try measure()
        tap("Use scalar layout repositioned")
        let repositioned = try measure()
        try exact(repositioned["tags"], try XCTUnwrap(baseline["tags"]))
        try exact(repositioned["targetID"], try XCTUnwrap(baseline["targetID"]))
        let before = try XCTUnwrap(baseline["window"] as? [String: Any])
        let current = try XCTUnwrap(repositioned["window"] as? [String: Any])
        sameFrame(try rect(repositioned, "rootWindow"), try rect(baseline, "rootWindow"))
        let track = try rect(current, "track")
        sameFrame(track, try rect(before, "track"))
        for key in ["target", "paint"] {
            let original = try rect(before, key)
            let positioned = CGRect(x: track.minX + 0.35 * track.width - original.width / 2,
                                    y: track.midY - original.height / 2,
                                    width: original.width, height: original.height)
            sameFrame(try rect(current, key), positioned)
            XCTAssertGreaterThan(abs(positioned.midX - original.midX), 1)
        }
        let target = try rect(current, "target")
        let paint = try rect(current, "paint")
        let rootWindow = try rect(repositioned, "rootWindow")
        let viewport = try XCTUnwrap(repositioned["viewport"] as? [String: Any])
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
            "admission": admission, "geometry": repositioned, "before": try state(),
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
        try exact(result["preset"], "repositioned")
        let tags = try XCTUnwrap(repositioned["tags"] as? [Int])
        try exact(result["rootTag"], tags[0])
        for (index, row) in rows.enumerated() {
            try exact(row["rootTag"], tags[0])
            try exact(row["preset"], "repositioned")
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
        // The custom left percentage still owns visual placement after numeric owner echo.
        let after = try measure()
        try exact(after["tags"], tags)
        try exact(after["targetID"], try XCTUnwrap(repositioned["targetID"]))
        sameFrame(try rect(after, "rootWindow"), rootWindow)
        let afterWindow = try XCTUnwrap(after["window"] as? [String: Any])
        for key in ["track", "target", "paint"] {
            sameFrame(try rect(afterWindow, key), try rect(current, key))
        }
        try exact(try state()["scalar"], 0.7)
        try exact(try state()["ends"], 1)
        try exact(try state()["requests"], try XCTUnwrap(result["requests"]))
        try mark("CODON_SLIDER_FINAL_OUTCOME", ["owner": result, "events": rows, "geometryAfter": after,
                 "scope": "iOS P01 repositioned slice; independent held capture and remaining G01 matrix required"])
    }

    private func exerciseRotatedContact(atCorner: Bool) throws {
        tap("Prepare scalar layout witness")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        revealScalarSetup()
        let baseline = try measure()
        tap("Use scalar layout rotated-scaled")
        let rotated = try measure()
        try exact(rotated["tags"], try XCTUnwrap(baseline["tags"]))
        try exact(rotated["targetID"], try XCTUnwrap(baseline["targetID"]))
        let before = try XCTUnwrap(baseline["window"] as? [String: Any])
        let current = try XCTUnwrap(rotated["window"] as? [String: Any])
        sameFrame(try rect(rotated, "rootWindow"), try rect(baseline, "rootWindow"))
        let track = try rect(current, "track")
        sameFrame(track, try rect(before, "track"))
        for key in ["target", "paint"] {
            let original = try rect(before, key)
            let radians = 20 * Double.pi / 180
            let width = 1.25 * (original.width * CGFloat(cos(radians)) + original.height * CGFloat(sin(radians)))
            let height = 1.25 * (original.width * CGFloat(sin(radians)) + original.height * CGFloat(cos(radians)))
            let bounds = CGRect(x: original.midX + 48 - width / 2,
                                y: original.midY - height / 2, width: width, height: height)
            sameFrame(try rect(current, key), bounds)
            XCTAssertGreaterThan(width, original.width)
            XCTAssertGreaterThan(height, original.height)
        }
        let target = try rect(current, "target")
        let paint = try rect(current, "paint")
        let rootWindow = try rect(rotated, "rootWindow")
        let viewport = try XCTUnwrap(rotated["viewport"] as? [String: Any])
        let rootViewport = try rect(viewport, "root")
        let pageOffset = CGPoint(x: rootWindow.minX - rootViewport.minX, y: rootWindow.minY - rootViewport.minY)
        sameFrame(node("slider-scalar").frame, rootWindow)
        sameFrame(node("slider-scalar-thumb-1-target").frame, target)
        let start = atCorner ? CGPoint(x: paint.minX + 2, y: paint.minY + 2)
                             : CGPoint(x: paint.midX, y: paint.midY)
        XCTAssertTrue(target.contains(start))
        let inset: CGFloat = track.width > 44 ? 22 : 0
        let span = track.width - 2 * inset
        XCTAssertGreaterThan(span, 0)
        let snap: (Double) -> Double = { min(1, max(0, ($0 * 20).rounded() / 20)) }
        if atCorner {
            XCTAssertNotEqual(snap(Double((start.x - track.minX - inset) / span)), 0.5,
                              "The probe must distinguish track snapping from a thumb hold")
        }
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
            "admission": admission, "geometry": rotated, "before": try state(),
            "probe": atCorner ? "aabb-corner" : "measured-center",
            "startPoints": [start.x, start.y], "endPoints": [end.x, end.y], "holdSeconds": holdSeconds,
            "heldCheckpoint": "INDEPENDENT_CAPTURE_REQUIRED_NOT_ASSERTED_BY_THIS_METHOD"
        ])
        from.press(forDuration: holdSeconds, thenDragTo: to)
        try mark("CODON_SLIDER_GESTURE_RETURN", ["owner": try state(), "events": try events()])
        waitUntil("Original rotated contact did not produce one end") {
            (try? self.state()["ends"] as? Int) == 1
        }
        let result = try state()
        try exact(result["ends"], 1)
        XCTAssertGreaterThan(try XCTUnwrap(result["requests"] as? Int), 0)
        let rows = try events()
        try exact(result["preset"], "rotated-scaled")
        let tags = try XCTUnwrap(rotated["tags"] as? [Int])
        try exact(result["rootTag"], tags[0])
        for (index, row) in rows.enumerated() {
            try exact(row["rootTag"], tags[0])
            try exact(row["preset"], "rotated-scaled")
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
        let nativeTarget = try XCTUnwrap(down["target"] as? Int)
        XCTAssertTrue(nativeTarget == tags[1] || nativeTarget == tags[2], "Unrecognized original native receiver")
        if !atCorner { XCTAssertEqual(nativeTarget, tags[2], "Measured center must hit the original thumb") }
        let originalThumbHit = nativeTarget == tags[2]
        let actualDownX = try number(down, "pageX") + Double(pageOffset.x)
        let heldValue = originalThumbHit ? 0.5 : snap((actualDownX - Double(track.minX + inset)) / Double(span))
        let actualUpX = try number(up, "pageX") + Double(pageOffset.x)
        let expectedFinal = originalThumbHit
            ? snap(0.5 + (actualUpX - actualDownX) / Double(span))
            : snap((actualUpX - Double(track.minX + inset)) / Double(span))
        try exact(result["scalar"], expectedFinal)
        XCTAssertEqual(try number(down, "pageX") + Double(pageOffset.x), Double(start.x), accuracy: 1)
        XCTAssertEqual(try number(down, "pageY") + Double(pageOffset.y), Double(start.y), accuracy: 1)
        for row in moves + [up] {
            try exact(row["identifier"], try XCTUnwrap(down["identifier"]))
            try exact(row["target"], nativeTarget)
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
        if !originalThumbHit {
            try exact(requests.first?["value"], heldValue)
            XCTAssertLessThan(try number(try XCTUnwrap(requests.first), "sequence"),
                              try number(try XCTUnwrap(moves.first), "sequence"))
        }
        try exact(requests.last?["value"], expectedFinal)
        try exact(ends.first?["value"], expectedFinal)
        XCTAssertGreaterThan(try number(try XCTUnwrap(ends.first), "sequence"),
                             try number(try XCTUnwrap(requests.last), "sequence"))
        // Bounds remain an axis-aligned measurement; actual native delivery supplies the hit oracle.
        let after = try measure()
        try exact(after["tags"], tags)
        try exact(after["targetID"], try XCTUnwrap(rotated["targetID"]))
        sameFrame(try rect(after, "rootWindow"), rootWindow)
        let afterWindow = try XCTUnwrap(after["window"] as? [String: Any])
        sameFrame(try rect(afterWindow, "track"), track)
        for key in ["target", "paint"] {
            sameFrame(try rect(afterWindow, key),
                      try rect(current, key).offsetBy(dx: CGFloat(expectedFinal - 0.5) * span, dy: 0))
        }
        try exact(try state()["scalar"], expectedFinal)
        try exact(try state()["ends"], 1)
        try exact(try state()["requests"], try XCTUnwrap(result["requests"]))
        try mark("CODON_SLIDER_FINAL_OUTCOME", ["owner": result, "events": rows, "geometryAfter": after,
                 "nativeReceiver": originalThumbHit ? "original-thumb" : "original-track", "expectedHeldValue": heldValue,
                 "expectedFinal": expectedFinal, "probe": atCorner ? "aabb-corner" : "measured-center",
                 "scope": "iOS P01 rotated point probe; no measured quad or wholeG01 claim"])
    }

    func testP01RotatedCenterOriginalThumbHoldThenDrag() throws {
        try exerciseRotatedContact(atCorner: false)
    }

    func testP01RotatedCornerFollowsOriginalNativeHit() throws {
        try exerciseRotatedContact(atCorner: true)
    }
}
