import XCTest

// Source for the existing showcase UI-test target. Only the coordinator compiles/runs it.
// Identity environment variables are admission data, never input-delivery evidence.
final class TypeaheadG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "8562a82eb666f9598ffb8b74f1d1bb72f5ff3b43a3b5f7a9fd354a7207277c99"
    private let phrase = " Native query text "

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        guard ProcessInfo.processInfo.environment["CODON_TH_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the exact Typeahead scene product before execution")
            throw NSError(domain: "TypeaheadG02Admission", code: 1)
        }
        for key in ["CODON_TH_PRODUCT_SHA256", "CODON_TH_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key])
            guard value.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else {
                XCTFail("Invalid admission identity " + key)
                throw NSError(domain: "TypeaheadG02Admission", code: 2)
            }
        }
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product; no replacement launch")
            throw NSError(domain: "TypeaheadG02Admission", code: 3)
        }
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
        tap("Reset scene")
        tap("Inline search scene")
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        try exact(try owner()["query"], "")
        try exact(try owner()["callbacks"], [])
        try exact(try owner()["selectionDefined"], false)
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "typeahead-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "typeahead-final-native-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        // Failure state stays intact. No failure-path reset, blur, retry or second activation.
    }

    private var field: XCUIElement { app.textFields.matching(identifier: "typeahead-search-input").firstMatch }
    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    private func row(_ prefix: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: "typeahead-search-item")
            .matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
    }
    private func reveal(_ target: XCUIElement) {
        for _ in 0..<10 {
            if target.exists && target.isHittable { return }
            guard let scroll = app.scrollViews.allElementsBoundByIndex.first(where: { $0.isHittable }) else { break }
            if target.exists && target.frame.minY < scroll.frame.minY { scroll.swipeDown() }
            else { scroll.swipeUp() }
        }
        XCTAssertTrue(target.exists && target.isHittable, "Unreachable original target: " + target.debugDescription)
    }
    private func tap(_ label: String) {
        let target = button(label)
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing " + label)
        reveal(target); target.tap()
    }
    private func activateRow(_ prefix: String) {
        let target = row(prefix)
        XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap()
    }
    private func owner() throws -> [String: Any] {
        let target = node("inline-search-owner-json")
        XCTAssertTrue(target.waitForExistence(timeout: 10))
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(target.label.utf8)) as? [String: Any])
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let left = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let right = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: left, as: UTF8.self), String(decoding: right, as: UTF8.self))
    }
    private func waitUntil(_ message: String, timeout: TimeInterval = 10, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: timeout), .completed, message)
    }
    private func callback(_ type: String, _ value: Any) -> [String: Any] { ["type": type, "value": value] }
    private func refEvents() throws -> [[String: Any]] { try XCTUnwrap(try owner()["refEvents"] as? [[String: Any]]) }
    private func focusInput() {
        reveal(field); field.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    }
    private func typeFirstPhrase() throws {
        focusInput()
        field.typeText(phrase) // One unpaced call; no sleeps, pretyping delay, blur or warm replacement.
        XCTAssertEqual(field.value as? String, phrase)
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        let state = try owner()
        try exact(state["query"], phrase)
        try exact(state["request"], phrase)
        try exact(state["nativeText"], phrase)
        try exact(state["requests"], try XCTUnwrap(state["nativeChanges"]))
        let originalTarget = try XCTUnwrap(state["nativeTarget"] as? Int)
        XCTAssertGreaterThan(originalTarget, 0)
        try exact(state["refTarget"], originalTarget)
        XCTAssertGreaterThan(try XCTUnwrap(state["requests"] as? Int), 0)
        try exact(state["submits"], 0)
        try record("S03-first-focused-unpaced-verdict")
    }
    private func record(_ stage: String) throws {
        let window = app.windows.firstMatch.frame
        let state = try owner()
        let payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "capturedAt": Date().timeIntervalSince1970,
            "owner": state, "keyboardActive": app.keyboards.firstMatch.exists,
            "fieldValue": field.exists ? field.value as? String ?? "" : "absent",
            "window": [window.minX, window.minY, window.width, window.height],
            "scope": "Actual XCTest outcomes; JS ref tokens require separate original SDK target/lifetime receipts"
        ]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func afterReplacementDeadline() {
        let deadline = expectation(description: "Original 3000ms fixture job deadline has elapsed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.25) { deadline.fulfill() }
        wait(for: [deadline], timeout: 4)
    }

    func testS01ControlledVetoAndDelayedEcho() throws {
        tap("Toggle inline search veto")
        focusInput(); field.typeText("x")
        try exact(try owner()["request"], "x")
        try exact(try owner()["query"], "")
        XCTAssertEqual(field.value as? String, "")
        field.typeText("y")
        try exact(try owner()["query"], "")
        try exact(try owner()["callbacks"], [callback("input", "x"), callback("input", "y")])
        let refs = try refEvents()
        tap("Echo latest inline search request")
        XCTAssertEqual(field.value as? String, "y")
        try exact(try owner()["query"], "y")
        try exact(try owner()["requests"], 2)
        try exact(try refEvents(), refs)
        tap("Set inline search owner whitespace")
        XCTAssertEqual(field.value as? String, "  owner  ")
        try exact(try owner()["requests"], 2)
        tap("Search")
        try exact(try owner()["submitted"], "owner")
        try exact(try owner()["submits"], 1)
        try record("S01-veto-delayed-echo")
    }

    func testS01TypedSelectionAndNull() throws {
        try exact(try owner()["requestDefined"], false)
        activateRow("Alpha wave"); activateRow("Alpha wave")
        activateRow("Beta drift"); activateRow("Empty-key current")
        try exact(try owner()["callbacks"], [callback("selection", 0), callback("selection", NSNull()),
                                             callback("selection", "0"), callback("selection", "")])
        try exact(try owner()["selection"], "")
        try exact(try owner()["selectionDefined"], true)
        try exact(try owner()["selections"], 4)
        try exact(try owner()["query"], "")
        try exact(try owner()["requests"], 0)
        try record("S01-typed-keys-null-toggle")
    }

    func testS02DisabledQueryKeepsIndependentResultsActive() throws {
        tap("Set inline search owner whitespace")
        tap("Toggle inline search disabled")
        XCTAssertFalse(field.isEnabled)
        XCTAssertFalse(button("Search").isEnabled)
        activateRow("Alpha wave")
        try exact(try owner()["callbacks"], [callback("selection", 0)])
        try exact(try owner()["requests"], 0)
        try exact(try owner()["submits"], 0)
        tap("Toggle inline search disabled"); tap("Search")
        try exact(try owner()["callbacks"], [callback("selection", 0), callback("submit", "owner")])
        try record("S02-disabled-query-independent-results")
    }

    func testS02CancelledOriginalRowPress() throws {
        let target = row("Alpha wave"); reveal(target)
        let window = app.windows.firstMatch
        let location = CGPoint(x: window.frame.maxX - 2, y: window.frame.minY + 2)
        XCTAssertFalse(target.frame.contains(location))
        let destination = window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: location.x - window.frame.minX, dy: location.y - window.frame.minY))
        target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.1, thenDragTo: destination)
        try exact(try owner()["callbacks"], [])
        try exact(try owner()["selectionDefined"], false)
        try record("S02-cancelled-original-press")
    }

    func testS03FirstFocusedUnpacedInputAndSearch() throws {
        let refs = try refEvents()
        try typeFirstPhrase()
        let target = button("Search"); reveal(target)
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        XCTAssertEqual(field.value as? String, phrase)
        try record("S03-before-first-Search")
        target.tap() // Exactly one keyboard-active action. No finish-editing substitute.
        try exact(try owner()["submitted"], "Native query text")
        try exact(try owner()["submits"], 1)
        try exact(try owner()["query"], phrase)
        try exact(try refEvents(), refs)
        try record("S03-first-Search")
    }

    func testS03SoftSubmitObserverPrecedesBusinessCallback() throws {
        try typeFirstPhrase()
        let keys = app.keyboards.buttons.matching(NSPredicate(format: "label IN %@", ["Search", "search"]))
        let targets = keys.allElementsBoundByIndex.filter { $0.isHittable }
        XCTAssertEqual(targets.count, 1, "Use the actual original soft Search key")
        targets[0].tap()
        let callbacks = try XCTUnwrap(try owner()["callbacks"] as? [[String: Any]])
        try exact(Array(callbacks.suffix(2)), [callback("native-submit", phrase), callback("submit", "Native query text")])
        try exact(try owner()["submits"], 1)
        try exact(try owner()["nativeSubmit"], phrase)
        try record("S03-original-soft-submit-order")
    }

    func testS04AsyncReplacementReorderRemovalAndReinsertion() throws {
        tap("Set inline search owner whitespace"); activateRow("Alpha wave")
        let before = try owner(), refs = try refEvents()
        tap("Queue inline search replacement")
        waitUntil("Original 3000ms replacement did not complete", timeout: 4) {
            (try? self.owner()["refreshed"] as? Bool) == true
        }
        XCTAssertTrue(row("Alpha wave refreshed").exists)
        try exact(try owner()["callbacks"], try XCTUnwrap(before["callbacks"]))
        try exact(try refEvents(), refs)
        XCTAssertEqual(field.value as? String, "  owner  ")
        tap("Reverse inline search items")
        try exact(try owner()["itemKeys"], ["", "0", 0] as [Any])
        tap("Toggle inline search first item")
        XCTAssertFalse(row("Alpha wave refreshed").exists)
        tap("Toggle inline search first item")
        try exact(try owner()["selection"], 0)
        try exact(try owner()["callbacks"], try XCTUnwrap(before["callbacks"]))
        activateRow("Alpha wave refreshed")
        try exact(try owner()["selection"], NSNull())
        try exact(try owner()["selections"], 2)
        try record("S04-replaced-reordered-reinserted")
    }

    func testS04EveryStatusRetainsEditorAndResetsOnlyResultsLifetime() throws {
        tap("Set inline search owner whitespace"); activateRow("Alpha wave")
        let refs = try refEvents()
        for status in ["idle", "minimum-query", "loading", "error", "empty", "results"] {
            tap("Next inline search status")
            try exact(try owner()["status"], status)
            XCTAssertEqual(field.value as? String, "  owner  ")
            try exact(try refEvents(), refs)
            try exact(try owner()["selections"], 1)
            XCTAssertEqual(row("Alpha wave").exists, status == "results")
            tap("Search") // Status/minimum length is guidance, never a submit guard.
        }
        try exact(try owner()["submits"], 6)
        try exact(try owner()["requests"], 0)
        activateRow("Alpha wave")
        try exact(try owner()["selection"], 0)
        try exact(try owner()["selections"], 2)
        for _ in 0..<2 { tap("Next inline search threshold") }
        tap("Search")
        try exact(try owner()["submits"], 7)
        try record("S04-six-statuses-no-fabricated-selection")
    }

    func testS05OriginalEditorAndResultKeyboardOwners() throws {
        tap("Set inline search owner whitespace")
        focusInput()
        app.typeKey(.return, modifierFlags: [])
        try exact(try owner()["submitted"], "owner")
        try exact(try owner()["submits"], 1)
        activateRow("Alpha wave")
        app.typeKey(.return, modifierFlags: [])
        try exact(try owner()["selection"], NSNull())
        app.typeKey(.downArrow, modifierFlags: [])
        app.typeKey(" ", modifierFlags: [])
        try exact(try owner()["selection"], "0")
        app.typeKey(.escape, modifierFlags: [])
        try exact(try owner()["selection"], NSNull())
        try exact(try owner()["selections"], 4)
        try exact(try owner()["submits"], 1)
        try record("S05-original-editor-versus-results-keyboard")
    }

    func testS06CallerRefAndQueuedSurfaceTeardown() throws {
        tap("Set inline search owner whitespace"); activateRow("Alpha wave")
        let before = try owner(), initial = try refEvents()
        let first = try XCTUnwrap(initial.first?["id"])
        tap("Toggle inline search caller ref")
        try exact(try refEvents().last, ["id": first, "attached": false])
        XCTAssertEqual(field.value as? String, "  owner  ")
        tap("Toggle inline search caller ref")
        try exact(try refEvents().last, ["id": first, "attached": true])
        tap("Queue inline search replacement")
        tap("Toggle inline search surface")
        XCTAssertFalse(field.exists)
        afterReplacementDeadline()
        try exact(try owner()["hostEvents"], ["replacement-queued", "replacement-cancelled"])
        try exact(try owner()["refreshed"], false)
        try exact(try owner()["callbacks"], try XCTUnwrap(before["callbacks"]))
        tap("Toggle inline search surface")
        XCTAssertEqual(field.value as? String, "  owner  ")
        XCTAssertNotEqual(try refEvents().last?["id"] as? Int, first as? Int)
        activateRow("Alpha wave")
        try exact(try owner()["selection"], 0)
        try exact(try owner()["selections"], 2)
        try record("S06-ref-retirement-and-surface-replacement")
    }

    func testS06QueuedSceneResetDoesNotResurrectOwner() throws {
        tap("Queue inline search replacement")
        let reset = button("Reset scene"); reveal(reset)
        try exact(try owner()["replacementPending"], true)
        reset.tap()
        XCTAssertFalse(node("inline-search-owner-json").exists)
        afterReplacementDeadline()
        XCTAssertFalse(field.exists)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        tap("Inline search scene")
        try exact(try owner()["callbacks"], [])
        try exact(try owner()["hostEvents"], [])
        try exact(try owner()["refreshed"], false)
        try exact(try owner()["requests"], 0)
        try exact(try owner()["selectionDefined"], false)
        try record("S06-scene-reset-fresh-owner")
    }

    func testS05WholeCollectionTabEntryAndExit() throws {
        tap("Set inline search owner whitespace")
        activateRow("Beta drift")
        tap("Before inline search focus boundary")
        app.typeKey(.tab, modifierFlags: []) // Original input.
        app.typeKey(.tab, modifierFlags: []) // Original Search button.
        app.typeKey(.tab, modifierFlags: []) // Selected original result, not every row.
        app.typeKey(" ", modifierFlags: [])
        try exact(try owner()["selection"], NSNull())
        app.typeKey(.tab, modifierFlags: [])
        app.typeKey(.return, modifierFlags: [])
        try exact(try owner()["hostEvents"], ["before-boundary", "after-boundary"])
        try exact(try owner()["submits"], 0)
        tap("After inline search focus boundary")
        app.typeKey(.tab, modifierFlags: .shift)
        app.typeKey(" ", modifierFlags: [])
        try exact(try owner()["selection"], "") // Backward entry has no selected key, so last row.
        app.typeKey(.tab, modifierFlags: .shift)
        app.typeKey(.return, modifierFlags: []) // Single backward exit to Search.
        try exact(try owner()["submitted"], "owner")
        try exact(try owner()["submits"], 1)
        try record("S05-whole-collection-Tab-boundary")
    }

    func testS05TwoHundredVariableHeightResultsTailAndHome() throws {
        tap("Toggle inline search 200 items")
        activateRow("Result 0 / ")
        app.typeKey(.end, modifierFlags: [])
        app.typeKey(" ", modifierFlags: [])
        try exact(try owner()["selection"], 199)
        let viewport = node("typeahead-search-results-container").frame.intersection(app.windows.firstMatch.frame)
        XCTAssertGreaterThan(viewport.height, 0)
        XCTAssertTrue(viewport.contains(row("Result 199 / ").frame), "The actual selected tail row must be fully viewable")
        app.typeKey(.home, modifierFlags: [])
        app.typeKey(" ", modifierFlags: [])
        try exact(try owner()["selection"], 0)
        try exact(try owner()["selections"], 3)
        try record("S05-200-variable-height-tail-and-home")
    }


    func testS01EmptyAndRepeatedSubmissionsDoNotInitializeOrMutateQuery() throws {
        let refs = try refEvents()
        tap("Search"); tap("Search")
        try exact(try owner()["callbacks"], [callback("submit", ""), callback("submit", "")])
        try exact(try owner()["submits"], 2)
        try exact(try owner()["requestDefined"], false)
        try exact(try owner()["selectionDefined"], false)
        tap("Set inline search owner whitespace"); tap("Clear inline search owner")
        XCTAssertEqual(field.value as? String, "")
        try exact(try owner()["requests"], 0)
        try exact(try owner()["callbacks"], [callback("submit", ""), callback("submit", "")])
        try exact(try refEvents(), refs)
        try record("S01-empty-repeat-programmatic-owner")
    }

}
