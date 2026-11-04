import XCTest

// Six iOS installed public-outcome witnesses. Android and exact Copy output remain separate
// observations in README; these uncompiled methods alone do not close the whole G02 cell.
final class PlaceholderG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private var ownerAtStart = 0

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        for key in ["CODON_PLACEHOLDER_FIXTURE_SHA256", "CODON_PLACEHOLDER_PRODUCT_SHA256",
                    "CODON_PLACEHOLDER_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        XCTAssertEqual(app.state, .runningForeground, "Prelaunch the exact admitted product and Text/Button scene")
        XCUIDevice.shared.orientation = .portrait
        waitUntil("Portrait setup did not settle") { XCUIDevice.shared.orientation == .portrait }
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        let window = app.windows.firstMatch.frame
        XCTAssertGreaterThan(window.height, window.width)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        XCTAssertTrue(node("placeholder-g02-state").waitForExistence(timeout: 10))
        tap("G02 prepare placeholder")
        ownerAtStart = try ownerCount()
        XCTAssertEqual(try rows().count, 0)
        XCTAssertGreaterThan(try int(state(), "rootTag"), 0)
        XCTAssertGreaterThan(try int(state(), "refIdentity"), 0)
    }

    override func tearDownWithError() throws {
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = "placeholder-g02-final-screen"
        screen.lifetime = .keepAlways
        add(screen)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "placeholder-g02-final-hierarchy"
        hierarchy.lifetime = .keepAlways
        add(hierarchy)
        try mark("placeholder-g02-final", state())
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func waitUntil(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }
    private func reveal(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 10))
        let scroll = app.scrollViews.firstMatch
        XCTAssertTrue(scroll.exists)
        for _ in 0..<16 {
            if scroll.frame.insetBy(dx: 2, dy: 12).contains(element.frame) { return }
            let startY: CGFloat = element.frame.minY < scroll.frame.minY ? 0.30 : 0.75
            let endY: CGFloat = startY < 0.5 ? 0.70 : 0.35
            scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: startY))
                .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: endY)))
        }
        XCTFail("Unreachable element " + element.identifier)
    }
    private func tap(_ label: String) {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        reveal(button)
        XCTAssertTrue(button.isHittable)
        button.tap()
    }
    private func state() throws -> [String: Any] {
        let result = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(node("placeholder-g02-state").label.utf8)) as? [String: Any])
        XCTAssertEqual(try int(result, "dropped"), 0)
        return result
    }
    private func int(_ value: [String: Any], _ key: String) throws -> Int {
        try XCTUnwrap(value[key] as? NSNumber, "Missing " + key).intValue
    }
    private func rows() throws -> [[String: Any]] {
        try XCTUnwrap(state()["receipts"] as? [[String: Any]])
    }
    private func ownerCount() throws -> Int {
        let label = node("library-state").label
        let prefix = try XCTUnwrap(label.range(of: "Library action count: "))
        return try XCTUnwrap(Int(label[prefix.upperBound...].prefix(while: { $0.isNumber })))
    }
    private func mark(_ name: String, _ values: [String: Any]) throws {
        var row = values
        row["epochSeconds"] = Date().timeIntervalSince1970
        let data = try JSONSerialization.data(withJSONObject: row, options: .sortedKeys)
        FileHandle.standardOutput.write(Data((name + " ").utf8) + data + Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    private func quiet(_ expected: Int) {
        let unexpected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (try? self.rows().count) != expected
        }, object: nil)
        unexpected.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [unexpected], timeout: 0.75), .completed)
    }
    private func press(_ duration: TimeInterval, expected: [String], callback: String = "original") throws {
        let target = node("library-placeholder")
        reveal(target)
        XCTAssertGreaterThan(target.frame.width, 0)
        XCTAssertGreaterThan(target.frame.height, 0)
        let before = try rows().count
        let rootTag = try int(state(), "rootTag")
        try mark("placeholder-g02-before-native-press", state())
        let origin = app.coordinate(withNormalizedOffset: .zero)
        origin.withOffset(CGVector(dx: target.frame.midX, dy: target.frame.midY)).press(forDuration: duration)
        waitUntil("Native trace incomplete") { (try? self.rows().count) == before + expected.count }
        quiet(before + expected.count)
        let actual = Array(try rows().dropFirst(before))
        XCTAssertEqual(actual.compactMap { $0["kind"] as? String }, expected)
        for row in actual {
            XCTAssertEqual(row["callback"] as? String, callback)
            XCTAssertEqual(row["afterDetach"] as? Bool, false)
            XCTAssertEqual(try int(row, "rootTag"), rootTag)
            let native = try XCTUnwrap(row["native"] as? [String: Any])
            XCTAssertEqual(try int(native, "target"), rootTag)
            XCTAssertGreaterThan(try int(row, "eventIdentity"), 0)
            XCTAssertGreaterThan(try int(row, "nativeIdentity"), 0)
        }
        XCTAssertEqual(try ownerCount(), try ownerAtStart + int(state(), "actions"))
        try mark("placeholder-g02-after-native-press", state())
    }

    func testS01FalsyDeferredOwnerContentAndOriginalRef() throws {
        let initial = try state()
        let expectedLabels = ["zero": "0", "empty": "", "false": "", "null": "", "restored": "Restored owner content"]
        for mode in ["zero", "empty", "false", "null", "restored"] {
            tap("G02 next placeholder content")
            XCTAssertEqual(try state()["contentMode"] as? String, mode)
            XCTAssertEqual(node("library-placeholder").label, expectedLabels[mode])
            XCTAssertEqual(try int(state(), "rootTag"), try int(initial, "rootTag"))
            XCTAssertEqual(try int(state(), "refIdentity"), try int(initial, "refIdentity"))
            XCTAssertEqual(try rows().count, 0)
        }
        tap("G02 deferred placeholder content")
        waitUntil("Deferred owner content absent") { (try? self.state()["contentMode"] as? String) == "deferred" }
        XCTAssertEqual(node("library-placeholder").label, "Deferred owner content")
        XCTAssertEqual(try int(state(), "rootTag"), try int(initial, "rootTag"))
        XCTAssertEqual(try rows().count, 0)
        XCTAssertEqual(try ownerCount(), ownerAtStart)
    }

    func testS02FirstActivationReplacementLongPressAndDisabledGuard() throws {
        try press(0.2, expected: ["pressIn", "pressOut", "press"])
        tap("G02 replacement placeholder callback")
        try press(0.2, expected: ["pressIn", "pressOut", "press"], callback: "replacement")
        tap("G02 toggle placeholder long press")
        try press(1.0, expected: ["pressIn", "longPress", "pressOut"], callback: "replacement")
        tap("G02 toggle placeholder disabled")
        try press(0.2, expected: [])
        tap("G02 toggle placeholder disabled")
        try press(0.2, expected: ["pressIn", "pressOut", "press"], callback: "replacement")
        tap("G02 absent placeholder callback")
        try press(0.2, expected: [])
    }

    func testS05LiveContextRetainsCallerAndOriginalRef() throws {
        try press(0.2, expected: ["pressIn", "pressOut", "press"])
        let initial = try state()
        for label in ["Toggle placeholder alignment", "Dark theme", "Compact width", "Light theme"] {
            tap(label)
            XCTAssertEqual(try int(state(), "rootTag"), try int(initial, "rootTag"))
            XCTAssertEqual(try int(state(), "refIdentity"), try int(initial, "refIdentity"))
            XCTAssertEqual(try int(state(), "actions"), 1)
            XCTAssertEqual(try rows().count, 3)
            XCTAssertEqual(node("library-placeholder").label, "Choose an item")
        }
        XCTAssertEqual(try ownerCount(), ownerAtStart + 1)
    }

    func testS03NativeCopyAffordanceForDefaultFalseTrueAndLabelIntent() throws {
        // Isolate native copy/selection from app activation; S02 independently observes real press delivery.
        tap("G02 absent placeholder callback")
        let initial = try state()
        let copy = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Copy")).firstMatch
        let observe = { (enabled: Bool, name: String) throws in
            let target = self.node("library-placeholder")
            self.reveal(target)
            XCTAssertEqual(target.label, "Choose an item")
            XCTAssertEqual(try self.int(self.state(), "rootTag"), try self.int(initial, "rootTag"))
            XCTAssertEqual(try self.int(self.state(), "refIdentity"), try self.int(initial, "refIdentity"))
            try self.mark("placeholder-g02-before-native-selection-" + name, self.state())
            self.app.coordinate(withNormalizedOffset: .zero)
                .withOffset(CGVector(dx: target.frame.midX, dy: target.frame.midY)).press(forDuration: 1.0)
            if enabled {
                XCTAssertTrue(copy.waitForExistence(timeout: 5), "Native selectable Text must offer Copy")
                XCTAssertTrue(copy.isHittable)
            } else {
                let unexpected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in copy.exists }, object: nil)
                unexpected.isInverted = true
                XCTAssertEqual(XCTWaiter.wait(for: [unexpected], timeout: 1), .completed, "Unselectable Text offered Copy")
            }
            let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            screen.name = "placeholder-g02-native-copy-" + name
            screen.lifetime = .keepAlways
            self.add(screen)
            let hierarchy = XCTAttachment(string: self.app.debugDescription)
            hierarchy.name = "placeholder-g02-native-copy-hierarchy-" + name
            hierarchy.lifetime = .keepAlways
            self.add(hierarchy)
            try self.mark("placeholder-g02-native-selection-" + name, self.state())
            if enabled { copy.tap() }
            XCTAssertEqual(try self.rows().count, 0)
            XCTAssertEqual(try self.ownerCount(), self.ownerAtStart)
        }
        tap("G02 default placeholder selection")
        try observe(true, "default-p")
        tap("G02 disable placeholder selection")
        try observe(false, "false-p")
        tap("G02 toggle placeholder label intent")
        tap("G02 default placeholder selection")
        try observe(false, "default-label")
        tap("G02 enable placeholder selection")
        try observe(true, "true-label")
        // Root may read this last real Copy through standard device-scoped simctl pbpaste;
        // this method does not fabricate a selection callback or read the host clipboard.
    }

    func testS02InterruptedPressAndDisabledTakeover() throws {
        let target = node("library-placeholder")
        reveal(target)
        let scroll = app.scrollViews.firstMatch.frame.insetBy(dx: 2, dy: 12)
        let frame = target.frame
        let endY = frame.minY - scroll.minY > 80 ? frame.minY - 80 : frame.maxY + 80
        XCTAssertTrue(scroll.contains(CGPoint(x: frame.midX, y: endY)))
        XCTAssertFalse(frame.insetBy(dx: -30, dy: -30).contains(CGPoint(x: frame.midX, y: endY)))
        try mark("placeholder-g02-before-cancelled-press", state())
        let origin = app.coordinate(withNormalizedOffset: .zero)
        origin.withOffset(CGVector(dx: frame.midX, dy: frame.midY))
            .press(forDuration: 0.2, thenDragTo: origin.withOffset(CGVector(dx: frame.midX, dy: endY)))
        waitUntil("Cancelled press must leave the active phase") { (try? self.rows().count) == 2 }
        quiet(2)
        XCTAssertEqual(try rows().compactMap { $0["kind"] as? String }, ["pressIn", "pressOut"])
        XCTAssertEqual(try int(state(), "actions"), 0)
        XCTAssertEqual(try ownerCount(), ownerAtStart)
        tap("G02 prepare placeholder")
        tap("G02 placeholder disable on press in")
        reveal(target)
        origin.withOffset(CGVector(dx: target.frame.midX, dy: target.frame.midY)).press(forDuration: 1.0)
        let trace = try rows()
        XCTAssertEqual(try state()["disabled"] as? Bool, true)
        XCTAssertEqual(trace.first?["kind"] as? String, "pressIn")
        XCTAssertEqual(trace.filter { $0["kind"] as? String == "pressIn" }.count, 1)
        XCTAssertTrue(trace.allSatisfy { ["pressIn", "pressOut"].contains($0["kind"] as? String ?? "") })
        XCTAssertLessThanOrEqual(trace.filter { $0["kind"] as? String == "pressOut" }.count, 1)
        XCTAssertEqual(try int(state(), "actions"), 0)
        XCTAssertEqual(try int(state(), "longActions"), 0)
        quiet(trace.count)
        XCTAssertEqual(try ownerCount(), ownerAtStart)
        try mark("placeholder-g02-after-disabled-takeover", state())
    }

    func testS06RemovalReinsertionAndHeldRetirement() throws {
        let initial = try state()
        tap("G02 remove placeholder")
        XCTAssertFalse(node("library-placeholder").exists)
        XCTAssertTrue(try state()["rootTag"] is NSNull)
        XCTAssertTrue(try state()["refIdentity"] is NSNull)
        XCTAssertEqual(try int(state(), "detaches"), try int(initial, "detaches") + 1)
        tap("G02 reinsert placeholder")
        XCTAssertTrue(node("library-placeholder").exists)
        XCTAssertGreaterThan(try int(state(), "rootTag"), 0)
        XCTAssertNotEqual(try int(state(), "refIdentity"), try int(initial, "refIdentity"))
        XCTAssertEqual(try rows().count, 0)
        tap("G02 placeholder remove on press in")
        let target = node("library-placeholder")
        reveal(target)
        try mark("placeholder-g02-before-held-removal", state())
        app.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: target.frame.midX, dy: target.frame.midY)).press(forDuration: 1.0)
        XCTAssertFalse(node("library-placeholder").exists)
        let trace = try rows()
        XCTAssertEqual(trace.first?["kind"] as? String, "pressIn")
        XCTAssertEqual(trace.filter { $0["kind"] as? String == "pressIn" }.count, 1)
        XCTAssertTrue(trace.allSatisfy { ["pressIn", "pressOut"].contains($0["kind"] as? String ?? "") })
        XCTAssertLessThanOrEqual(trace.filter { $0["kind"] as? String == "pressOut" }.count, 1)
        XCTAssertEqual(try int(state(), "actions"), 0)
        XCTAssertEqual(try int(state(), "longActions"), 0)
        quiet(trace.count)
        XCTAssertEqual(try ownerCount(), ownerAtStart)
        try mark("placeholder-g02-after-held-removal", state())
    }
}
