import XCTest

// Independent addition to the existing showcase UI-test target. No dependency on the first S03 class.
// The coordinator binds genuine product/input receipts and owns all native compilation/execution.
final class StepperS03AdditionalTrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "a7917a4e0ea881fa4078806ba6a88c5b6769ba2754b876927cce66ba31cf4f44"

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        guard ProcessInfo.processInfo.environment["CODON_STEPPER_SCENE_SHA256"] == sceneSHA else {
            XCTFail("Bind the committed Stepper scene before execution")
            throw NSError(domain: "StepperS03AdditionalAdmission", code: 1)
        }
        for key in ["CODON_STEPPER_PRODUCT_SHA256", "CODON_STEPPER_INPUT_RECEIPT_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
        }
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state) else {
            XCTFail("Coordinator must prelaunch the matched product; no replacement launch")
            throw NSError(domain: "StepperS03AdditionalAdmission", code: 2)
        }
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertLessThan(app.windows.firstMatch.frame.width, app.windows.firstMatch.frame.height)
        tap("Reset scene"); tap("Stepper scene")
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertEqual(field.value as? String, "0")
        try exact(try callbacks(), [])
        try exact(try config()["generation"], 0)
    }

    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = "stepper-s03-additional-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "stepper-s03-additional-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        // No failure-path retry, reset, blur or replacement activation.
    }

    private var field: XCUIElement { app.textFields.matching(identifier: "stepper-example-input").firstMatch }
    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
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
        let target = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        XCTAssertTrue(target.waitForExistence(timeout: 10), "Missing " + label)
        reveal(target); target.tap()
    }
    private func read(_ id: String) throws -> Any {
        let target = node(id)
        XCTAssertTrue(target.waitForExistence(timeout: 10))
        return try JSONSerialization.jsonObject(with: Data(target.label.utf8), options: .fragmentsAllowed)
    }
    private func config() throws -> [String: Any] { try XCTUnwrap(try read("stepper-config") as? [String: Any]) }
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
    private func waitUntil(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }
    private func owner(_ value: String, request: String, count: Int, raw: String) {
        let state = node("stepper-state").label
        XCTAssertTrue(state.hasPrefix("Value: \(value). Request: \(request). Requests: \(count). Raw: \(raw). Parent: "), state)
    }
    private func record(_ stage: String) throws {
        let window = app.windows.firstMatch.frame
        let payload: [String: Any] = [
            "stage": stage, "sceneSHA256": sceneSHA, "capturedAt": Date().timeIntervalSince1970,
            "state": node("stepper-state").label, "config": try config(), "callbacks": try callbacks(),
            "refs": try read("stepper-refs"), "fieldValue": field.value as? String ?? "absent",
            "fieldLabel": field.label, "keyboardActive": app.keyboards.firstMatch.exists,
            "formResult": try read("stepper-form-result"),
            "window": [window.minX, window.minY, window.width, window.height],
            "scope": "Additional S03 public outcomes only; genuine SDK original-event/ref and process receipts remain separate"
        ]
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: payload,
                                  options: [.prettyPrinted, .sortedKeys]), uniformTypeIdentifier: "public.json")
        attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func focus() {
        reveal(field); field.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
    }
    private func draft(_ raw: String) throws {
        focus()
        field.typeText(raw) // One unpaced call, never generated JS callbacks or paced characters.
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        XCTAssertEqual(field.value as? String, raw)
        let events = try callbacks()
        try exact(events.filter { $0["kind"] as? String == "raw" }.last?["data"], raw)
        let changes = try events.filter { $0["kind"] as? String == "native:change" }
            .map { try XCTUnwrap($0["data"] as? [String: Any]) }
        try exact(changes.last?["text"], raw)
        XCTAssertGreaterThan(try XCTUnwrap(changes.last?["target"] as? Int), 0)
        try record("S03-additional-focused-" + raw)
    }
    private func commit(_ raw: String, display: String, expectedRequests: [Any]) throws {
        let before = try callbacks().filter { ["native:submit", "native:end"].contains($0["kind"] as? String ?? "") }.count
        let endedBefore = try callbacks().filter { $0["kind"] as? String == "native:end" }.count
        field.typeText("\n")
        waitUntil("Original final event was not delivered") {
            (try? self.callbacks().filter { $0["kind"] as? String == "native:end" }.count) == endedBefore + 1
        }
        XCTAssertEqual(field.value as? String, display)
        try exact(try requests(), expectedRequests)
        let finals = try callbacks().filter { ["native:submit", "native:end"].contains($0["kind"] as? String ?? "") }
        XCTAssertEqual(finals.count, before + 2)
        try exact(finals.suffix(2).map { $0["kind"] as? String ?? "" }, ["native:submit", "native:end"])
        for row in finals.suffix(2) { try exact(row["data"], raw) }
    }
    private func formattedEdit(_ index: Int, name: String, french: Bool, raw: String,
                               value: Double, display: String) throws {
        for _ in 0..<index { tap("Next stepper numeric format") }
        if french { tap("Toggle stepper locale") }
        tap("Next stepper numeric step"); tap("Set stepper empty")
        try exact(try config()["format"], name)
        try exact(try config()["step"], "undefined")
        let originalRefs = try read("stepper-refs")
        try draft(raw)
        owner("empty", request: "none", count: 0, raw: raw)
        try exact(try requests(), [])
        try commit(raw, display: display, expectedRequests: [value])
        let number = String(value)
        owner(number, request: number, count: 1, raw: raw)
        try exact(try read("stepper-refs"), originalRefs)
        try record("S03-additional-parse-" + name + (french ? "-fr" : "-en"))
    }
    private func partials(_ french: Bool) throws {
        if french { tap("Toggle stepper locale") }
        tap("Set stepper empty")
        for raw in (french ? ["-", ",", "-,"] : ["-", ".", "-."]) {
            XCTAssertEqual(field.value as? String, "")
            try draft(raw)
            owner("empty", request: "none", count: 0, raw: raw)
            try exact(try requests(), [])
            try commit(raw, display: "", expectedRequests: [])
            owner("empty", request: "none", count: 0, raw: raw)
            try record("S03-additional-partial-" + raw)
        }
    }
    private func invalidForm(_ message: [String]) throws {
        tap("Submit stepper form")
        let result = try XCTUnwrap(try read("stepper-form-result") as? [String: Any])
        try exact(result["status"], "invalid") // A retired/unavailable native action never passes.
        let fields = try XCTUnwrap(result["invalidFields"] as? [[String: Any]])
        XCTAssertEqual(fields.count, 1)
        let field = try XCTUnwrap(fields.first)
        XCTAssertFalse(try XCTUnwrap(field["descriptorId"] as? String).isEmpty)
        let validation = try XCTUnwrap(field["validation"] as? [String: Any])
        try exact(validation["isInvalid"], true)
        try exact(validation["validationErrors"], message)
        var details = Dictionary(uniqueKeysWithValues: ["badInput", "customError", "patternMismatch", "rangeOverflow",
            "rangeUnderflow", "stepMismatch", "tooLong", "tooShort", "typeMismatch", "valueMissing", "valid"].map { ($0, false) })
        details["customError"] = true
        try exact(validation["validationDetails"], details)
        try exact(try callbacks().filter { $0["kind"] as? String == "form:submit" }, [])
    }
    private func submittedForm(_ entries: [[String]]) throws {
        tap("Submit stepper form")
        let result = try XCTUnwrap(try read("stepper-form-result") as? [String: Any])
        try exact(result["status"], "submitted")
        try exact(result["entries"], entries)
        let submits = try callbacks().filter { $0["kind"] as? String == "form:submit" }
        XCTAssertEqual(submits.count, 1)
        let data = try XCTUnwrap(submits.first?["data"] as? [String: Any])
        try exact(data["entries"], entries)
        try exact(data["originalForm"], true)
        try exact(data["defaultPrevented"], false)
    }

    func testS03FixedFractionNativeParseEnglish() throws {
        try formattedEdit(1, name: "decimal-2", french: false, raw: "0.145", value: 0.15, display: "0.15")
    }
    func testS03FixedFractionNativeParseFrench() throws {
        try formattedEdit(1, name: "decimal-2", french: true, raw: "0,145", value: 0.15, display: "0,15")
    }
    func testS03CurrencyNativeNumericDraftEnglish() throws {
        try formattedEdit(2, name: "currency", french: false, raw: "-0.4", value: -0.4, display: "(CA$0.40)")
    }
    func testS03CurrencyNativeNumericDraftFrench() throws {
        try formattedEdit(2, name: "currency", french: true, raw: "-0,4", value: -0.4, display: "(0,40\u{00a0}$)")
    }
    func testS03PercentNativeParseEnglish() throws {
        try formattedEdit(3, name: "percent", french: false, raw: "12", value: 0.12, display: "12%")
    }
    func testS03PercentNativeParseFrench() throws {
        try formattedEdit(3, name: "percent", french: true, raw: "12", value: 0.12, display: "12\u{00a0}%")
    }
    func testS03UnitNativeNumericDraftEnglish() throws {
        try formattedEdit(4, name: "unit", french: false, raw: "0.4", value: 0.4, display: "0.4 liters")
    }
    func testS03UnitNativeNumericDraftFrench() throws {
        try formattedEdit(4, name: "unit", french: true, raw: "0,4", value: 0.4, display: "0,4\u{00a0}litre")
    }
    func testS03IncompleteNativeDraftsEnglish() throws { try partials(false) }
    func testS03IncompleteNativeDraftsFrench() throws { try partials(true) }
    func testS03ExplicitZeroSelectionControlsNativeInsertion() throws {
        tap("Toggle stepper zero selection")
        try exact(try config()["selection"], ["start": 0, "end": 0])
        focus()
        waitUntil("Original native zero selection was not observed") {
            (try? self.callbacks().filter { $0["kind"] as? String == "native:selection" }.last?["data"] as? [String: Int]) == ["start": 0, "end": 0]
        }
        field.typeText("1")
        XCTAssertEqual(field.value as? String, "10")
        XCTAssertTrue(app.keyboards.firstMatch.exists)
        owner("0", request: "none", count: 0, raw: "10")
        try exact(try requests(), [])
        try record("S03-additional-native-zero-selection")
        try commit("10", display: "1", expectedRequests: [1])
        owner("1", request: "1", count: 1, raw: "10")
    }
    func testS03AriaRequiredErrorDoesNotBlockNativeSubmit() throws {
        tap("Set stepper empty"); tap("Toggle stepper required"); tap("Toggle stepper aria validation")
        waitUntil("Aria required error was not displayed") { self.field.label.contains("Required") && self.field.label.contains("Invalid") }
        try submittedForm([["quantity", ""]])
        owner("empty", request: "none", count: 0, raw: "empty")
        try exact(try requests(), [])
        try record("S03-additional-aria-required-submit")
    }
    func testS03NativeCustomErrorBlocksSubmit() throws {
        tap("Set stepper minimum"); tap("Toggle stepper custom validation")
        XCTAssertFalse(field.label.contains("Invalid"))
        try invalidForm(["Quantity must be nonnegative"])
        waitUntil("Native custom error was not committed to display") { self.field.label.contains("Quantity must be nonnegative") }
        try exact(try requests(), [])
        try record("S03-additional-native-client-error")
    }
    func testS03NativeServerErrorBlocksSubmit() throws {
        tap("Toggle stepper server error")
        XCTAssertTrue(field.label.contains("Server quantity error"))
        try invalidForm(["Server quantity error"])
        try exact(try requests(), [])
        try record("S03-additional-native-server-error")
    }
    func testS03ExplicitInvalidTrueBlocksNativeSubmit() throws {
        tap("Next stepper explicit invalid"); tap("Next stepper explicit invalid")
        try exact(try config()["isInvalid"], true)
        try invalidForm([])
        try exact(try requests(), [])
        try record("S03-additional-controlled-invalid-submit")
    }
    func testS03LegacyInvalidValidationStateBlocksNativeSubmit() throws {
        tap("Next stepper validation state"); tap("Next stepper validation state")
        try exact(try config()["validationState"], "invalid")
        try invalidForm([])
        try exact(try requests(), [])
        try record("S03-additional-legacy-invalid-submit")
    }
    func testS03ValidNativeCommitClearsClientValidation() throws {
        tap("Set stepper minimum"); tap("Toggle stepper custom validation")
        try invalidForm(["Quantity must be nonnegative"])
        tap("Set stepper empty")
        try draft("0.4")
        try commit("0.4", display: "0.4", expectedRequests: [0.4])
        waitUntil("Valid committed quantity did not clear the client error") { !self.field.label.contains("Invalid") }
        try submittedForm([["quantity", "0.4"]])
        try exact(try requests(), [0.4])
        try record("S03-additional-valid-edit-clears-client-error")
    }
}
