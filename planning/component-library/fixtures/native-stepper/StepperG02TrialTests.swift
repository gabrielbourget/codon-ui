import XCTest

// Source preparation only. Bind to the existing shared observer target and admitted current product.
// Public outcome assertions supplement independent original-native input, identity and retirement evidence.
final class StepperG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "a7917a4e0ea881fa4078806ba6a88c5b6769ba2754b876927cce66ba31cf4f44"

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        guard ProcessInfo.processInfo.environment["CODON_STEPPER_SCENE_SHA256"] == sceneSHA else {
            throw NSError(domain: "StepperG02Admission", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Bind the current shared Stepper fixture; the frozen CB-01 product is insufficient"])
        }
        for key in ["CODON_FIXTURE_PRODUCT_SHA256", "CODON_STEPPER_NATIVE_ADMISSION_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing admitted identity " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        XCTAssertTrue([.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state),
                      "Coordinator must prelaunch the bound product")
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        XCTAssertTrue(node("stepper-config").waitForExistence(timeout: 10), "Coordinator selects the current Stepper scene")
    }

    override func tearDownWithError() throws {
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = "stepper-final-screen"; screen.lifetime = .keepAlways; add(screen)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "stepper-final-native-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        // Preserve the first failure: no failure-path reset, dismissal or replacement launch.
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    private func editor() -> XCUIElement {
        app.textFields.matching(identifier: "stepper-example-input").firstMatch
    }
    private func waitUntil(_ message: String, timeout: TimeInterval = 10, _ predicate: @escaping () -> Bool) {
        let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed, message)
    }
    private func reveal(_ target: XCUIElement) {
        for _ in 0..<10 {
            if target.exists && target.isHittable { return }
            let scroll = node("showcase-scroll").scrollViews.firstMatch
            XCTAssertTrue(scroll.exists && scroll.isHittable)
            if target.exists && target.frame.height > 0 && target.frame.minY < scroll.frame.minY { scroll.swipeDown() }
            else { scroll.swipeUp() }
        }
        XCTAssertTrue(target.exists && target.isHittable, "Unreachable actual target " + target.debugDescription)
    }
    private func tap(_ label: String) {
        let target = button(label)
        XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap()
    }
    private func json(_ id: String) throws -> Any {
        let target = node(id)
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing receipt " + id)
        return try JSONSerialization.jsonObject(with: Data(target.label.utf8), options: .fragmentsAllowed)
    }
    private func callbacks() throws -> [[String: Any]] {
        try XCTUnwrap(try json("stepper-callbacks") as? [[String: Any]])
    }
    private func requestValues() throws -> [Any] {
        try callbacks().filter { $0["kind"] as? String == "request" }.map { try XCTUnwrap($0["data"]) }
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let a = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let b = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: a, as: UTF8.self), String(decoding: b, as: UTF8.self))
    }
    private func state(_ value: String, _ requests: Int) {
        let text = node("stepper-state").label
        XCTAssertTrue(text.contains("Value: " + value + ". Request: "), text)
        XCTAssertTrue(text.contains(". Requests: \(requests). Raw: "), text)
    }
    private func record(_ stage: String) throws {
        var row: [String: Any] = ["stage": stage, "sceneSHA256": sceneSHA,
            "capturedAt": Date().timeIntervalSince1970, "keyboardActive": app.keyboards.firstMatch.exists,
            "state": node("stepper-state").label,
            "scope": "Public XCTest outcomes; independent original-native witness remains mandatory"]
        for id in ["stepper-config", "stepper-refs", "stepper-callbacks", "stepper-form-result", "stepper-teardown"] {
            if node(id).exists { row[id] = try json(id) }
        }
        let window = app.windows.firstMatch.frame
        row["window"] = [window.minX, window.minY, window.width, window.height]
        if editor().exists {
            let frame = editor().frame
            row["nativeEditor"] = ["value": editor().value as? String ?? "", "hittable": editor().isHittable,
                                   "frame": [frame.minX, frame.minY, frame.width, frame.height]]
        }
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys, .prettyPrinted]),
                                       uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func reset() throws {
        tap("Reset scene"); tap("Stepper scene")
        XCTAssertTrue(editor().waitForExistence(timeout: 10))
        state("0", 0); try exact(requestValues(), [])
    }
    private func recordInputEvidence(_ intended: String, immediateValue: String?) {
        func emit(_ row: [String: Any]) {
            guard let data = try? JSONSerialization.data(withJSONObject: row, options: .sortedKeys),
                  let text = String(data: data, encoding: .utf8) else { return }
            FileHandle.standardOutput.write(Data(("CODON_STEPPER_INPUT " + text + "\n").utf8))
        }
        emit(["stage": "immediate-after-single-unpaced-input", "intended": intended,
              "xcuiValue": immediateValue as Any? ?? NSNull(), "matchesIntended": immediateValue == intended,
              "observerTime": Date().timeIntervalSince1970])
        for id in ["stepper-callbacks", "stepper-state", "stepper-refs", "stepper-config"] {
            emit(["stage": "post-input-existing-receipt", "id": id, "label": node(id).label,
                  "observerTime": Date().timeIntervalSince1970])
        }
    }
    private func prepareKeyboard(_ text: String?, action: XCUIElement) throws {
        // Reach the action before focus; scrolling after focus can dismiss the keyboard.
        reveal(action); reveal(editor()); editor().tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        if let text = text {
            editor().typeKey("a", modifierFlags: .command)
            editor().typeText(text) // One unpaced native input call; no per-character sleeps.
            let immediateValue = editor().value as? String
            recordInputEvidence(text, immediateValue: immediateValue)
            XCTAssertEqual(immediateValue, text)
            let rows = try callbacks()
            let native = try XCTUnwrap(rows.last { $0["kind"] as? String == "native:change" }?["data"] as? [String: Any])
            try exact(native["text"], text)
            try exact(rows.last { $0["kind"] as? String == "raw" }?["data"], text)
        }
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        XCTAssertTrue(action.isHittable, "First action must already be visible with keyboard active; do not scroll or finish editing")
    }
    private func firstRelease(_ increase: Bool, veto: Bool) throws {
        try reset(); if veto { tap("Toggle stepper owner veto") }
        let target = button(increase ? "Increase controlled quantity" : "Decrease controlled quantity")
        let originalRefs = try json("stepper-refs")
        try prepareKeyboard("0.3", action: target); state("0", 0)
        let rawBefore = try callbacks().filter { $0["kind"] as? String == "raw" }
        try record("S02-before-first-release")
        target.tap()
        let expected = increase ? 0.4 : 0.2
        waitUntil("Exactly one dirty-draft step") { (try? self.requestValues().count) == 1 }
        try exact(requestValues(), [expected]); state(veto ? "0" : increase ? "0.4" : "0.2", 1)
        XCTAssertEqual(editor().value as? String, veto ? "0" : increase ? "0.4" : "0.2")
        try exact(try json("stepper-refs"), originalRefs)
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        try record("S02-first-release-\(increase)-veto-\(veto)")
    }
    private func afterInterval() {
        let elapsed = expectation(description: "Post-action observation interval; native retirement witness is separate")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { elapsed.fulfill() }
        wait(for: [elapsed], timeout: 3)
    }
    private func held(_ veto: Bool, retirement: Int = 0) throws {
        try reset(); if veto { tap("Toggle stepper owner veto") }
        for _ in 0..<retirement { tap("Next stepper retirement on request") }
        let target = button("Increase controlled quantity")
        let originalRefs = try json("stepper-refs")
        try prepareKeyboard("0.3", action: target); state("0", 0)
        let rawBefore = try callbacks().filter { $0["kind"] as? String == "raw" }
        try record("S02-before-held-press")
        target.press(forDuration: 0.8)
        let values = try requestValues()
        if retirement > 0 {
            try exact(values, [0.4]); state("0.4", 1)
            if retirement == 3 { XCTAssertFalse(editor().exists) }
            else { XCTAssertFalse(target.isEnabled) }
        } else {
            XCTAssertGreaterThanOrEqual(values.count, 2)
            let expected: [Double] = (0..<values.count).map { index in
                if veto { return index == 0 ? 0.4 : 0.1 }
                return (Double(index + 4) / 10)
            }
            try exact(values, expected)
            XCTAssertEqual(Double(editor().value as? String ?? ""), veto ? 0 : expected.last)
        }
        afterInterval(); try exact(requestValues(), values)
        if retirement != 3 { try exact(try json("stepper-refs"), originalRefs) }
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        try record("S02-held-veto-\(veto)-retirement-\(retirement)")
    }
    private func key(_ name: String, _ key: XCUIKeyboardKey, expected: Double?, readOnly: Bool = false, shift: Bool = false) throws {
        try reset(); if readOnly { tap("Toggle stepper read-only") }
        let originalRefs = try json("stepper-refs")
        reveal(editor()); editor().tap()
        if !readOnly { editor().typeKey("a", modifierFlags: .command); editor().typeText("0.3") }
        let rawBefore = try callbacks().filter { $0["kind"] as? String == "raw" }
        try record("S03-before-" + name)
        editor().typeKey(key, modifierFlags: shift ? .shift : [])
        waitUntil("Original down/up observations must arrive once") {
            let receipt = self.node("stepper-callbacks")
            guard receipt.exists,
                  let rows = try? JSONSerialization.jsonObject(with: Data(receipt.label.utf8)) as? [[String: Any]] else { return false }
            return rows.filter { ($0["data"] as? [String: Any])?["key"] as? String == name }.count == 4
        }
        let observed = try callbacks().filter { ($0["data"] as? [String: Any])?["key"] as? String == name }
        try exact(observed.map { $0["kind"]! }, ["root:key:down", "input:key:down", "root:key:up", "input:key:up"])
        for offset in [0, 2] {
            let root = try XCTUnwrap(observed[offset]["data"] as? [String: Any])
            let input = try XCTUnwrap(observed[offset + 1]["data"] as? [String: Any])
            try exact(root["identity"], input["identity"]); try exact(root["eventId"], input["eventId"])
            for row in [root, input] {
                try exact(row["targetIsEditor"], true); try exact(row["currentTargetIsEditor"], true)
                try exact(row["shiftKey"], shift)
                try exact(row["repeat"], false); try exact(row["cancelled"], false); try exact(row["isComposing"], false)
            }
        }
        if let expected = expected {
            waitUntil("One correlated numeric down action") { (try? self.requestValues().count) == 1 }
            try exact(requestValues(), [expected])
            XCTAssertEqual(Double(editor().value as? String ?? ""), expected)
            let data = try XCTUnwrap(observed[0]["data"] as? [String: Any]); try exact(data["nativeDefaultHandled"], true)
        } else { try exact(requestValues(), []); state("0", 0) }
        try exact(try json("stepper-refs"), originalRefs)
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        try record("S03-after-" + name)
    }
    private func submit(_ variant: String) throws {
        try reset()
        if variant == "empty" || variant == "required" || variant == "aria" { tap("Set stepper empty") }
        if variant == "required" || variant == "aria" { tap("Toggle stepper required") }
        if variant == "aria" { tap("Toggle stepper aria validation") }
        if variant == "readonly" { tap("Set stepper minimum"); tap("Toggle stepper read-only") }
        if variant == "disabled" { tap("Toggle stepper disabled") }
        if variant == "cancel" { tap("Toggle stepper Form cancellation") }
        let originalRefs = try json("stepper-refs")
        let target = button("Submit stepper form")
        if variant != "readonly" && variant != "disabled" { try prepareKeyboard(nil, action: target) }
        else { reveal(target) }
        try record("S05-before-first-submit-" + variant)
        target.tap()
        waitUntil("A real native Form outcome is required") { (try? self.json("stepper-form-result") as? [String: Any]) != nil }
        let result = try XCTUnwrap(try json("stepper-form-result") as? [String: Any])
        let rows = try callbacks()
        if variant == "required" {
            try exact(result["status"], "invalid")
            let invalid = try XCTUnwrap(result["invalidFields"] as? [[String: Any]])
            XCTAssertEqual(invalid.count, 1)
            let validation = try XCTUnwrap(invalid[0]["validation"] as? [String: Any])
            let details = try XCTUnwrap(validation["validationDetails"] as? [String: Any]); try exact(details["valueMissing"], true)
            let focus = try XCTUnwrap(result["focus"] as? [String: Any])
            try exact(focus["requested"], true); try exact(focus["observed"], true)
            let forms = rows.filter { ($0["kind"] as? String)?.hasPrefix("form:") == true }
            try exact(forms.map { $0["kind"]! }, ["form:result"])
            XCTAssertTrue(app.keyboards.firstMatch.exists)
        } else {
            let entry: [[String]] = variant == "disabled" ? [] : [["quantity", variant == "readonly" ? "-1" : variant == "empty" || variant == "aria" ? "" : "0"]]
            try exact(result["status"], variant == "cancel" ? "cancelled" : "submitted")
            try exact(result["entries"], entry)
            let forms = rows.filter { ($0["kind"] as? String)?.hasPrefix("form:") == true }
            try exact(forms.map { $0["kind"]! }, ["form:submit", "form:result"])
            let request = try XCTUnwrap(forms[0]["data"] as? [String: Any])
            try exact(request["entries"], entry); try exact(request["origin"], "native")
            try exact(request["originalForm"], true); try exact(request["hasSourceEvent"], true)
            try exact(request["defaultPrevented"], variant == "cancel")
        }
        try exact(requestValues(), []); try exact(try json("stepper-refs"), originalRefs)
        let empty = variant == "empty" || variant == "required" || variant == "aria"
        state(empty ? "empty" : variant == "readonly" ? "-1" : "0", 0)
        // XCUI exposes accessibility value text; owner and Form entries above retain canonical ASCII -1.
        XCTAssertEqual(editor().value as? String, empty ? "Empty" : variant == "readonly" ? "\u{2212}1" : "0")
        try record("S05-first-submit-" + variant)
    }
    private func formReset(_ variant: String) throws {
        try reset()
        if variant != "initial" { tap("Next stepper default"); tap("Next stepper default") }
        if variant == "uncontrolled" {
            tap("Toggle stepper controlled mode and remount"); tap("Increase controlled quantity")
        } else { tap("Set stepper maximum") }
        if variant == "veto" { tap("Toggle stepper owner veto") }
        let originalRefs = try json("stepper-refs")
        let target = button("Reset stepper form")
        try prepareKeyboard(nil, action: target); try record("S05-before-first-reset-" + variant)
        target.tap()
        waitUntil("Reset must settle through native Form admission") { (try? self.json("stepper-form-result") as? [String: Any]) != nil }
        let result = try XCTUnwrap(try json("stepper-form-result") as? [String: Any])
        try exact(result["status"], "reset")
        let expected: Double = variant == "initial" ? 0 : 0.4
        try exact(requestValues(), variant == "uncontrolled" ? [0.5, expected] : [expected])
        XCTAssertEqual(Double(editor().value as? String ?? ""), variant == "veto" ? 1 : expected)
        let preResetEntry = variant == "uncontrolled" ? "0.5" : "1"
        try exact(result["entries"], [["quantity", preResetEntry]])
        let requested = try XCTUnwrap(result["requestedFields"] as? [String]); XCTAssertEqual(requested.count, 1)
        let forms = try callbacks().filter { ($0["kind"] as? String)?.hasPrefix("form:") == true }
        try exact(forms.map { $0["kind"]! }, ["form:reset", "form:result"])
        let request = try XCTUnwrap(forms[0]["data"] as? [String: Any])
        try exact(request["origin"], "native"); try exact(request["originalForm"], true); try exact(request["hasSourceEvent"], true)
        let business = try callbacks().filter { ["request", "form:reset", "form:result"].contains($0["kind"] as? String ?? "") }
        try exact(business.map { $0["kind"]! }, variant == "uncontrolled" ? ["request", "request", "form:reset", "form:result"] : ["request", "form:reset", "form:result"])
        try exact(try json("stepper-refs"), originalRefs)
        state(variant == "uncontrolled" ? "uncontrolled" : variant == "veto" ? "1" : "0", variant == "uncontrolled" ? 2 : 1)
        try record("S05-first-reset-" + variant)
    }

    private func s01Configuration() throws -> [String: Any] {
        try XCTUnwrap(try json("stepper-config") as? [String: Any])
    }
    private func s01NoNumericOrNativeEdits() throws {
        let rows = try callbacks()
        try exact(rows.filter { ["request", "raw", "native:change"].contains($0["kind"] as? String ?? "") }, [])
    }
    private func s01QuietOwner(_ owner: String, accessibilityValue: String,
                               configuration: [String: Any], refs: Any) throws {
        state(owner, 0)
        XCTAssertTrue(node("stepper-state").label.contains(". Request: none. Requests: 0. Raw: empty."))
        // Exact accessibility projection; original SDK text/selection remains independent native evidence.
        XCTAssertEqual(editor().value as? String, accessibilityValue)
        try exact(s01Configuration(), configuration)
        try exact(try json("stepper-refs"), refs)
        try s01NoNumericOrNativeEdits()
    }
    private func s01Owner(_ name: String, action: String, owner: String, accessibilityValue: String) throws {
        try reset()
        let configuration = try s01Configuration()
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        let originalRefs = try json("stepper-refs")
        try exact(originalRefs, ["attached": true, "attachments": 1, "detachments": 0])
        try s01QuietOwner("0", accessibilityValue: "0", configuration: configuration, refs: originalRefs)
        try record("S01-before-owner-" + name)
        tap(action)
        try s01QuietOwner(owner, accessibilityValue: accessibilityValue,
                          configuration: configuration, refs: originalRefs)
        try record("S01-owner-" + name)
    }
    private func s01Default(_ name: String, index: Int, initialAX: String, remountedAX: String) throws {
        try reset()
        for _ in 0..<index { tap("Next stepper default") }
        let defaults: [Any] = ["undefined", 0, 0.4, NSNull()]
        let followingDefaults: [Any] = [0, 0.4, NSNull(), "undefined"]
        var configuration = try s01Configuration()
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        try exact(configuration["defaultValue"], defaults[index])
        try s01NoNumericOrNativeEdits()
        tap("Toggle stepper controlled mode and remount")
        configuration["generation"] = 1; configuration["ownership"] = "uncontrolled"
        let originalRefs: [String: Any] = ["attached": true, "attachments": 2, "detachments": 1]
        try s01QuietOwner("uncontrolled", accessibilityValue: initialAX,
                          configuration: configuration, refs: originalRefs)
        try record("S01-default-" + name + "-initial")
        tap("Next stepper default")
        configuration["defaultValue"] = followingDefaults[index]
        try s01QuietOwner("uncontrolled", accessibilityValue: initialAX,
                          configuration: configuration, refs: originalRefs)
        try record("S01-default-" + name + "-prop-update")
        // This is a separate genuine remount action, not a replacement for the prop-update assertion.
        tap("Remount stepper editor")
        configuration["generation"] = 2
        let replacementRefs: [String: Any] = ["attached": true, "attachments": 3, "detachments": 2]
        try s01QuietOwner("uncontrolled", accessibilityValue: remountedAX,
                          configuration: configuration, refs: replacementRefs)
        try record("S01-default-" + name + "-remounted")
    }
    private func s01Controlled(_ veto: Bool) throws {
        try reset()
        if veto { tap("Toggle stepper owner veto") }
        let configuration = try s01Configuration()
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        let originalRefs = try json("stepper-refs")
        try exact(originalRefs, ["attached": true, "attachments": 1, "detachments": 0])
        try s01QuietOwner("0", accessibilityValue: "0", configuration: configuration, refs: originalRefs)
        let target = button("Increase controlled quantity")
        reveal(target)
        let variant = veto ? "veto" : "echo"
        try record("S01-controlled-" + variant + "-before-first-release")
        // The two tap calls are separate activations; bind each to its independent native gesture witness.
        target.tap()
        waitUntil("First controlled request must arrive exactly once") { (try? self.requestValues().count) == 1 }
        try exact(requestValues(), [0.1])
        state(veto ? "0" : "0.1", 1)
        XCTAssertEqual(editor().value as? String, veto ? "0" : "0.1")
        try exact(s01Configuration(), configuration); try exact(try json("stepper-refs"), originalRefs)
        try exact(try callbacks().filter { ["raw", "native:change"].contains($0["kind"] as? String ?? "") }, [])
        try record("S01-controlled-" + variant + "-first-release")
        XCTAssertTrue(target.exists && target.isHittable)
        target.tap()
        waitUntil("Second fresh controlled request must arrive exactly once") { (try? self.requestValues().count) == 2 }
        try exact(requestValues(), veto ? [0.1, 0.1] : [0.1, 0.2])
        state(veto ? "0" : "0.2", 2)
        XCTAssertEqual(editor().value as? String, veto ? "0" : "0.2")
        try exact(s01Configuration(), configuration); try exact(try json("stepper-refs"), originalRefs)
        try exact(try callbacks().filter { ["raw", "native:change"].contains($0["kind"] as? String ?? "") }, [])
        try record("S01-controlled-" + variant + "-second-release")
    }

    func testS01OwnerZero() throws {
        try s01Owner("zero", action: "Set stepper zero", owner: "0", accessibilityValue: "0")
    }
    func testS01OwnerNull() throws {
        try s01Owner("null", action: "Set stepper empty", owner: "empty", accessibilityValue: "Empty")
    }
    func testS01OwnerMinimum() throws {
        try s01Owner("minimum", action: "Set stepper minimum", owner: "-1", accessibilityValue: "\u{2212}1")
    }
    func testS01OwnerMaximum() throws {
        try s01Owner("maximum", action: "Set stepper maximum", owner: "1", accessibilityValue: "1")
    }
    func testS01DefaultUndefined() throws {
        try s01Default("undefined", index: 0, initialAX: "Empty", remountedAX: "0")
    }
    func testS01DefaultZero() throws {
        try s01Default("zero", index: 1, initialAX: "0", remountedAX: "0.4")
    }
    func testS01DefaultFraction() throws {
        try s01Default("fraction", index: 2, initialAX: "0.4", remountedAX: "Empty")
    }
    func testS01DefaultNull() throws {
        try s01Default("null", index: 3, initialAX: "Empty", remountedAX: "Empty")
    }
    func testS01ControlledEcho() throws { try s01Controlled(false) }
    func testS01ControlledVeto() throws { try s01Controlled(true) }


    func testS02FirstIncreaseEcho() throws { try firstRelease(true, veto: false) }
    func testS02FirstDecreaseEcho() throws { try firstRelease(false, veto: false) }
    func testS02FirstIncreaseVeto() throws { try firstRelease(true, veto: true) }
    func testS02FirstDecreaseVeto() throws { try firstRelease(false, veto: true) }
    func testS02HeldEcho() throws { try held(false) }
    func testS02HeldVeto() throws { try held(true) }
    func testS06HeldDisabled() throws { try s06HeldRetirement(1) }
    func testS06HeldReadOnly() throws { try s06HeldRetirement(2) }
    func testS06HeldRemoval() throws { try s06HeldRetirement(3) }
    func testS03ArrowUp() throws { try key("ArrowUp", .upArrow, expected: 0.4) }
    func testS03ArrowDown() throws { try key("ArrowDown", .downArrow, expected: 0.2) }
    func testS03PageUp() throws { try key("PageUp", .pageUp, expected: 0.4) }
    func testS03PageDown() throws { try key("PageDown", .pageDown, expected: 0.2) }
    func testS03Home() throws { try key("Home", .home, expected: -1) }
    func testS03End() throws { try key("End", .end, expected: 1) }
    func testS03ReadOnlyArrowUp() throws { try key("ArrowUp", .upArrow, expected: nil, readOnly: true) }
    func testS03ShiftArrowUp() throws { try key("ArrowUp", .upArrow, expected: nil, shift: true) }
    func testS05FormZero() throws { try submit("zero") }
    func testS05FormEmpty() throws { try submit("empty") }
    func testS05FormReadOnly() throws { try submit("readonly") }
    func testS05FormDisabled() throws { try submit("disabled") }
    func testS05FormCancelled() throws { try submit("cancel") }
    func testS03FormRequired() throws { try submit("required") }
    func testS03FormAria() throws { try submit("aria") }
    func testS05ResetInitial() throws { try formReset("initial") }
    func testS05ResetVeto() throws { try formReset("veto") }
    func testS05ResetUncontrolled() throws { try formReset("uncontrolled") }

    private func s02Configuration() throws -> [String: Any] {
        try XCTUnwrap(try json("stepper-config") as? [String: Any])
    }
    private func s02UnchangedButtonOutcome(_ value: String, accessibilityValue: String,
                                          configuration: [String: Any], refs: Any) throws {
        state(value, 0)
        XCTAssertTrue(node("stepper-state").label.contains(". Request: none. Requests: 0. Raw: empty."))
        XCTAssertEqual(editor().value as? String, accessibilityValue)
        try exact(s02Configuration(), configuration); try exact(try json("stepper-refs"), refs)
        try exact(try callbacks().filter { ["request", "raw", "native:change"].contains($0["kind"] as? String ?? "") }, [])
    }
    private func s02BoundButton(_ upper: Bool) throws {
        try reset()
        tap(upper ? "Set stepper maximum" : "Set stepper minimum")
        let configuration = try s02Configuration()
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        let originalRefs = try json("stepper-refs")
        try exact(originalRefs, ["attached": true, "attachments": 1, "detachments": 0])
        let outward = button(upper ? "Increase controlled quantity" : "Decrease controlled quantity")
        let inward = button(upper ? "Decrease controlled quantity" : "Increase controlled quantity")
        reveal(outward)
        XCTAssertFalse(outward.isEnabled); XCTAssertTrue(inward.exists && inward.isEnabled)
        let value = upper ? "1" : "-1"
        let accessibilityValue = upper ? "1" : "\u{2212}1"
        try s02UnchangedButtonOutcome(value, accessibilityValue: accessibilityValue,
                                     configuration: configuration, refs: originalRefs)
        let side = upper ? "upper" : "lower"
        try record("S02-bound-" + side + "-before-outward-button")
        // A real coordinate tap probes the disabled native target; no JS accessibility action is invoked.
        outward.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        try s02UnchangedButtonOutcome(value, accessibilityValue: accessibilityValue,
                                     configuration: configuration, refs: originalRefs)
        XCTAssertFalse(outward.isEnabled); XCTAssertTrue(inward.exists && inward.isEnabled)
        try record("S02-bound-" + side + "-outward-button")
    }
    private func s02GuardButton(_ readOnly: Bool, increase: Bool) throws {
        try reset()
        tap(readOnly ? "Toggle stepper read-only" : "Toggle stepper disabled")
        let configuration = try s02Configuration()
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        let originalRefs = try json("stepper-refs")
        try exact(originalRefs, ["attached": true, "attachments": 1, "detachments": 0])
        let target = button(increase ? "Increase controlled quantity" : "Decrease controlled quantity")
        reveal(target); XCTAssertFalse(target.isEnabled)
        if !readOnly { XCTAssertFalse(editor().isEnabled) }
        try s02UnchangedButtonOutcome("0", accessibilityValue: "0", configuration: configuration, refs: originalRefs)
        let route = (readOnly ? "read-only" : "disabled") + (increase ? "-increase" : "-decrease")
        try record("S02-guard-" + route + "-before-button")
        target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        try s02UnchangedButtonOutcome("0", accessibilityValue: "0", configuration: configuration, refs: originalRefs)
        XCTAssertFalse(target.isEnabled)
        try record("S02-guard-" + route + "-button")
    }
    private func s02ObservedCancellation(_ route: String) throws {
        // Post-action observer only: the coordinator owns genuine concurrent press/interruption and SDK proof.
        // A completed synchronous hold followed by blur/backgrounding does not meet this admission.
        let raw = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_STEPPER_S02_CANCEL_PRESTATE"])
        let before = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        try exact(before["route"], route); try exact(before["generation"], 0)
        try exact(before["owner"], 0); try exact(before["requestCount"], 0); try exact(before["veto"], false)
        try exact(before["sceneSHA256"], sceneSHA)
        try exact(before["productSHA256"], try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_FIXTURE_PRODUCT_SHA256"]))
        let witness = try XCTUnwrap(before["nativeReceiptSHA256"] as? String)
        XCTAssertNotNil(witness.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        let cycle = try XCTUnwrap(before["nativeCycleId"] as? Int); XCTAssertGreaterThan(cycle, 0)
        try exact(before["nativeTickCountBeforeCancel"], 0)
        // These fields bind the coordinator-verified receipt; they are not independent native proof by themselves.
        try exact(before["nativeCancellationDelivered"], true); try exact(before["nativeOldWorkRetired"], true)
        let initial = try XCTUnwrap(before["callbacks"] as? [[String: Any]])
        let native = try XCTUnwrap(initial.last { $0["kind"] as? String == "native:change" }?["data"] as? [String: Any])
        try exact(native["text"], "0.3")
        try exact(initial.last { $0["kind"] as? String == "raw" }?["data"], "0.3")
        XCTAssertTrue(initial.filter { $0["kind"] as? String == "request" }.isEmpty)
        let originalRefs = try XCTUnwrap(before["refs"] as? [String: Any])
        try exact(originalRefs, ["attached": true, "attachments": 1, "detachments": 0])
        let configuration = try XCTUnwrap(before["configuration"] as? [String: Any])
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        try exact(configuration["bounds"], "both"); try exact(configuration["step"], 0.1)
        try exact(configuration["format"], "decimal"); try exact(before["guard"], "enabled")
        let rows = try callbacks(); XCTAssertGreaterThanOrEqual(rows.count, initial.count)
        try exact(Array(rows.prefix(initial.count)), initial)
        try exact(requestValues(), []); state("0", 0)
        try exact(s02Configuration(), configuration); try exact(try json("stepper-refs"), originalRefs)
        try record("S02-" + route + "-after-native-cancellation")
        // This interval supplements the mandatory SDK retirement/drain receipt; silence does not replace it.
        afterInterval()
        let later = try callbacks(); XCTAssertGreaterThanOrEqual(later.count, rows.count)
        try exact(Array(later.prefix(rows.count)), rows)
        try exact(requestValues(), []); state("0", 0)
        try exact(s02Configuration(), configuration); try exact(try json("stepper-refs"), originalRefs)
        try record("S02-" + route + "-no-late-numeric-action")
    }

    private func s02ObservedTwoTickHold(_ veto: Bool) throws {
        // The coordinator must release the genuine touch immediately after observing the second admitted tick.
        let raw = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_STEPPER_S02_TWO_TICK_PRESTATE"])
        let before = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        try exact(before["veto"], veto); try exact(before["generation"], 0)
        try exact(before["owner"], 0); try exact(before["requestCount"], 0)
        try exact(before["sceneSHA256"], sceneSHA)
        try exact(before["productSHA256"], try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_FIXTURE_PRODUCT_SHA256"]))
        let witness = try XCTUnwrap(before["nativeReceiptSHA256"] as? String)
        XCTAssertNotNil(witness.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        try exact(before["nativeCohort"], "touch")
        try exact(before["nativeAdmittedTickCount"], 2); try exact(before["nativeReleasedAfterTick"], 2)
        try exact(before["sourceTimerContractMs"], [600, 60])
        let initial = try XCTUnwrap(before["callbacks"] as? [[String: Any]])
        let native = try XCTUnwrap(initial.last { $0["kind"] as? String == "native:change" }?["data"] as? [String: Any])
        try exact(native["text"], "0.3")
        try exact(initial.last { $0["kind"] as? String == "raw" }?["data"], "0.3")
        XCTAssertTrue(initial.filter { $0["kind"] as? String == "request" }.isEmpty)
        let originalRefs = try XCTUnwrap(before["refs"] as? [String: Any])
        try exact(originalRefs, ["attached": true, "attachments": 1, "detachments": 0])
        let configuration = try XCTUnwrap(before["configuration"] as? [String: Any])
        try exact(configuration["generation"], 0); try exact(configuration["ownership"], "controlled")
        try exact(configuration["bounds"], "both"); try exact(configuration["step"], 0.1)
        try exact(configuration["format"], "decimal"); try exact(before["guard"], "enabled")
        let rows = try callbacks(); XCTAssertGreaterThanOrEqual(rows.count, initial.count)
        try exact(Array(rows.prefix(initial.count)), initial)
        let expected = veto ? [0.4, 0.1] : [0.4, 0.5]
        try exact(requestValues(), expected); state(veto ? "0" : "0.5", 2)
        XCTAssertEqual(editor().value as? String, veto ? "0" : "0.5")
        let rawBefore = initial.filter { $0["kind"] as? String == "raw" }
        try exact(rows.filter { $0["kind"] as? String == "raw" }, rawBefore)
        try exact(s02Configuration(), configuration); try exact(try json("stepper-refs"), originalRefs)
        let variant = veto ? "veto" : "echo"
        try record("S02-two-admitted-ticks-" + variant + "-released")
        afterInterval()
        try exact(requestValues(), expected); state(veto ? "0" : "0.5", 2)
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        try exact(s02Configuration(), configuration); try exact(try json("stepper-refs"), originalRefs)
        try record("S02-two-admitted-ticks-" + variant + "-no-release-duplicate")
    }

    func testS02UpperBoundOutwardButton() throws { try s02BoundButton(true) }
    func testS02LowerBoundOutwardButton() throws { try s02BoundButton(false) }
    func testS02DisabledIncreaseButton() throws { try s02GuardButton(false, increase: true) }
    func testS02DisabledDecreaseButton() throws { try s02GuardButton(false, increase: false) }
    func testS02ReadOnlyIncreaseButton() throws { try s02GuardButton(true, increase: true) }
    func testS02ReadOnlyDecreaseButton() throws { try s02GuardButton(true, increase: false) }
    func testS02ObserveResponderCancellationBeforeFirstTick() throws {
        try s02ObservedCancellation("responder-interruption")
    }
    func testS02ObserveWindowCancellationBeforeFirstTick() throws {
        try s02ObservedCancellation("window-deactivation")
    }
    func testS02ObserveExactlyTwoDirtyHoldTicksEcho() throws { try s02ObservedTwoTickHold(false) }
    func testS02ObserveExactlyTwoDirtyHoldTicksVeto() throws { try s02ObservedTwoTickHold(true) }


    func testS02DragCancelBeforeFirstTick() throws {
        try reset()
        let raw = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_STEPPER_CANCEL_POINT"], "Bind an observed unoccupied cancellation point")
        let point = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Double])
        let location = CGPoint(x: try XCTUnwrap(point["x"]), y: try XCTUnwrap(point["y"]))
        let target = button("Increase controlled quantity")
        try prepareKeyboard("0.3", action: target)
        let window = app.windows.firstMatch
        XCTAssertTrue(window.frame.contains(location)); XCTAssertFalse(node("stepper-example").frame.contains(location))
        let destination = window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: location.x - window.frame.minX, dy: location.y - window.frame.minY))
        try record("S02-before-cancel")
        target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.1, thenDragTo: destination)
        afterInterval(); try exact(requestValues(), []); state("0", 0)
        try record("S02-real-drag-cancel")
    }

    private func s06Configuration() throws -> [String: Any] {
        try XCTUnwrap(try json("stepper-config") as? [String: Any])
    }
    private func s06Refs() throws -> [String: Any] {
        try XCTUnwrap(try json("stepper-refs") as? [String: Any])
    }
    private func s06Business(_ rows: [[String: Any]]) -> [[String: Any]] {
        let kinds = Set(["request", "form:submit", "form:reset", "form:result"])
        return rows.filter { kinds.contains($0["kind"] as? String ?? "") }
    }
    private func s06PendingAdmission(_ suffix: String) throws {
        // These bindings prevent an unrelated cohort from being selected. A hash is not native proof.
        // Coordinator must independently establish pending old-original work at the actual retirement action,
        // then bind its action/currentness/retirement/drain evidence to these exact case and product identities.
        let environment = ProcessInfo.processInfo.environment
        XCTAssertEqual(environment["CODON_STEPPER_S06_PENDING_CASE"], "S06." + suffix)
        let admission = try XCTUnwrap(environment["CODON_STEPPER_S06_PENDING_ADMISSION_SHA256"],
                                   "Admit genuine pending input; a completed press followed by removal is insufficient")
        XCTAssertNotNil(admission.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
    }
    private func s06HeldRetirement(_ retirement: Int) throws {
        XCTAssertTrue((1...3).contains(retirement))
        try reset()
        for _ in 0..<retirement { tap("Next stepper retirement on request") }
        let suffix = ["hold-retire-disabled", "hold-retire-read-only", "hold-retire-remove"][retirement - 1]
        let target = button("Increase controlled quantity")
        let originalRefs = try s06Refs()
        try exact(originalRefs["attached"], true)
        let generation = try XCTUnwrap(try s06Configuration()["generation"] as? Int)
        try prepareKeyboard("0.3", action: target); state("0", 0)
        let rawBefore = try callbacks().filter { $0["kind"] as? String == "raw" }
        try record("S06-" + suffix + "-before-hold")
        // The scene applies the armed retirement on the first actual numeric request while still held.
        // Independent input evidence must show that this is touch and remains down beyond the next tick.
        target.press(forDuration: 0.8)
        try exact(requestValues(), [0.4]); state("0.4", 1)
        let requests = try callbacks().filter { $0["kind"] as? String == "request" }
        try exact(requests.map { $0["generation"]! }, [generation])
        let config = try s06Configuration()
        try exact(config["retireOnRequest"], "none")
        try exact(config["generation"], generation)
        try exact(config["mounted"], retirement != 3)
        if retirement == 3 {
            XCTAssertFalse(editor().exists)
            let currentRefs = try s06Refs()
            try exact(currentRefs["attached"], false)
            try exact(currentRefs["attachments"], originalRefs["attachments"]!)
            try exact(currentRefs["detachments"], try XCTUnwrap(originalRefs["detachments"] as? Int) + 1)
            XCTAssertFalse(app.keyboards.firstMatch.exists)
        } else {
            XCTAssertTrue(editor().exists)
            XCTAssertEqual(editor().value as? String, "0.4")
            XCTAssertFalse(target.isEnabled)
            XCTAssertFalse(button("Decrease controlled quantity").isEnabled)
            try exact(try s06Refs(), originalRefs)
        }
        let keyboardAfterRetirement = app.keyboards.firstMatch.exists
        let businessAfterRetirement = s06Business(try callbacks())
        try record("S06-" + suffix + "-after-release")
        afterInterval()
        try exact(s06Business(try callbacks()), businessAfterRetirement)
        try exact(requestValues(), [0.4]); state("0.4", 1)
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        if !keyboardAfterRetirement { XCTAssertFalse(app.keyboards.firstMatch.exists) }
        if retirement != 3 { try exact(try s06Refs(), originalRefs) }
        else { XCTAssertFalse(editor().exists) }
        try record("S06-" + suffix + "-post-retirement")
    }
    private func s06EditorRetirement(_ replacement: Bool) throws {
        try reset()
        let suffix = replacement ? "editor-replace" : "editor-remove"
        let action = button(replacement ? "Remount stepper editor" : "Remove or reinsert stepper editor")
        let originalRefs = try s06Refs()
        let originalGeneration = try XCTUnwrap(try s06Configuration()["generation"] as? Int)
        try exact(originalRefs["attached"], true)
        try prepareKeyboard("0.3", action: action); state("0", 0)
        let before = try callbacks()
        let rawBefore = before.filter { $0["kind"] as? String == "raw" }
        try s06PendingAdmission(suffix)
        try record("S06-" + suffix + "-before-retirement")
        // No scrolling, focus change, finished hold, direct prop invocation or fabricated key packet here.
        // The separately admitted producer must keep genuine old-editor press/key work pending at this tap.
        XCTAssertTrue(action.isHittable)
        action.tap()
        let expectedGeneration = originalGeneration + (replacement ? 1 : 0)
        waitUntil("The actual editor must retire") {
            guard let config = try? self.s06Configuration(), let refs = try? self.s06Refs(),
                  let detachments = refs["detachments"] as? Int,
                  let oldDetachments = originalRefs["detachments"] as? Int else { return false }
            return config["generation"] as? Int == expectedGeneration && detachments == oldDetachments + 1 &&
                (replacement ? self.editor().exists : !self.editor().exists)
        }
        try exact(try s06Configuration()["mounted"], replacement)
        let retiredRefs = try s06Refs()
        try exact(retiredRefs["attached"], replacement)
        try exact(retiredRefs["detachments"], try XCTUnwrap(originalRefs["detachments"] as? Int) + 1)
        try exact(retiredRefs["attachments"], try XCTUnwrap(originalRefs["attachments"] as? Int) + (replacement ? 1 : 0))
        try exact(Array(try callbacks().prefix(before.count)), before)
        try exact(s06Business(try callbacks()), []); state("0", 0)
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        try record("S06-" + suffix + "-retired")
        afterInterval()
        try exact(s06Business(try callbacks()), []); state("0", 0)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        if !replacement {
            XCTAssertFalse(editor().exists)
            tap("Remove or reinsert stepper editor")
            XCTAssertTrue(editor().waitForExistence(timeout: 10))
        }
        try exact(try s06Configuration()["generation"], originalGeneration + 1)
        try exact(try s06Configuration()["mounted"], true)
        XCTAssertEqual(editor().value as? String, "0")
        let newRefs = try s06Refs()
        try exact(newRefs["attached"], true)
        try exact(newRefs["attachments"], try XCTUnwrap(originalRefs["attachments"] as? Int) + 1)
        try exact(newRefs["detachments"], try XCTUnwrap(originalRefs["detachments"] as? Int) + 1)
        try exact(s06Business(try callbacks()), []); state("0", 0)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        afterInterval()
        try exact(s06Business(try callbacks()), []); state("0", 0)
        try exact(try callbacks().filter { $0["kind"] as? String == "raw" }, rawBefore)
        try exact(Array(try callbacks().prefix(before.count)), before)
        XCTAssertEqual(editor().value as? String, "0")
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        try record("S06-" + suffix + "-new-original")
        // A new-generation positive control must not be mistaken for a late old-generation callback.
        tap("Increase controlled quantity")
        try exact(requestValues(), [0.1]); state("0.1", 1)
        let requests = try callbacks().filter { $0["kind"] as? String == "request" }
        try exact(requests.map { $0["generation"]! }, [originalGeneration + 1])
        try record("S06-" + suffix + "-new-generation-control")
    }
    func testS06EditorRemoval() throws { try s06EditorRetirement(false) }
    func testS06EditorReplacement() throws { try s06EditorRetirement(true) }

    func testS06ObserveCoordinatorWholeSceneRetirement() throws {
        // Coordinator performs genuine pending input + Reset/reentry before this post-action observer.
        // Pending work, actual native detach/currentness and drain remain independent native proof.
        try s06PendingAdmission("whole-scene-unmount")
        let expectedOwner = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_STEPPER_RETIRED_OWNER"])
        let witness = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_STEPPER_RETIREMENT_RECEIPT_SHA256"])
        XCTAssertNotNil(witness.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        tap("Read stepper scene teardown observation")
        let before = try XCTUnwrap(try json("stepper-teardown") as? [String: Any])
        try exact(before["owner"], expectedOwner); try exact(before["unmounted"], true)
        let beforeRows = try XCTUnwrap(before["callbacks"] as? [[String: Any]])
        XCTAssertTrue(beforeRows.filter { $0["afterUnmount"] as? Bool == true && !s06Business([$0]).isEmpty }.isEmpty)
        try exact(try s06Configuration()["generation"], 0)
        try exact(try s06Configuration()["mounted"], true)
        try exact(try s06Refs()["attached"], true)
        try exact(requestValues(), []); state("0", 0)
        XCTAssertEqual(editor().value as? String, "0")
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        try record("S06-retired-owner-before-observation")
        afterInterval(); tap("Read stepper scene teardown observation")
        let after = try XCTUnwrap(try json("stepper-teardown") as? [String: Any])
        let afterRows = try XCTUnwrap(after["callbacks"] as? [[String: Any]])
        try exact(after["owner"], expectedOwner); try exact(after["unmounted"], true)
        try exact(Array(afterRows.prefix(beforeRows.count)), beforeRows)
        XCTAssertTrue(afterRows.filter { $0["afterUnmount"] as? Bool == true && !s06Business([$0]).isEmpty }.isEmpty)
        // Preserve every terminal native observation; coordinator adjudicates it against the genuine native order.
        // An unchanged capture or1500ms silence is not an SDK retirement/drain acknowledgment.
        try exact(requestValues(), []); state("0", 0)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        try record("S06-retired-owner-post-action")
        tap("Increase controlled quantity")
        try exact(requestValues(), [0.1]); state("0.1", 1)
        tap("Read stepper scene teardown observation")
        let isolated = try XCTUnwrap(try json("stepper-teardown") as? [String: Any])
        let isolatedRows = try XCTUnwrap(isolated["callbacks"] as? [[String: Any]])
        try exact(isolated["owner"], expectedOwner)
        try exact(Array(isolatedRows.prefix(afterRows.count)), afterRows)
        XCTAssertTrue(isolatedRows.filter { $0["afterUnmount"] as? Bool == true && !s06Business([$0]).isEmpty }.isEmpty)
        try record("S06-new-scene-isolated-control")
    }
}

// Append to StepperG02TrialTests.swift in the SAME compilation unit: its original private helpers remain authoritative.
// Public outcomes do not replace the independent original-native instance/event/window witness.
extension StepperG02TrialTests {
    private struct S05RetainedState {
        let refs: Any
        let config: Any
        let raw: [[String: Any]]
    }

    private func s05RawRows() throws -> [[String: Any]] {
        try callbacks().filter { $0["kind"] as? String == "raw" }
    }

    private func s05Snapshot() throws -> S05RetainedState {
        S05RetainedState(refs: try json("stepper-refs"), config: try json("stepper-config"), raw: try s05RawRows())
    }

    private func s05PrimeVetoOwner() throws {
        try reset()
        let increase = button("Increase controlled quantity")
        reveal(increase); increase.tap()
        waitUntil("Prepare the original echo owner at0.1 with exactly one request") {
            (try? self.requestValues().count) == 1 && self.editor().value as? String == "0.1"
        }
        try exact(requestValues(), [0.1]); state("0.1", 1)
        tap("Toggle stepper owner veto")
        XCTAssertTrue(node("stepper-state").label.contains("Parent: veto."))
    }

    private func s05Retained(_ original: S05RetainedState, requests: [Double], localized: String) throws {
        state("0.1", requests.count)
        XCTAssertTrue(node("stepper-state").label.contains("Parent: veto."))
        try exact(requestValues(), requests)
        try exact(try json("stepper-refs"), original.refs)
        try exact(try json("stepper-config"), original.config)
        try exact(try s05RawRows(), original.raw)
        XCTAssertTrue(editor().exists)
        XCTAssertEqual(editor().value as? String, localized)
    }

    private func s05Record(_ stage: String) throws {
        try record(stage)
        if node("stepper-presentation").exists {
            let metadata = try json("stepper-presentation")
            let receipt = XCTAttachment(data: try JSONSerialization.data(withJSONObject: metadata, options: [.sortedKeys]),
                                        uniformTypeIdentifier: "public.json")
            receipt.name = stage + "-presentation"; receipt.lifetime = .keepAlways; add(receipt)
        }
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = stage + "-screen"; screen.lifetime = .keepAlways; add(screen)
    }

    private func s05Presentation(_ suffix: String, action: String, prior: Int,
                                 stateFragment: String?, localized: String = "0.1") throws {
        try s05PrimeVetoOwner()
        for _ in 0..<prior { tap(action) }
        state("0.1", 1); try exact(requestValues(), [0.1])
        let original = try s05Snapshot()
        try s05Record("S05-before-" + suffix)
        tap(action)
        if suffix.hasPrefix("presentation-styles-") || suffix.hasPrefix("presentation-icons-") {
            let metadata = try XCTUnwrap(try json("stepper-presentation") as? [String: Any])
            let axis = suffix.hasPrefix("presentation-styles-") ? "styles" : "icons"
            try exact(metadata[axis], suffix.hasSuffix("-custom") ? "custom" : "default")
        }
        if let stateFragment = stateFragment {
            XCTAssertTrue(node("stepper-state").label.contains(stateFragment), node("stepper-state").label)
        }
        try s05Retained(original, requests: [0.1], localized: localized)
        let increase = button("Increase controlled quantity"), decrease = button("Decrease controlled quantity")
        reveal(increase); reveal(decrease)
        XCTAssertTrue(increase.isEnabled && increase.isHittable)
        XCTAssertTrue(decrease.isEnabled && decrease.isHittable)
        try s05Record("S05-after-presentation-" + suffix)
        increase.tap()
        waitUntil("Exactly one next real gesture through the retained presentation") {
            (try? self.requestValues().count) == 2
        }
        try s05Retained(original, requests: [0.1, 0.2], localized: localized)
        try s05Record("S05-after-next-gesture-" + suffix)
    }

    private func s05ReportedRootWidth() -> Double? {
        let label = node("stepper-frame").label
        let prefix = "Last native root: "
        guard label.hasPrefix(prefix) else { return nil }
        let value = String(label.dropFirst(prefix.count)).components(separatedBy: " x ").first ?? ""
        return Double(value)
    }

    @objc func testS05ExplicitWidthZero() throws {
        try reset()
        waitUntil("Initial root must have an actual nonzero native layout") {
            (self.s05ReportedRootWidth() ?? 0) > 0
        }
        let original = try s05Snapshot()
        try exact(requestValues(), []); state("0", 0)
        try s05Record("S05-before-explicit-width-zero")
        tap("Toggle stepper zero width")
        waitUntil("Actual native root layout must report exactly zero width") {
            self.s05ReportedRootWidth() == 0
        }
        XCTAssertEqual(try XCTUnwrap(s05ReportedRootWidth()), 0)
        let root = node("stepper-example")
        if root.exists { XCTAssertEqual(root.frame.width, 0) }
        try exact(try json("stepper-refs"), original.refs)
        try exact(try json("stepper-config"), original.config)
        try exact(try s05RawRows(), original.raw)
        try exact(requestValues(), []); state("0", 0)
        try s05Record("S05-actual-zero-width-no-synthetic-hit")
        // The external scene control is the only restoration action; never tap a zero-width field or arrow.
        tap("Toggle stepper zero width")
        waitUntil("Restored native root and editor must actually be reachable") {
            (self.s05ReportedRootWidth() ?? 0) > 0 && self.editor().exists
        }
        reveal(editor()); XCTAssertTrue(editor().isHittable)
        XCTAssertEqual(editor().value as? String, "0")
        try exact(try json("stepper-refs"), original.refs)
        try exact(try s05RawRows(), original.raw)
        try exact(requestValues(), []); state("0", 0)
        try s05Record("S05-restored-width-original-editor")
    }

    private func s05Context(_ kind: String) throws {
        try s05PrimeVetoOwner()
        let original = try s05Snapshot()
        let originalWindow = app.windows.firstMatch.frame
        try s05Record("S05-before-context-" + kind)
        if kind == "theme" {
            XCTAssertTrue(button("Light theme").isSelected, "Original Dark-theme action requires the admitted light baseline")
            tap("Dark theme")
            XCTAssertTrue(button("Dark theme").isSelected)
        } else if kind == "fixture" {
            XCTAssertTrue(button("Live window").isSelected, "Start from the admitted live window, not a simulated posture")
            tap("Vertical blocked region")
            XCTAssertTrue(button("Vertical blocked region").isSelected)
        } else {
            XCTAssertEqual(kind, "window")
            XCUIDevice.shared.orientation = .landscapeLeft
            waitUntil("A real landscape window, with the same running scene, is required") {
                let frame = self.app.windows.firstMatch.frame
                return frame.width > frame.height && frame.width != originalWindow.width
            }
            try s05Retained(original, requests: [0.1], localized: "0.1")
            try s05Record("S05-context-actual-landscape")
            XCUIDevice.shared.orientation = .portrait
            waitUntil("Return the actual window to portrait") {
                let frame = self.app.windows.firstMatch.frame
                return XCUIDevice.shared.orientation == .portrait && frame.width < frame.height
            }
        }
        try s05Retained(original, requests: [0.1], localized: "0.1")
        XCTAssertEqual(app.state, .runningForeground)
        let increase = button("Increase controlled quantity"), submit = button("Submit stepper form")
        // Establish visibility before focus; no scrolling, finishing edit or second business activation may replace the first one.
        reveal(submit); reveal(increase)
        try prepareKeyboard(nil, action: increase)
        XCTAssertTrue(submit.isHittable, "The real Form action must also remain reachable with the keyboard active")
        try s05Record("S05-context-first-keyboard-action-" + kind)
        increase.tap()
        waitUntil("One retained-veto request0.2 after context change") { (try? self.requestValues().count) == 2 }
        try s05Retained(original, requests: [0.1, 0.2], localized: "0.1")
        try prepareKeyboard(nil, action: submit)
        let beforeForm = try requestValues()
        try s05Record("S05-context-before-first-form-" + kind)
        submit.tap()
        waitUntil("The first keyboard-active Form action must produce its native outcome") {
            (try? self.json("stepper-form-result") as? [String: Any]) != nil
        }
        let result = try XCTUnwrap(try json("stepper-form-result") as? [String: Any])
        try exact(result["status"], "submitted"); try exact(result["entries"], [["quantity", "0.1"]])
        let forms = try callbacks().filter { ($0["kind"] as? String)?.hasPrefix("form:") == true }
        try exact(forms.map { $0["kind"]! }, ["form:submit", "form:result"])
        let request = try XCTUnwrap(forms[0]["data"] as? [String: Any])
        try exact(request["origin"], "native"); try exact(request["originalForm"], true)
        try exact(request["hasSourceEvent"], true); try exact(request["defaultPrevented"], false)
        try exact(request["entries"], [["quantity", "0.1"]])
        try exact(requestValues(), beforeForm); state("0.1", 2)
        try exact(try json("stepper-refs"), original.refs)
        try exact(try json("stepper-config"), original.config)
        XCTAssertEqual(editor().value as? String, "0.1")
        try s05Record("S05-context-retained-first-results-" + kind)
        // Success-only restoration keeps the next admitted case's baseline; failure-path evidence is never reset.
        if kind == "theme" { tap("Light theme") }
        if kind == "fixture" { tap("Live window") }
    }

    @objc func testS05ContextThemeRetention() throws { try s05Context("theme") }
    @objc func testS05ContextFixtureRetention() throws { try s05Context("fixture") }
    @objc func testS05ContextWindowRetention() throws { try s05Context("window") }
    @objc func testS05PresentationTypeCohesive() throws { try s05Presentation("presentation-type-cohesive", action: "Toggle stepper type", prior: 0, stateFragment: "Type: cohesive.", localized: "0.1") }
    @objc func testS05PresentationTypeSegmented() throws { try s05Presentation("presentation-type-segmented", action: "Toggle stepper type", prior: 1, stateFragment: "Type: segmented.", localized: "0.1") }
    @objc func testS05PresentationOrientationVertical() throws { try s05Presentation("presentation-orientation-vertical", action: "Toggle stepper orientation", prior: 0, stateFragment: "Orientation: vertical.", localized: "0.1") }
    @objc func testS05PresentationOrientationHorizontal() throws { try s05Presentation("presentation-orientation-horizontal", action: "Toggle stepper orientation", prior: 1, stateFragment: "Orientation: horizontal.", localized: "0.1") }
    @objc func testS05PresentationModeOutline() throws { try s05Presentation("presentation-mode-outline", action: "Toggle stepper color mode", prior: 0, stateFragment: "Mode: outline.", localized: "0.1") }
    @objc func testS05PresentationModeFill() throws { try s05Presentation("presentation-mode-fill", action: "Toggle stepper color mode", prior: 1, stateFragment: "Mode: fill.", localized: "0.1") }
    @objc func testS05PresentationOrderPrimary() throws { try s05Presentation("presentation-order-primary", action: "Next stepper order", prior: 0, stateFragment: "Order: primary.", localized: "0.1") }
    @objc func testS05PresentationOrderSecondary() throws { try s05Presentation("presentation-order-secondary", action: "Next stepper order", prior: 1, stateFragment: "Order: secondary.", localized: "0.1") }
    @objc func testS05PresentationOrderTertiary() throws { try s05Presentation("presentation-order-tertiary", action: "Next stepper order", prior: 2, stateFragment: "Order: tertiary.", localized: "0.1") }
    @objc func testS05PresentationOrderQuaternary() throws { try s05Presentation("presentation-order-quaternary", action: "Next stepper order", prior: 3, stateFragment: "Order: quaternary.", localized: "0.1") }
    @objc func testS05PresentationOrderQuintenary() throws { try s05Presentation("presentation-order-quintenary", action: "Next stepper order", prior: 4, stateFragment: "Order: quintenary.", localized: "0.1") }
    @objc func testS05PresentationOrderNone() throws { try s05Presentation("presentation-order-none", action: "Next stepper order", prior: 5, stateFragment: "Order: none.", localized: "0.1") }
    @objc func testS05PresentationGeometryRounded() throws { try s05Presentation("presentation-geometry-rounded", action: "Next stepper geometry", prior: 0, stateFragment: "Geometry: rounded.", localized: "0.1") }
    @objc func testS05PresentationGeometryOrthogonal() throws { try s05Presentation("presentation-geometry-orthogonal", action: "Next stepper geometry", prior: 1, stateFragment: "Geometry: orthogonal.", localized: "0.1") }
    @objc func testS05PresentationGeometryRound() throws { try s05Presentation("presentation-geometry-round", action: "Next stepper geometry", prior: 2, stateFragment: "Geometry: round.", localized: "0.1") }
    @objc func testS05PresentationSizeSmall() throws { try s05Presentation("presentation-size-small", action: "Next stepper text size", prior: 0, stateFragment: "Size: small.", localized: "0.1") }
    @objc func testS05PresentationSizeLarge() throws { try s05Presentation("presentation-size-large", action: "Next stepper text size", prior: 1, stateFragment: "Size: large.", localized: "0.1") }
    @objc func testS05PresentationSizeMedium() throws { try s05Presentation("presentation-size-medium", action: "Next stepper text size", prior: 2, stateFragment: "Size: medium.", localized: "0.1") }
    @objc func testS05PresentationStatusError() throws { try s05Presentation("presentation-status-error", action: "Next stepper status", prior: 0, stateFragment: "Status: error.", localized: "0.1") }
    @objc func testS05PresentationStatusWarning() throws { try s05Presentation("presentation-status-warning", action: "Next stepper status", prior: 1, stateFragment: "Status: warning.", localized: "0.1") }
    @objc func testS05PresentationStatusSuccess() throws { try s05Presentation("presentation-status-success", action: "Next stepper status", prior: 2, stateFragment: "Status: success.", localized: "0.1") }
    @objc func testS05PresentationStatusNone() throws { try s05Presentation("presentation-status-none", action: "Next stepper status", prior: 3, stateFragment: "Status: none.", localized: "0.1") }
    @objc func testS05PresentationStylesCustom() throws { try s05Presentation("presentation-styles-custom", action: "Toggle stepper styles", prior: 0, stateFragment: nil, localized: "0.1") }
    @objc func testS05PresentationStylesDefault() throws { try s05Presentation("presentation-styles-default", action: "Toggle stepper styles", prior: 1, stateFragment: nil, localized: "0.1") }
    @objc func testS05PresentationIconsCustom() throws { try s05Presentation("presentation-icons-custom", action: "Toggle stepper icons", prior: 0, stateFragment: nil, localized: "0.1") }
    @objc func testS05PresentationIconsDefault() throws { try s05Presentation("presentation-icons-default", action: "Toggle stepper icons", prior: 1, stateFragment: nil, localized: "0.1") }
    @objc func testS05PresentationLocaleFrCa() throws { try s05Presentation("presentation-locale-fr-CA", action: "Toggle stepper locale", prior: 0, stateFragment: "Locale: fr-CA.", localized: "0,1") }
    @objc func testS05PresentationLocaleEnUs() throws { try s05Presentation("presentation-locale-en-US", action: "Toggle stepper locale", prior: 1, stateFragment: "Locale: en-US.", localized: "0.1") }
}
