import XCTest

// Add this source to the existing CodonNativeComponents UI-test target.
// The coordinator prelaunches the matched Release app directly in the Sort/filter scene.
final class SortFilterG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "2183dcde6be0e96b4bb1a3bf0960727560d0801b519a15a8ffa428fb86d9967d"
    private let phrase = " first query "
    private let emptyQuery: [String: Any] = ["sortInstructions": [], "filterGroups": []]

    private let confirmedQuery: [String: Any] = [
        "sortInstructions": [
            ["id": "count", "criteriaID": "count", "criteriaName": "Count", "queryKey": "events.count", "sortDirection": "Descending"],
            ["id": "name", "criteriaID": "name", "criteriaName": "Name", "queryKey": "events.name", "sortDirection": "Ascending"]
        ],
        "filterGroups": [
            ["id": "count-group", "criteriaID": "count", "criteriaName": "Count", "queryKey": "events.count", "dataType": "number", "joinOperator": "and", "clauses": [["id": "count-zero", "operationCode": "equal", "argument": 0]]],
            ["id": "active-group", "criteriaID": "active", "criteriaName": "Active", "queryKey": "events.active", "dataType": "boolean", "joinOperator": "and", "clauses": [["id": "active-false", "operationCode": "equal", "argument": false]]]
        ]
    ]
    private let textQuery: [String: Any] = [
        "sortInstructions": [],
        "filterGroups": [["id": "name-group", "criteriaID": "name", "criteriaName": "Name", "queryKey": "events.name", "dataType": "text", "joinOperator": "and", "clauses": [["id": "name-clause", "operationCode": "like", "argument": "held"]]]]
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        guard ProcessInfo.processInfo.environment["CODON_SFP_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the admitted c91ffb2e fixture before executing a method")
            throw NSError(domain: "SortFilterG02Admission", code: 1)
        }
        for key in ["CODON_SFP_PRODUCT_SHA256", "CODON_SFP_INPUT_RECEIPT_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            guard value.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else {
                XCTFail("Invalid admitted identity " + key)
                throw NSError(domain: "SortFilterG02Admission", code: 2)
            }
        }
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("The coordinator must prelaunch the frozen product; do not launch a replacement")
            throw NSError(domain: "SortFilterG02Admission", code: 3)
        }
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        XCTAssertTrue(button("Open query panel").waitForExistence(timeout: 10),
                      "The host must select the committed Sort/filter scene")
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "sort-filter-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "sort-filter-final-native-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        // No failure-path Close/reset: preserve the original focused or interrupted state.
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func waitUntil(_ message: String, timeout: TimeInterval = 10,
                           _ predicate: @escaping () -> Bool) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed, message)
    }

    private func reveal(_ target: XCUIElement) {
        for _ in 0..<10 {
            if target.exists && target.isHittable { return }
            let candidates = app.scrollViews.allElementsBoundByIndex.filter { $0.isHittable }
            guard let scroll = candidates.first else { break }
            if target.exists && target.frame.height > 0 && target.frame.minY < scroll.frame.minY {
                scroll.swipeDown()
            } else { scroll.swipeUp() }
        }
        XCTAssertTrue(target.exists && target.isHittable, "Unreachable native target: " + target.debugDescription)
    }

    private func tap(_ label: String) {
        let target = button(label)
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing button " + label)
        reveal(target)
        target.tap()
    }

    private func choice(_ label: String) {
        let query = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label))
        waitUntil("Missing visible choice " + label) {
            query.allElementsBoundByIndex.filter { $0.isHittable }.count == 1
        }
        let targets = query.allElementsBoundByIndex.filter { $0.isHittable }
        XCTAssertEqual(targets.count, 1, "Do not choose an ambiguous/covered receiver")
        targets[0].tap()
    }

    private func record(_ stage: String, owner: [String: Any]? = nil) throws {
        let window = app.windows.firstMatch.frame
        var payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "capturedAt": Date().timeIntervalSince1970,
            "keyboardActive": app.keyboards.firstMatch.exists,
            "window": [window.minX, window.minY, window.width, window.height],
            "appState": app.state.rawValue, "physicalDevice": false,
            "scope": "XCTest public outcomes; original SDK event/ref/window receipts remain separate"
        ]
        if let owner = owner { payload["owner"] = owner }
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }

    private func owner() throws -> [String: Any] {
        let receipt = node("query-panel-owner")
        XCTAssertTrue(receipt.waitForExistence(timeout: 10), "Original owner receipt unavailable")
        let row = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(receipt.label.utf8)) as? [String: Any])
        return row
    }

    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual, "Missing exact owner/callback value")
        let lhs = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let rhs = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: lhs, as: UTF8.self), String(decoding: rhs, as: UTF8.self))
    }

    private func callback(_ type: String, request: [String: Any]? = nil) -> [String: Any] {
        if let request = request { return ["type": type, "request": request] }
        return ["type": type, "next": false]
    }

    private func reset() throws {
        tap("Reset query scene")
        let state = try owner()
        try exact(state["confirmed"], emptyQuery)
        try exact(state["requests"], [])
        try exact(state["callbacks"], [])
        try exact(state["closeRequests"], 0)
        try exact(state["hostEvents"], [])
        try exact(state["open"], false)
    }

    private func open() {
        tap("Open query panel")
        XCTAssertTrue(button("Close Sort and Filter Panel").waitForExistence(timeout: 10))
    }

    private func closed() {
        waitUntil("Accepted close must dismiss the actual panel") {
            !self.button("Close Sort and Filter Panel").exists
        }
    }

    private func textEditor(_ label: String = "Filter Name by contained text") -> XCUIElement {
        app.textFields.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func replaceText(_ field: XCUIElement, with text: String) {
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        reveal(field); field.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        field.typeKey("a", modifierFlags: .command)
        field.typeText(text) // One unpaced native typing call, never per-character sleeps.
        XCTAssertEqual(field.value as? String, text)
        XCTAssertTrue(app.keyboards.firstMatch.exists)
    }

    private func firstKeyboardAction(_ label: String, field: XCUIElement, text: String) throws {
        let target = button(label)
        reveal(target)
        XCTAssertTrue(app.keyboards.firstMatch.exists, "Preserve the keyboard-active precondition")
        XCTAssertEqual(field.value as? String, text)
        try record("before-first-" + label)
        target.tap() // Exactly one activation; no finish-editing or second tap.
        closed()
        waitUntil("Accepted close must not reopen the keyboard") { !self.app.keyboards.firstMatch.exists }
    }

    private func afterOriginalDeadline() {
        let elapsed = expectation(description: "Original three-second owner job deadline elapsed")
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.25) { elapsed.fulfill() }
        wait(for: [elapsed], timeout: 4)
    }

    func testS01ValuesVetoAndEcho() throws {
        try reset()
        open()
        XCTAssertTrue(app.staticTexts["No sorting currently applied"].exists)
        XCTAssertTrue(app.staticTexts["No filters currently applied"].exists)
        tap("Close Sort and Filter Panel"); closed()
        try reset()
        tap("Load confirmed query")
        let baseline = try XCTUnwrap(try owner()["confirmed"])
        try exact(baseline, confirmedQuery)
        tap("Veto next two closes"); open()
        let zero = app.textFields.matching(identifier: "number-input-input").firstMatch
        XCTAssertTrue(zero.waitForExistence(timeout: 10))
        XCTAssertEqual(zero.value as? String, "0")
        tap("Clear All")
        for index in 0..<3 {
            tap("Apply")
            if index < 2 {
                XCTAssertTrue(button("Close Sort and Filter Panel").exists)
                XCTAssertTrue(app.staticTexts["No sorting currently applied"].exists)
            }
        }
        closed()
        let held = try owner()
        try exact(held["confirmed"], baseline)
        try exact(held["requests"], [emptyQuery, emptyQuery, emptyQuery])
        try exact(held["callbacks"], (0..<3).flatMap { _ in [callback("apply", request: emptyQuery), callback("open")] })
        try exact(held["closeRequests"], 3)
        try record("S01-held-after-three-requests", owner: held)
        tap("Toggle owner echo"); open(); tap("Clear All"); tap("Apply"); closed()
        let echoed = try owner()
        try exact(echoed["confirmed"], emptyQuery)
        try exact(echoed["requests"], [emptyQuery, emptyQuery, emptyQuery, emptyQuery])
        try exact(echoed["callbacks"], (0..<4).flatMap { _ in [callback("apply", request: emptyQuery), callback("open")] })
        try exact(echoed["closeRequests"], 4)
        try record("S01-echo", owner: echoed)
    }

    func testS02CloseCancelAndBooleanEditors() throws {
        try reset(); tap("Load confirmed query")
        let baseline = try XCTUnwrap(try owner()["confirmed"])
        try exact(baseline, confirmedQuery)
        tap("Veto next two closes"); open(); tap("Clear All")
        tap("Close Sort and Filter Panel")
        XCTAssertTrue(button("Close Sort and Filter Panel").exists)
        XCTAssertTrue(app.staticTexts["No sorting currently applied"].exists)
        tap("Cancel")
        waitUntil("Cancel must restore both original sort rows while the close veto retains the panel") {
            self.button("Close Sort and Filter Panel").exists &&
                self.node("query-sort-option-count").exists &&
                self.node("query-sort-option-name").exists
        }
        XCTAssertTrue(button("Close Sort and Filter Panel").exists)
        XCTAssertTrue(node("query-sort-option-count").exists)
        XCTAssertTrue(node("query-sort-option-name").exists)
        tap("Clear All"); tap("Apply"); closed()
        let state = try owner()
        try exact(state["confirmed"], baseline)
        try exact(state["requests"], [emptyQuery])
        try exact(state["callbacks"], [callback("open"), callback("open"), callback("apply", request: emptyQuery), callback("open")])
        try exact(state["closeRequests"], 3)
        try record("S02-cancel-restores-close-keeps-draft", owner: state)
        for toggle in [false, true] {
            try reset(); tap("Load confirmed query")
            let before = try XCTUnwrap(try owner()["confirmed"] as? [String: Any])
            try exact(before, confirmedQuery)
            if toggle { tap("Toggle Boolean editor") }
            open()
            let control = node(toggle ? "switch" : "checkbox")
            XCTAssertTrue(control.waitForExistence(timeout: 10)); reveal(control); control.tap()
            tap("Apply"); closed()
            var expected = before
            var groups = try XCTUnwrap(expected["filterGroups"] as? [[String: Any]])
            var clauses = try XCTUnwrap(groups[1]["clauses"] as? [[String: Any]])
            clauses[0]["argument"] = true; groups[1]["clauses"] = clauses; expected["filterGroups"] = groups
            let after = try owner()
            try exact(after["confirmed"], before)
            try exact(after["requests"], [expected])
            try exact(after["callbacks"], [callback("apply", request: expected), callback("open")])
            try record(toggle ? "S02-Toggle" : "S02-Checkbox", owner: after)
        }
    }

    func testS03FocusedUnpacedApply() throws {
        try reset(); tap("Load text argument")
        let baseline = try XCTUnwrap(try owner()["confirmed"] as? [String: Any])
        try exact(baseline, textQuery)
        open()
        let field = textEditor()
        replaceText(field, with: phrase)
        try record("S03-focused-native-before-Apply")
        try firstKeyboardAction("Apply", field: field, text: phrase)
        var expected = baseline
        var groups = try XCTUnwrap(expected["filterGroups"] as? [[String: Any]])
        var clauses = try XCTUnwrap(groups[0]["clauses"] as? [[String: Any]])
        clauses[0]["argument"] = "first query"; groups[0]["clauses"] = clauses; expected["filterGroups"] = groups
        let state = try owner()
        try exact(state["confirmed"], baseline)
        try exact(state["requests"], [expected])
        try exact(state["callbacks"], [callback("apply", request: expected), callback("open")])
        try exact(state["closeRequests"], 1)
        try record("S03-first-Apply", owner: state)
    }

    func testS04AsyncReplacementAndNativeReorder() throws {
        let raw = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_SFP_DRAG_POINT"],
                               "Coordinator must supply an observed original-row hit point, not authored coordinates")
        let point = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Double])
        let location = CGPoint(x: try XCTUnwrap(point["x"]), y: try XCTUnwrap(point["y"]))
        try reset(); tap("Load text argument"); tap("Refresh metadata after next open"); open()
        let field = textEditor()
        replaceText(field, with: phrase)
        let refreshed = textEditor("Filter Name refreshed by contained text")
        XCTAssertTrue(refreshed.waitForExistence(timeout: 4), "The original three-second job must occur")
        XCTAssertEqual(refreshed.value as? String, phrase)
        try firstKeyboardAction("Apply", field: refreshed, text: phrase)
        let metadata = try owner()
        let requests = try XCTUnwrap(metadata["requests"] as? [[String: Any]])
        let groups = try XCTUnwrap(requests.first?["filterGroups"] as? [[String: Any]])
        try exact(groups[0]["criteriaName"], "Name refreshed")
        try exact(groups[0]["queryKey"], "events.name")
        try exact((groups[0]["clauses"] as? [[String: Any]])?.first?["argument"], "first query")
        try exact(metadata["callbacks"], [callback("apply", request: requests[0]), callback("open")])
        try record("S04-metadata-current-draft", owner: metadata)
        try reset(); tap("Load confirmed query"); tap("Replace owner after next open"); open()
        let numeric = app.textFields.matching(identifier: "number-input-input").firstMatch
        replaceText(numeric, with: "42")
        waitUntil("Immutable owner replacement must rehydrate the native editor to7", timeout: 4) {
            numeric.value as? String == "7"
        }
        tap("Close Sort and Filter Panel"); closed()
        let replacement = try owner()
        try exact(replacement["requests"], [])
        try exact(replacement["callbacks"], [callback("open")])
        let confirmed = try XCTUnwrap(replacement["confirmed"] as? [String: Any])
        let replacedGroups = try XCTUnwrap(confirmed["filterGroups"] as? [[String: Any]])
        try exact((replacedGroups[0]["clauses"] as? [[String: Any]])?.first?["argument"], 7)
        try record("S04-immutable-owner", owner: replacement)
        try reset(); tap("Load confirmed query")
        let baseline = try XCTUnwrap(try owner()["confirmed"] as? [String: Any])
        open()
        let source = node("query-sort-option-count"), destination = node("query-sort-option-name")
        reveal(source); reveal(destination)
        XCTAssertTrue(source.frame.contains(location))
        let window = app.windows.firstMatch
        XCTAssertTrue(window.frame.contains(location))
        let start = window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: location.x - window.frame.minX, dy: location.y - window.frame.minY))
        let end = destination.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95))
        start.press(forDuration: 0.8, thenDragTo: end)
        waitUntil("Real native reorder must put Name before Count") { destination.frame.minY < source.frame.minY }
        tap("Apply"); closed()
        var expected = baseline
        let sorts = try XCTUnwrap(expected["sortInstructions"] as? [[String: Any]])
        expected["sortInstructions"] = [sorts[1], sorts[0]]
        let reordered = try owner()
        try exact(reordered["confirmed"], baseline)
        try exact(reordered["requests"], [expected])
        try exact(reordered["callbacks"], [callback("apply", request: expected), callback("open")])
        try record("S04-real-native-reorder", owner: reordered)
    }

    func testS05KeyboardFirstCloseAndNestedSelection() throws {
        for action in ["Close Sort and Filter Panel", "Cancel"] {
            try reset(); tap("Load text argument")
            let baseline = try XCTUnwrap(try owner()["confirmed"])
            try exact(baseline, textQuery)
            open()
            let field = textEditor()
            replaceText(field, with: phrase)
            try firstKeyboardAction(action, field: field, text: phrase)
            let state = try owner()
            try exact(state["requests"], [])
            try exact(state["callbacks"], [callback("open")])
            try exact(state["confirmed"], baseline)
            try record("S05-first-" + action, owner: state)
        }
        try reset(); open(); tap("Add Sort Criteria")
        XCTAssertTrue(button("Close sort criteria").waitForExistence(timeout: 10))
        XCTAssertFalse(button("Close Sort and Filter Panel").isHittable)
        choice("Name")
        waitUntil("Sort chooser must dismiss before parent resumes") { !self.button("Close sort criteria").exists }
        XCTAssertTrue(button("Close Sort and Filter Panel").isHittable)
        tap("Apply"); closed()
        let selected = try owner()
        let request = try XCTUnwrap((selected["requests"] as? [[String: Any]])?.first)
        let sorts = try XCTUnwrap(request["sortInstructions"] as? [[String: Any]])
        XCTAssertEqual(sorts.count, 1)
        try exact(sorts[0]["criteriaID"], "name")
        try exact(selected["callbacks"], [callback("apply", request: request), callback("open")])
        try record("S05-nested-sort-chooser", owner: selected)
        try reset(); tap("Load ComboBox argument")
        let baseline = try XCTUnwrap(try owner()["confirmed"] as? [String: Any])
        open(); tap("Show filter argument suggestions")
        let child = textEditor("Edit filter argument")
        replaceText(child, with: "B")
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        choice("Beta") // First actual selection, no finish-editing comparison or retry.
        waitUntil("Original child editor must retire") { !child.exists }
        tap("Apply"); closed()
        var expected = baseline
        var groups = try XCTUnwrap(expected["filterGroups"] as? [[String: Any]])
        var clauses = try XCTUnwrap(groups[0]["clauses"] as? [[String: Any]])
        clauses[0]["argument"] = "Beta"; groups[0]["clauses"] = clauses; expected["filterGroups"] = groups
        let combo = try owner()
        try exact(combo["confirmed"], baseline)
        try exact(combo["requests"], [expected])
        try exact(combo["callbacks"], [callback("apply", request: expected), callback("open")])
        try record("S05-embedded-ComboBox-Beta", owner: combo)
    }

    func testS06TeardownAndQueuedRetirement() throws {
        try reset(); tap("Load text argument")
        let baseline = try XCTUnwrap(try owner()["confirmed"])
        tap("Unmount panel after next open"); open()
        replaceText(textEditor(), with: phrase)
        closed()
        waitUntil("Teardown must leave the keyboard closed") { !self.app.keyboards.firstMatch.exists }
        let removed = try owner()
        try exact(removed["open"], true)
        try exact(removed["panelMounted"], false)
        try exact(removed["confirmed"], baseline)
        try exact(removed["requests"], [])
        try exact(removed["callbacks"], [])
        afterOriginalDeadline()
        let retired = try owner()
        try exact(retired["requests"], [])
        try exact(retired["callbacks"], [])
        XCTAssertEqual((retired["hostEvents"] as? [[String: Any]])?.count, 1)
        try record("S06-retired-panel", owner: retired)
        tap("Restore query panel")
        XCTAssertFalse(button("Close Sort and Filter Panel").exists)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        for action in ["Replace owner", "Refresh metadata", "Unmount panel"] {
            try reset(); tap(action + " after next open"); open()
            tap("Close Sort and Filter Panel"); closed()
            afterOriginalDeadline()
            open()
            afterOriginalDeadline()
            tap("Close Sort and Filter Panel"); closed()
            let state = try owner()
            try exact(state["hostEvents"], [])
            try exact(state["requests"], [])
            try exact(state["callbacks"], [callback("open"), callback("open")])
            try exact(state["panelMounted"], true)
            try record("S06-cancelled-" + action, owner: state)
        }
        try reset()
    }
}
