import XCTest

// Add to the existing showcase UI-test target; main owns independent admission and actual SDK evidence.
final class ThumbnailShowcaseG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "aab0296e6e0a517d05bbbe6751cf5ddf3c1013f8503aedc847234828cebbe2de"

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        guard ProcessInfo.processInfo.environment["CODON_GALLERY_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the exact unchanged GalleryScene fixture")
            throw NSError(domain: "GalleryG02Admission", code: 1)
        }
        for key in ["CODON_GALLERY_PRODUCT_SHA256", "CODON_GALLERY_INPUT_MANIFEST_SHA256",
                    "CODON_GALLERY_SDK_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
        }
        // Main prelaunches the matched product and prepares a fresh default Gallery scene per method.
        // No replacement launch, caller-target warm-up, failed-action retry or failure-path reset.
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product")
            throw NSError(domain: "GalleryG02Admission", code: 2)
        }
        if app.state != .runningForeground { app.activate() }
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        let row = try owner()
        for (key, value) in ["mode": "all", "primary": "image", "slots": "4", "columns": "default"] {
            try exact(row[key], value)
        }
        try exact(row["items"], 5); try exact(row["width"], 280)
        try exact(row["overflow"], true); try exact(row["custom"], false); try exact(row["disabled"], false)
        try outcome(actions: 0)
        XCTAssertEqual(node("gallery-customization-state").label,
                       "Gallery customizations: none. Positioning: flow.")
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "gallery-g02-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "gallery-g02-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func count(_ id: String) -> Int {
        app.descendants(matching: .any).matching(identifier: id).count
    }
    private func item(_ name: String) -> XCUIElement {
        app.buttons.matching(identifier: "gallery-item-" + name).firstMatch
    }
    private var overflow: XCUIElement { app.buttons.matching(identifier: "gallery-overflow").firstMatch }
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
        XCTAssertTrue(target.exists && (target.isHittable || (allowDisabled && visible())),
                      "Original target is unreachable: " + target.debugDescription)
    }
    private func control(_ label: String) {
        let target = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap()
    }
    private func owner() throws -> [String: Any] {
        let target = node("gallery-state")
        XCTAssertTrue(target.exists, "Missing unchanged Gallery scene state")
        let raw = target.label
        func capture(_ pattern: String) throws -> String {
            let regex = try NSRegularExpression(pattern: pattern)
            let found = try XCTUnwrap(regex.firstMatch(in: raw, range: NSRange(location: 0, length: (raw as NSString).length)),
                                      "Missing existing state field: " + pattern + " in " + raw)
            return (raw as NSString).substring(with: found.range(at: 1))
        }
        func flag(_ label: String) throws -> Bool { try capture(label + ": (true|false)\\.") == "true" }
        func integer(_ label: String) throws -> Int { try XCTUnwrap(Int(try capture(label + ": ([0-9]+)\\."))) }
        return [
            "mode": try capture("Mode: (.*?)\\. Primary:"),
            "primary": try capture("Primary: (.*?)\\. Slots:"),
            "slots": try capture("Slots: (.*?)\\. Columns:"),
            "columns": try capture("Columns: (.*?)\\. Items:"),
            "items": try integer("Items"), "overflow": try flag("Overflow"), "width": try integer("Width"),
            "custom": try flag("Custom"), "disabled": try flag("Disabled"), "actions": try integer("Actions"),
            "overflowActions": try integer("Overflow actions"), "lifetime": try integer("Lifetime")
        ]
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let lhs = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let rhs = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: lhs, as: UTF8.self), String(decoding: rhs, as: UTF8.self))
    }
    private func outcome(actions: Int, overflowActions: Int = 0, lifetime: Int = 0) throws {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard let row = try? self.owner() else { return false }
            return row["actions"] as? Int == actions && row["overflowActions"] as? Int == overflowActions &&
                row["lifetime"] as? Int == lifetime
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed,
                       "Original caller contact did not produce the required owner outcome")
        let row = try owner()
        try exact(row["actions"], actions); try exact(row["overflowActions"], overflowActions)
        try exact(row["lifetime"], lifetime)
    }
    private func child(_ name: String, count: Int) {
        XCTAssertEqual(app.buttons.matching(identifier: "gallery-item-" + name).count, 1)
        XCTAssertEqual(item(name).label, "Gallery \(name), count \(count)")
    }
    private func tapItem(_ name: String, childCount: Int, actions: Int, overflowActions: Int = 0, lifetime: Int = 0) throws {
        let target = item(name)
        reveal(target); XCTAssertTrue(target.isEnabled); target.tap()
        try outcome(actions: actions, overflowActions: overflowActions, lifetime: lifetime)
        child(name, count: childCount)
    }
    private func record(_ stage: String) throws {
        let root = node("gallery-example").frame, window = app.windows.firstMatch.frame
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "gallery-item-"))
            .allElementsBoundByIndex.map { target -> [String: Any] in
                let frame = target.frame
                return ["id": target.identifier, "label": target.label, "enabled": target.isEnabled,
                        "frame": [frame.minX, frame.minY, frame.width, frame.height]]
            }
        let payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "owner": try owner(),
            "rawOwner": node("gallery-state").label, "rawNativeFrames": node("gallery-frames").label,
            "customization": node("gallery-customization-state").label, "callerTargets": rows,
            "slotNodes": count("thumbnail-showcase-secondary-slot"),
            "placeholderNodes": count("gallery-secondary-placeholder"),
            "overflowTargetCount": app.buttons.matching(identifier: "gallery-overflow").count,
            "rootFrame": [root.minX, root.minY, root.width, root.height],
            "windowFrame": [window.minX, window.minY, window.width, window.height],
            "capturedAt": Date().timeIntervalSince1970,
            "scope": "Actual XCTest observations and unchanged scene readbacks. Native view/ref/key continuity, original input and complete geometry/metadata require separate genuine SDK evidence. Last frame strings are historical, not a mounted-node census."
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }

    func testS02FirstCallerTouchActsOnceWithoutDuplicateTarget() throws {
        try tapItem("A", childCount: 1, actions: 1)
        child("B", count: 0); child("C", count: 0)
        try record("S02-first-original-caller-action")
    }
    func testS02CanonicalFiveItemsFourSlotsKeepsOverflowOne() throws {
        XCTAssertEqual(count("thumbnail-showcase-secondary-slot"), 4)
        for name in ["A", "B", "C"] { child(name, count: 0) }
        XCTAssertFalse(item("D").exists); XCTAssertFalse(item("E").exists)
        XCTAssertEqual(overflow.label, "Gallery overflow 1")
        reveal(overflow); overflow.tap()
        try outcome(actions: 0, overflowActions: 1)
        for name in ["A", "B", "C"] { child(name, count: 0) }
        try record("S02-canonical-overflow-count-one-action")
    }
    func testS01OmittedOverflowRendererKeepsTheFourthItem() throws {
        control("Toggle gallery overflow")
        XCTAssertFalse(overflow.exists); XCTAssertEqual(count("thumbnail-showcase-secondary-slot"), 4)
        child("D", count: 0); XCTAssertFalse(item("E").exists)
        try outcome(actions: 0)
        try tapItem("D", childCount: 1, actions: 1)
        try record("S01-no-invented-overflow-control")
    }
    func testS01OneItemKeepsTheThreeExactPlaceholderIndexes() throws {
        control("Toggle gallery five items")
        try exact(try owner()["items"], 1)
        XCTAssertEqual(count("gallery-secondary-placeholder"), 3)
        XCTAssertFalse(overflow.exists)
        for index in 1...3 { XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label == %@", "·\(index)")).firstMatch.exists) }
        try tapItem("A", childCount: 1, actions: 1)
        try record("S01-one-item-three-original-placeholder-indexes")
    }
    func testS01EmptyItemsWithPrimaryMediaKeepFourPlaceholders() throws {
        control("Toggle empty gallery items")
        try exact(try owner()["items"], 0)
        XCTAssertEqual(count("thumbnail-showcase-secondary-slot"), 4)
        XCTAssertEqual(count("gallery-secondary-placeholder"), 4)
        XCTAssertFalse(item("A").exists); XCTAssertFalse(overflow.exists)
        try outcome(actions: 0)
        try record("S01-primary-media-with-four-empty-slots")
    }
    func testS01NullishPrimaryWithoutItemsOmitsTheSecondaryRow() throws {
        control("Toggle empty gallery items")
        for kind in ["undefined", "null"] {
            control("Next gallery primary")
            try exact(try owner()["primary"], kind)
            XCTAssertTrue(node("gallery-primary-placeholder").exists)
            XCTAssertFalse(node("thumbnail-showcase-grid").exists)
            XCTAssertEqual(count("gallery-secondary-placeholder"), 0)
            try outcome(actions: 0)
            try record("S01-no-media-" + kind)
        }
    }
    func testS01FalsyPrimaryValuesStayAvailableMedia() throws {
        control("Toggle empty gallery items")
        control("Next gallery primary"); control("Next gallery primary")
        for kind in ["zero", "false", "empty"] {
            control("Next gallery primary")
            try exact(try owner()["primary"], kind)
            XCTAssertFalse(node("gallery-primary-placeholder").exists)
            XCTAssertEqual(count("gallery-secondary-placeholder"), 4)
            if kind == "zero" {
                XCTAssertTrue(node("thumbnail-showcase-primary").staticTexts.matching(NSPredicate(format: "label == %@", "0")).firstMatch.exists)
            }
            try outcome(actions: 0)
            try record("S01-authored-falsy-" + kind)
        }
    }
    func testS01ModesMountOnlyTheirRequestedContent() throws {
        try tapItem("A", childCount: 1, actions: 1)
        control("Next gallery mode")
        try exact(try owner()["mode"], "primary")
        XCTAssertTrue(node("thumbnail-showcase-primary").exists); XCTAssertFalse(node("thumbnail-showcase-grid").exists)
        XCTAssertFalse(item("A").exists); try outcome(actions: 1)
        control("Next gallery mode")
        try exact(try owner()["mode"], "secondary")
        XCTAssertFalse(node("thumbnail-showcase-primary").exists); child("A", count: 0)
        try tapItem("A", childCount: 1, actions: 2)
        control("Next gallery mode")
        try exact(try owner()["mode"], "all"); child("A", count: 1)
        try outcome(actions: 2)
        try record("S01-conditional-mode-lifetimes")
    }
    func testS01SlotCountNormalizationKeepsRawCallerValues() throws {
        for (raw, slots, hidden) in [("2", 2, 3), ("0", 0, 0), ("2.9", 2, 3), ("NaN", 4, 1), ("Infinity", 4, 1)] {
            control("Next gallery slot count")
            try exact(try owner()["slots"], raw)
            XCTAssertEqual(count("thumbnail-showcase-secondary-slot"), slots)
            if slots == 0 { XCTAssertFalse(node("thumbnail-showcase-grid").exists); XCTAssertFalse(overflow.exists) }
            else { XCTAssertEqual(overflow.label, "Gallery overflow \(hidden)") }
            try outcome(actions: 0)
            try record("S01-slot-normalization-" + raw)
        }
    }
    func testS01ReorderingNumberZeroAndEmptyKeysKeepsChildState() throws {
        try tapItem("A", childCount: 1, actions: 1)
        try tapItem("B", childCount: 1, actions: 2)
        control("Reorder gallery items")
        child("A", count: 1); child("B", count: 1); try outcome(actions: 2)
        try tapItem("A", childCount: 2, actions: 3)
        child("B", count: 1)
        try record("S01-original-zero-and-empty-key-children")
    }
    func testS01IndependentColumnCountsKeepTheFlatKeyedLifetime() throws {
        try tapItem("A", childCount: 1, actions: 1)
        for columns in ["2", "3", "6", "default"] {
            control("Next gallery column count")
            try exact(try owner()["columns"], columns)
            child("A", count: 1); try outcome(actions: 1)
            try record("S01-column-" + columns)
        }
        try tapItem("A", childCount: 2, actions: 2)
    }
    func testS02CallerDisabledGuardsAndFirstReenabledActions() throws {
        control("Toggle gallery actions disabled")
        for target in [item("A"), overflow] {
            reveal(target, allowDisabled: true); XCTAssertFalse(target.isEnabled)
            target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        try outcome(actions: 0)
        try record("S02-caller-guards-no-wrapper-action")
        control("Toggle gallery actions disabled")
        try tapItem("A", childCount: 1, actions: 1)
        reveal(overflow); overflow.tap(); try outcome(actions: 1, overflowActions: 1)
        try record("S02-distinct-reenabled-caller-actions")
    }
    func testS01IndependentStyleOwnersPreserveTheCallerChild() throws {
        try tapItem("A", childCount: 1, actions: 1)
        for label in ["Toggle gallery root styles", "Toggle gallery primary slot styles",
                      "Toggle gallery row styles", "Toggle gallery secondary slot styles"] {
            control(label); child("A", count: 1); try outcome(actions: 1)
        }
        try tapItem("A", childCount: 2, actions: 2)
        try record("S01-four-style-owners-retain-child-lifetime")
    }
    func testS12ThemeAndFixtureChangesRetainCallerStateAndReachability() throws {
        try tapItem("A", childCount: 1, actions: 1)
        control("Dark theme"); control("Compact width")
        child("A", count: 1); try outcome(actions: 1)
        try tapItem("A", childCount: 2, actions: 2)
        try record("S12-theme-and-compact-fixture")
    }
    func testS01PositionChangesKeepTheOriginalKeyedCallerReachable() throws {
        try tapItem("A", childCount: 1, actions: 1)
        for position in ["relative", "absolute", "flow"] {
            control("Next gallery positioning")
            XCTAssertTrue(node("gallery-customization-state").label.hasSuffix("Positioning: \(position)."))
            child("A", count: 1); try outcome(actions: 1)
            try record("S01-position-" + position)
        }
        try tapItem("A", childCount: 2, actions: 2)
    }
    func testS06ExplicitOwnerRestartBeginsOnlyTheRequestedChildLifetime() throws {
        try tapItem("A", childCount: 1, actions: 1)
        control("Restart gallery content")
        try outcome(actions: 1, lifetime: 1); child("A", count: 0)
        try tapItem("A", childCount: 1, actions: 2, lifetime: 1)
        try record("S06-deliberate-owner-lifetime-restart")
    }
}
