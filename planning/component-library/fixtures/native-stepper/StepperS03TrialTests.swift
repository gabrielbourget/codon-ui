import XCTest

// Add to the existing showcase UI-test target; the Mac coordinator owns compilation/execution.
// Admission hashes bind external receipts. They do not establish native input or fresh-process proof.
final class StepperS03TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "a7917a4e0ea881fa4078806ba6a88c5b6769ba2754b876927cce66ba31cf4f44"

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard ProcessInfo.processInfo.environment["CODON_STEPPER_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the committed Stepper scene before execution")
            throw NSError(domain: "StepperS03Admission", code: 1)
        }
        for key in ["CODON_STEPPER_PRODUCT_SHA256", "CODON_STEPPER_INPUT_RECEIPT_SHA256"] {
            try requireHash(key)
        }
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product; no replacement launch")
            throw NSError(domain: "StepperS03Admission", code: 2)
        }
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        tap("Reset scene")
        tap("Stepper scene")
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        try quantity("0", request: "none", requests: 0, raw: "empty")
        try exact(try callbacks(), [])
        try exact(try config()["generation"], 0)
        try exact(try refs()["attached"], true)
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "stepper-s03-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "stepper-s03-final-native-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        // Preserve the failed focused state. No retry, replacement launch, reset or blur here.
    }

    private var field: XCUIElement {
        app.textFields.matching(identifier: "stepper-example-input").firstMatch
    }
    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func button(_ label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    private func requireHash(_ key: String) throws {
        let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
        XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
    }
    private func reveal(_ target: XCUIElement) {
        for _ in 0..<12 {
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
    private func read(_ id: String) throws -> Any {
        let target = node(id)
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing " + id)
        return try JSONSerialization.jsonObject(with: Data(target.label.utf8), options: .fragmentsAllowed)
    }
    private func config() throws -> [String: Any] { try XCTUnwrap(try read("stepper-config") as? [String: Any]) }
    private func refs() throws -> [String: Any] { try XCTUnwrap(try read("stepper-refs") as? [String: Any]) }
    private func callbacks() throws -> [[String: Any]] {
        try XCTUnwrap(try read("stepper-callbacks") as? [[String: Any]])
    }
    private func requests() throws -> [Any] {
        try callbacks().filter { $0["kind"] as? String == "request" }.map { try XCTUnwrap($0["data"]) }
    }
    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let lhs = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let rhs = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(String(decoding: lhs, as: UTF8.self), String(decoding: rhs, as: UTF8.self))
    }
    private func quantity(_ value: String, request: String, requests: Int, raw: String? = nil) throws {
        let state = node("stepper-state")
        XCTAssertTrue(state.waitForExistence(timeout: 10))
        XCTAssertTrue(state.label.hasPrefix("Value: \(value). Request: \(request). Requests: \(requests). Raw: "), state.label)
        if let raw = raw { XCTAssertTrue(state.label.contains(". Raw: \(raw). Parent: "), state.label) }
        try exact(try self.requests().count, requests)
    }
    private func waitUntil(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }
    private func record(_ stage: String) throws {
        let window = app.windows.firstMatch.frame
        let payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "capturedAt": Date().timeIntervalSince1970,
            "state": node("stepper-state").label, "config": try config(), "callbacks": try callbacks(),
            "refs": try refs(), "fieldValue": field.value as? String ?? "absent", "fieldLabel": field.label,
            "keyboardActive": app.keyboards.firstMatch.exists,
            "window": [window.minX, window.minY, window.width, window.height],
            "scope": "Actual XCTest public outcomes; original SDK identity/event/fresh-process receipts remain separate"
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func chooseFormat(_ index: Int, label: String) throws {
        for _ in 0..<index { tap("Next stepper numeric format") }
        try exact(try config()["format"], label)
        try exact(try requests(), [])
    }
    private func programmaticFormats(_ english: [String], _ french: [String]) throws {
        let originalRefs = try refs()
        for (locale, expected) in [("en-US", english), ("fr-CA", french)] {
            if locale == "fr-CA" { tap("Toggle stepper locale") }
            for (action, text) in zip(["Set stepper minimum", "Set stepper zero", "Set stepper maximum"], expected) {
                tap(action)
                XCTAssertEqual(field.value as? String, text, locale + ": " + action)
                try exact(try requests(), [])
                try exact(try refs(), originalRefs)
            }
        }
    }
    private func focusedDraft(_ text: String) throws {
        XCTAssertEqual(field.value as? String, "")
        reveal(field); field.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        field.typeText(text) // One unpaced call; no sleeps, warm-up input or forced blur.
        try observedDraft(text)
    }
    private func observedDraft(_ text: String) throws {
        XCTAssertEqual(field.value as? String, text)
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        let events = try callbacks()
        let raw = events.filter { $0["kind"] as? String == "raw" }
        let native = events.filter { $0["kind"] as? String == "native:change" }
        XCTAssertGreaterThan(raw.count, 0)
        try exact(raw.count, native.count)
        try exact(raw.last?["data"], text)
        let changes = try native.map { try XCTUnwrap($0["data"] as? [String: Any]) }
        try exact(changes.last?["text"], text)
        let target = try XCTUnwrap(changes.first?["target"] as? Int)
        XCTAssertGreaterThan(target, 0)
        for (raw, change) in zip(raw, changes) {
            try exact(raw["data"], try XCTUnwrap(change["text"]))
            try exact(change["target"], target)
        }
        try record("S03-focused-draft-" + text)
    }
    private func submitDraft(_ raw: String, value: Double?, display: String, allRequests: [Any]) throws {
        let before = try callbacks().filter { ["native:submit", "native:end"].contains($0["kind"] as? String ?? "") }.count
        field.typeText("\n") // Actual native Return; never call a JS observer or Form action to fabricate commit.
        waitUntil("Native final payload did not settle") {
            (try? self.callbacks().filter { $0["kind"] as? String == "native:end" }.last?["data"] as? String) == raw
        }
        XCTAssertEqual(field.value as? String, display)
        try exact(try requests(), allRequests)
        let finals = try callbacks().filter { ["native:submit", "native:end"].contains($0["kind"] as? String ?? "") }
        XCTAssertEqual(finals.count, before + 2)
        try exact(finals.suffix(2).map { $0["kind"] as? String ?? "" }, ["native:submit", "native:end"])
        for final in finals.suffix(2) { try exact(final["data"], raw) }
        if let value = value {
            let events = try callbacks()
            let request = try XCTUnwrap(events.lastIndex { $0["kind"] as? String == "request" })
            let submit = try XCTUnwrap(events.lastIndex { $0["kind"] as? String == "native:submit" })
            XCTAssertLessThan(request, submit)
            try exact(events[request]["data"], value)
            let text = String(value).replacingOccurrences(of: "\\.0$", with: "", options: .regularExpression)
            try quantity(text, request: text, requests: allRequests.count, raw: raw.isEmpty ? "empty" : raw)
        }
    }
    private func freshEdit(_ text: String, value: Double, display: String, french: Bool) throws {
        // The external receipt must prove zero earlier native editor input in this admitted app process.
        try requireHash("CODON_STEPPER_FRESH_PROCESS_RECEIPT_SHA256")
        if french { tap("Toggle stepper locale") }
        tap("Set stepper empty")
        let originalRefs = try refs()
        try focusedDraft(text)
        try quantity("empty", request: "none", requests: 0, raw: text)
        try exact(try requests(), []) // Numeric onChange is a final-event commit, not onChangeText.
        try exact(try refs(), originalRefs)
        try record("S03-first-focused-unpaced-verdict")
        try submitDraft(text, value: value, display: display, allRequests: [value])
        try exact(try refs(), originalRefs)
        try record("S03-first-edit-final-payload")
    }
    private func numericConstraint(_ raw: String, value: Double, flag: String) throws {
        tap("Toggle stepper commit validation")
        tap("Next stepper numeric step") // Omitted explicit step retains the native numeric constraint's default 1.
        tap("Set stepper empty")
        try focusedDraft(raw)
        try submitDraft(raw, value: value, display: raw, allRequests: [value])
        tap("Next stepper explicit invalid") // Explicit false affects display, not independent numeric constraints.
        try exact(try config()["isInvalid"], false)
        waitUntil("Explicit false did not clear visible invalid status") { !self.field.label.contains("Invalid") }
        try invalidSubmit(flags: [flag], errors: [])
        try exact(try requests(), [value])
    }
    private func invalidSubmit(flags: [String], errors: [String]) throws {
        tap("Submit stepper form")
        let result = try XCTUnwrap(try read("stepper-form-result") as? [String: Any])
        try exact(result["status"], "invalid") // Retired/unavailable native admission is a failure, never a substitute pass.
        let fields = try XCTUnwrap(result["invalidFields"] as? [[String: Any]])
        XCTAssertEqual(fields.count, 1)
        let field = try XCTUnwrap(fields.first)
        XCTAssertFalse(try XCTUnwrap(field["descriptorId"] as? String).isEmpty)
        let validation = try XCTUnwrap(field["validation"] as? [String: Any])
        try exact(validation["isInvalid"], true)
        try exact(validation["validationErrors"], errors)
        var details = Dictionary(uniqueKeysWithValues: ["badInput", "customError", "patternMismatch", "rangeOverflow",
            "rangeUnderflow", "stepMismatch", "tooLong", "tooShort", "typeMismatch", "valueMissing", "valid"].map { ($0, false) })
        for flag in flags { details[flag] = true }
        try exact(validation["validationDetails"], details)
        try exact(try callbacks().filter { $0["kind"] as? String == "form:submit" }, [])
        try record("S03-invalid-" + flags.joined(separator: "-"))
    }

    func testS03FreshUnpacedEnglishDraftAndFinalCommit() throws {
        try freshEdit("0.4", value: 0.4, display: "0.4", french: false)
    }
    func testS03FreshUnpacedFrenchDraftAndFinalCommit() throws {
        try freshEdit("0,4", value: 0.4, display: "0,4", french: true)
    }
    func testS03FixedFractionFormattingBothLocales() throws {
        try chooseFormat(1, label: "decimal-2")
        try programmaticFormats(["-1.00", "0.00", "1.00"], ["-1,00", "0,00", "1,00"])
        try record("S03-fixed-fraction-both-locales")
    }
    func testS03AccountingCurrencyFormattingBothLocales() throws {
        try chooseFormat(2, label: "currency")
        try programmaticFormats(["(CA$1.00)", "CA$0.00", "CA$1.00"], ["(1,00\u{00a0}$)", "0,00\u{00a0}$", "1,00\u{00a0}$"])
        try record("S03-accounting-currency-both-locales")
    }
    func testS03PercentFormattingBothLocalesAndDefaultStep() throws {
        try chooseFormat(3, label: "percent")
        try programmaticFormats(["-100%", "0%", "100%"], ["-100\u{00a0}%", "0\u{00a0}%", "100\u{00a0}%"])
        tap("Set stepper zero"); tap("Next stepper numeric step")
        try exact(try config()["step"], "undefined")
        tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "1\u{00a0}%")
        try exact(try requests(), [0.01])
        tap("Decrease controlled quantity")
        XCTAssertEqual(field.value as? String, "0\u{00a0}%")
        try exact(try requests(), [0.01, 0])
        try record("S03-percent-default-step")
    }
    func testS03UnitFormattingBothLocales() throws {
        try chooseFormat(4, label: "unit")
        try programmaticFormats(["-1 liter", "0 liters", "1 liter"], ["-1\u{00a0}litre", "0\u{00a0}litre", "1\u{00a0}litre"])
        try record("S03-unit-both-locales")
    }
    func testS03SignificantDigitsRoundOnlyAtFinalCommit() throws {
        try chooseFormat(5, label: "significant")
        try programmaticFormats(["-1", "0", "1"], ["-1", "0", "1"])
        tap("Next stepper numeric step"); tap("Set stepper empty")
        try focusedDraft("0,12345")
        try quantity("empty", request: "none", requests: 0, raw: "0,12345")
        try submitDraft("0,12345", value: 0.123, display: "0,123", allRequests: [0.123])
        try record("S03-significant-digits-final-commit")
    }
    func testS03CorrectionEmptyAndZeroRemainDistinct() throws {
        tap("Set stepper empty")
        try focusedDraft("0.3")
        field.typeText(XCUIKeyboardKey.delete.rawValue + "4")
        try observedDraft("0.4")
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 3))
        try observedDraft("")
        try quantity("empty", request: "none", requests: 0, raw: "empty")
        try submitDraft("", value: nil, display: "", allRequests: [])
        try focusedDraft("0")
        try submitDraft("0", value: 0, display: "0", allRequests: [0])
        try quantity("0", request: "0", requests: 1, raw: "0")
        try record("S03-correction-empty-zero")
    }
    func testS03SnapAndValidatePreserveTheirFinalPayloads() throws {
        tap("Set stepper empty")
        try focusedDraft("1.25")
        try submitDraft("1.25", value: 1, display: "1", allRequests: [1])
        tap("Toggle stepper commit validation"); tap("Set stepper empty")
        try focusedDraft("1.25")
        try submitDraft("1.25", value: 1.25, display: "1.25", allRequests: [1, 1.25])
        try invalidSubmit(flags: ["rangeOverflow", "stepMismatch"], errors: [])
        try exact(try requests(), [1, 1.25])
        try record("S03-snap-versus-validate")
    }
    func testS03MaximumStopsWithoutRequestAndReversesExactly() throws {
        tap("Set stepper maximum")
        XCTAssertFalse(button("Increase controlled quantity").isEnabled)
        tap("Increase controlled quantity")
        try exact(try requests(), [])
        tap("Decrease controlled quantity")
        XCTAssertEqual(field.value as? String, "0.9")
        tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "1")
        try exact(try requests(), [0.9, 1])
        XCTAssertFalse(button("Increase controlled quantity").isEnabled)
        try record("S03-maximum-stop-reverse")
    }
    func testS03MinimumStopsWithoutRequestAndReversesExactly() throws {
        tap("Set stepper minimum")
        XCTAssertFalse(button("Decrease controlled quantity").isEnabled)
        tap("Decrease controlled quantity")
        try exact(try requests(), [])
        tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "-0.9")
        tap("Decrease controlled quantity")
        XCTAssertEqual(field.value as? String, "-1")
        try exact(try requests(), [-0.9, -1])
        XCTAssertFalse(button("Decrease controlled quantity").isEnabled)
        try record("S03-minimum-stop-reverse")
    }
    func testS03FractionalGridUsesMinimumBaseAndAlignedMaximum() throws {
        tap("Next stepper numeric step"); tap("Next stepper numeric step")
        try exact(try config()["step"], 0.3)
        tap("Set stepper maximum")
        XCTAssertFalse(button("Increase controlled quantity").isEnabled)
        tap("Decrease controlled quantity")
        XCTAssertEqual(field.value as? String, "0.8")
        tap("Decrease controlled quantity"); tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "0.8")
        XCTAssertFalse(button("Increase controlled quantity").isEnabled)
        tap("Increase controlled quantity")
        try exact(try requests(), [0.8, 0.5, 0.8])
        tap("Set stepper minimum"); tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "-0.7")
        try exact(try requests(), [0.8, 0.5, 0.8, -0.7])
        try record("S03-fractional-grid-endpoints")
    }
    func testS03MinimumOnlyMaximumOnlyAndUnboundedSteps() throws {
        tap("Next stepper bounds"); tap("Set stepper maximum")
        try exact(try config()["bounds"], "minimum")
        tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "1.1")
        tap("Next stepper bounds"); tap("Set stepper minimum")
        try exact(try config()["bounds"], "maximum")
        tap("Decrease controlled quantity")
        XCTAssertEqual(field.value as? String, "-1.1")
        tap("Next stepper bounds"); tap("Set stepper maximum")
        try exact(try config()["bounds"], "none")
        tap("Increase controlled quantity")
        XCTAssertEqual(field.value as? String, "1.1")
        try exact(try requests(), [1.1, -1.1, 1.1])
        try record("S03-optional-bounds")
    }
    func testS03RequiredNativeAndAriaValidationTiming() throws {
        tap("Set stepper empty"); tap("Toggle stepper required")
        XCTAssertTrue(field.label.contains("Required"))
        XCTAssertFalse(field.label.contains("Invalid"))
        try invalidSubmit(flags: ["valueMissing"], errors: ["Required"])
        waitUntil("Native submit must expose the required error") { self.field.label.contains("Invalid") }
        tap("Toggle stepper aria validation"); tap("Set stepper zero")
        waitUntil("Aria validation must clear after valid owner value") { !self.field.label.contains("Invalid") }
        tap("Set stepper empty")
        waitUntil("Aria required validation must be immediate") { self.field.label.contains("Invalid") }
        try exact(try requests(), [])
        try record("S03-required-native-aria-timing")
    }
    func testS03ReadOnlyAndDisabledRequiredFormRules() throws {
        tap("Set stepper empty"); tap("Toggle stepper required"); tap("Toggle stepper read-only")
        tap("Submit stepper form")
        var result = try XCTUnwrap(try read("stepper-form-result") as? [String: Any])
        try exact(result["status"], "submitted")
        try exact(result["entries"], [["quantity", ""]])
        tap("Toggle stepper read-only"); tap("Toggle stepper disabled")
        tap("Submit stepper form")
        result = try XCTUnwrap(try read("stepper-form-result") as? [String: Any])
        try exact(result["status"], "submitted")
        try exact(result["entries"], [])
        let submits = try callbacks().filter { $0["kind"] as? String == "form:submit" }
        XCTAssertEqual(submits.count, 2)
        let data = try submits.map { try XCTUnwrap($0["data"] as? [String: Any]) }
        try exact(data[0]["entries"], [["quantity", ""]])
        try exact(data[1]["entries"], [])
        for row in data { try exact(row["originalForm"], true); try exact(row["defaultPrevented"], false) }
        try exact(try requests(), [])
        try record("S03-readonly-disabled-required-form")
    }
    func testS03CustomServerAndExplicitValidationPrecedence() throws {
        tap("Set stepper minimum"); tap("Toggle stepper custom validation")
        XCTAssertFalse(field.label.contains("Invalid"))
        tap("Toggle stepper aria validation")
        waitUntil("Aria client error did not appear") { self.field.label.contains("Quantity must be nonnegative") }
        tap("Toggle stepper server error")
        XCTAssertTrue(field.label.contains("Server quantity error"))
        XCTAssertFalse(field.label.contains("Quantity must be nonnegative"))
        tap("Next stepper explicit invalid")
        XCTAssertFalse(field.label.contains("Invalid"))
        XCTAssertFalse(field.label.contains("Server quantity error"))
        tap("Next stepper explicit invalid")
        XCTAssertTrue(field.label.contains("Invalid"))
        XCTAssertFalse(field.label.contains("Server quantity error"))
        tap("Next stepper explicit invalid")
        XCTAssertTrue(field.label.contains("Server quantity error"))
        tap("Next stepper validation state")
        XCTAssertFalse(field.label.contains("Invalid"))
        tap("Next stepper validation state")
        XCTAssertTrue(field.label.contains("Invalid"))
        tap("Next stepper validation state")
        XCTAssertTrue(field.label.contains("Server quantity error"))
        try exact(try requests(), [])
        try record("S03-validation-precedence")
    }
    func testS03RangeUnderflowSurvivesExplicitInvalidFalse() throws {
        try numericConstraint("-2", value: -2, flag: "rangeUnderflow")
    }
    func testS03RangeOverflowSurvivesExplicitInvalidFalse() throws {
        try numericConstraint("2", value: 2, flag: "rangeOverflow")
    }
    func testS03StepMismatchSurvivesExplicitInvalidFalse() throws {
        try numericConstraint("0.5", value: 0.5, flag: "stepMismatch")
    }
}
