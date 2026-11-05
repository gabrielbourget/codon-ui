import XCTest

final class TextAreaG02TrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let sceneSHA = "4e3f0ef02ec91201f51aa22b9759646f64a8b343ce34cc15d2523d96f18ff032"
    private let notes = "Bonjour Montréal\nComplete second line"
    private let finalText = "Bonjour final"
    private var longNotes: String { (1...16).map { "Line \($0): Bonjour Montréal — preserve complete native text and scrolling." }.joined(separator: "\n") }
    override func setUpWithError() throws {
        continueAfterFailure = false; executionTimeAllowance = 180
        XCTAssertEqual(ProcessInfo.processInfo.environment["CODON_TEXTAREA_4e3f0ef02ec91201f51aa22b9759646f64a8b343ce34cc15d2523d96f18ff032256"], sceneSHA)
        for key in ["CODON_FIXTURE_PRODUCT_SHA256", "CODON_TEXTAREA_NATIVE_ADMISSION_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key]); XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        XCTAssertTrue([.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(app.state), "Coordinator prelaunches the admitted product")
        app.activate(); XCTAssertEqual(app.state, .runningForeground)
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        XCTAssertTrue(node("textarea-g02-owner").waitForExistence(timeout: 10))
    }
    override func tearDownWithError() throws {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); image.name = "textarea-final-screen"; image.lifetime = .keepAlways; add(image)
        let tree = XCTAttachment(string: app.debugDescription); tree.name = "textarea-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
    }
    private func node(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func editor(_ field: String = "draft") -> XCUIElement { node("multiline-" + field) }
    private func button(_ name: String) -> XCUIElement { app.buttons.matching(NSPredicate(format: "label == %@", name)).firstMatch }
    private func wait(_ message: String, _ predicate: @escaping () -> Bool) {
        let e = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [e], timeout: 10), .completed, message)
    }
    private func reveal(_ target: XCUIElement) {
        for _ in 0..<10 {
            if target.exists && target.isHittable { return }
            let scroll = app.scrollViews.matching(identifier: "showcase-scroll").firstMatch; XCTAssertTrue(scroll.exists && scroll.isHittable)
            if target.exists && target.frame.minY < scroll.frame.minY { scroll.swipeDown() } else { scroll.swipeUp() }
        }
        XCTAssertTrue(target.exists && target.isHittable, "Actual target must be reachable")
    }
    private func tap(_ name: String) { let target = button(name); XCTAssertTrue(target.waitForExistence(timeout: 10)); reveal(target); target.tap() }
    private func json(_ id: String) throws -> Any { let target = node(id); XCTAssertTrue(target.waitForExistence(timeout: 10)); return try JSONSerialization.jsonObject(with: Data(target.label.utf8), options: .fragmentsAllowed) }
    private func dict(_ id: String) throws -> [String: Any] { try XCTUnwrap(try json(id) as? [String: Any]) }
    private func exact(_ a: Any?, _ b: Any) throws { let a = try XCTUnwrap(a); XCTAssertEqual(try JSONSerialization.data(withJSONObject: ["v": a], options: .sortedKeys), try JSONSerialization.data(withJSONObject: ["v": b], options: .sortedKeys)) }
    private func rows(_ field: String = "draft", _ kind: String? = nil) throws -> [[String: Any]] {
        try XCTUnwrap(try json("textarea-g02-events") as? [[String: Any]]).filter { $0["field"] as? String == field && (kind == nil || $0["kind"] as? String == kind) }
    }
    private func refs() throws -> Any { try json("textarea-g02-refs") }
    private func raw(_ field: String = "draft") throws -> [Any] { try rows(field, "raw").map { try XCTUnwrap($0["data"]) } }
    private func owner(_ field: String = "draft") throws -> String { try XCTUnwrap(try dict("textarea-g02-owner")[field == "submit" ? "submitDraft" : "draft"] as? String) }
    private func record(_ stage: String) throws {
        var data: [String: Any] = ["stage": stage, "sceneSHA256": sceneSHA, "keyboardActive": app.keyboards.firstMatch.exists, "scope": "Public native outcomes plus actual caller receipts; independent original-native witness remains required"]
        for key in ["owner", "config", "refs", "frames", "events", "retired"] { data[key] = try json("textarea-g02-" + key) }
        let frame = app.windows.firstMatch.frame; data["window"] = [frame.minX, frame.minY, frame.width, frame.height]
        for field in ["draft", "submit", "long"] { let e = editor(field); if e.exists { let f = e.frame; let value: Any = e.value ?? NSNull(); data[field] = ["value": value, "frame": [f.minX, f.minY, f.width, f.height], "hittable": e.isHittable] } }
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: data, options: [.sortedKeys, .prettyPrinted]), uniformTypeIdentifier: "public.json"); attachment.name = stage; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func reset() throws { tap("Reset scene"); tap("Multiline/Radio scene"); XCTAssertTrue(editor().waitForExistence(timeout: 10)); try exact(try owner(), ""); try exact(try raw(), []) }
    private func focus(_ field: String = "draft") { let e = editor(field); reveal(e); e.tap(); XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10)) }
    private func agree(_ field: String, _ text: String, held: String? = nil) throws {
        XCTAssertEqual(editor(field).value as? String, held ?? text); try exact(try owner(field), held ?? text)
        let change = try XCTUnwrap(try rows(field, "native:change").last?["data"] as? [String: Any]); try exact(change["text"], text); try exact(try raw(field).last, text)
        let ref = try XCTUnwrap(try dict("textarea-g02-refs")[field] as? [String: Any]); try exact(change["target"], try XCTUnwrap(ref["nativeTag"]))
        let edits = try rows(field).filter { ["native:change", "raw"].contains($0["kind"] as? String ?? "") }
        XCTAssertEqual(edits.count % 2, 0)
        for index in stride(from: 0, to: edits.count, by: 2) {
            guard index + 1 < edits.count else { XCTFail("Unpaired native/raw callback"); return }
            try exact([edits[index]["kind"]!, edits[index + 1]["kind"]!], ["native:change", "raw"])
            let native = try XCTUnwrap(edits[index]["data"] as? [String: Any]); try exact(native["text"], try XCTUnwrap(edits[index + 1]["data"]))
        }
    }
    private func initial() throws {
        try reset(); XCTAssertEqual(editor().value as? String, ""); XCTAssertEqual(editor("submit").value as? String, ""); XCTAssertEqual(editor("long").value as? String, longNotes)
        wait("Initial actual root layout must be delivered") { guard let frame = try? self.dict("textarea-g02-frames")["draft"] as? [String: Any] else { return false }; return frame["height"] as? Double == 96 }
        let frame = try XCTUnwrap(try dict("textarea-g02-frames")["draft"] as? [String: Any]); try exact(frame["height"], 96)
        for field in ["draft", "submit", "long"] { try exact(try raw(field), []); XCTAssertTrue(try rows(field, "native:change").isEmpty) }; try record("S01-initial")
    }
    private func programmatic(_ empty: Bool) throws {
        try reset(); if empty { tap("G02 set multiline owner text") }; let original = try refs(); let before = try rows().filter { ["native:change", "raw"].contains($0["kind"] as? String ?? "") }
        tap(empty ? "G02 set multiline owner empty" : "G02 set multiline owner text")
        let expected = empty ? "" : notes; XCTAssertEqual(editor().value as? String, expected); XCTAssertEqual(editor("submit").value as? String, expected)
        try exact(try owner(), expected); try exact(try rows().filter { ["native:change", "raw"].contains($0["kind"] as? String ?? "") }, before); try exact(try refs(), original); try record("S01-programmatic-\(empty)")
    }
    private func repeatedVeto() throws {
        try reset(); tap("G02 set multiline owner text"); tap("G02 toggle multiline owner veto"); let original = try refs(); focus()
        for text in ["X", "Y"] { let count = try raw().count; editor().typeKey("a", modifierFlags: .command); editor().typeText(text); try agree("draft", text, held: notes); XCTAssertEqual(try raw().count, count + 1); XCTAssertTrue(app.keyboards.firstMatch.exists) }
        try exact(try refs(), original); try record("S01-repeated-veto")
    }
    private func defaultCase(_ count: Int, remount: Bool) throws {
        try reset(); let original = try refs(); let before = try rows("long").filter { ["native:change", "raw"].contains($0["kind"] as? String ?? "") }
        for _ in 0..<count { tap("G02 next long default") }
        if remount { tap("G02 remount multiline editors") }
        let expected = remount ? (count == 1 ? "Alternate uncontrolled notes" : "") : longNotes
        XCTAssertEqual(editor("long").value as? String, expected)
        if remount { try exact(try dict("textarea-g02-owner")["generation"], 1) } else { try exact(try refs(), original); try exact(try rows("long").filter { ["native:change", "raw"].contains($0["kind"] as? String ?? "") }, before) }
        try exact(try raw("long"), []); try record("S01-default-\(count)-remount-\(remount)")
    }
    private func freshInput() throws { try reset(); let original = try refs(); focus(); editor().typeText(notes); try agree("draft", notes); XCTAssertTrue(app.keyboards.firstMatch.exists); try exact(try refs(), original); try record("S03-fresh-unpaced") }
    private func returnCase(_ field: String, mode: Int) throws {
        try reset(); for _ in 0..<mode { tap("G02 next multiline submit mode") }; let original = try refs(); focus(field)
        let text = field == "draft" ? "A" : finalText; editor(field).typeText(text); try agree(field, text)
        editor(field).typeText("\n")
        if field == "draft" || mode == 2 { try agree(field, text + "\n"); XCTAssertTrue(try rows(field, "native:submit").isEmpty); XCTAssertTrue(app.keyboards.firstMatch.exists) }
        else { try exact(try rows(field, "native:submit").map { $0["data"]! }, [text]); try exact(try dict("textarea-g02-owner")["submitted"], text); try exact(try dict("textarea-g02-owner")["submits"], 1); XCTAssertEqual(editor(field).value as? String, text)
            if mode == 0 { wait("blurAndSubmit must close the keyboard") { !self.app.keyboards.firstMatch.exists }; try exact(try rows(field, "native:end").map { $0["data"]! }, [text]) }
            else { XCTAssertTrue(app.keyboards.firstMatch.exists); XCTAssertTrue(try rows(field, "native:end").isEmpty) }
        }
        try exact(try refs(), original); try record("S03-return-\(field)-\(mode)")
    }
    private func correction() throws {
        try reset(); tap("G02 set multiline owner text"); let original = try refs(); focus(); editor().typeKey("a", modifierFlags: .command)
        let selection = try XCTUnwrap(try rows("draft", "native:selection").last?["data"] as? [String: Any]); try exact(selection["start"], 0); try exact(selection["end"], notes.utf16.count)
        editor().typeText("Corrected\nMontréal"); try agree("draft", "Corrected\nMontréal"); try exact(try refs(), original); try record("S03-selection-correction")
    }
    private func deleteToEmpty() throws {
        try reset(); tap("G02 set multiline owner text"); let original = try refs(); focus(); editor().typeKey("a", modifierFlags: .command)
        let count = try raw().count; editor().typeKey(.delete, modifierFlags: [])
        try agree("draft", ""); XCTAssertEqual(try raw().count, count + 1); XCTAssertTrue(app.keyboards.firstMatch.exists)
        try exact(try refs(), original); try record("S03-delete-empty")
    }
    private func paste() throws {
        try reset(); let original = try refs(); focus(); editor().typeText(notes); try agree("draft", notes)
        editor().typeKey("a", modifierFlags: .command); editor().typeKey("c", modifierFlags: .command)
        tap("G02 set multiline owner empty"); focus(); let count = try raw().count
        try record("S03-before-real-paste"); editor().typeKey("v", modifierFlags: .command)
        try agree("draft", notes); XCTAssertEqual(try raw().count, count + 1); XCTAssertTrue(app.keyboards.firstMatch.exists)
        try exact(try refs(), original); try record("S03-real-paste")
    }
    private func internalScroll() throws {
        try reset(); let e = editor("long"); reveal(e); let original = try refs(); let before = try raw("long"); e.swipeUp()
        let offset = try XCTUnwrap(try rows("long", "native:scroll").last?["data"] as? [String: Any]); XCTAssertGreaterThan(try XCTUnwrap(offset["y"] as? Double), 0)
        XCTAssertEqual(e.value as? String, longNotes); let frame = try XCTUnwrap(try dict("textarea-g02-frames")["long"] as? [String: Any]); try exact(frame["height"], 96); XCTAssertGreaterThan(e.frame.height, 0); XCTAssertLessThanOrEqual(e.frame.height, 96); try exact(try raw("long"), before); try exact(try refs(), original); try record("S03-internal-scroll")
    }
    private func guardCase(_ flag: String, restore: Bool) throws {
        try reset(); if flag == "ReadOnly" && !restore { tap("G02 set multiline owner text") }
        let action = "Toggle multiline " + (flag == "Disabled" ? "disabled" : "read-only"); tap(action); let original = try refs()
        if restore { tap(action); focus(); editor().typeText("X"); try agree("draft", "X") }
        else { let e = editor()
            if flag == "Disabled" {
                for _ in 0..<10 {
                    let scroll = app.scrollViews.matching(identifier: "showcase-scroll").firstMatch
                    if e.exists && e.frame.width > 0 && e.frame.height > 0 && scroll.frame.contains(e.frame) { break }
                    if e.exists && e.frame.minY < scroll.frame.minY { scroll.swipeDown() } else { scroll.swipeUp() }
                }
                XCTAssertTrue(e.exists && app.scrollViews.matching(identifier: "showcase-scroll").firstMatch.frame.contains(e.frame))
                XCTAssertFalse(app.keyboards.firstMatch.exists); XCTAssertFalse(e.isEnabled); e.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); XCTAssertFalse(app.keyboards.firstMatch.exists); XCTAssertTrue(try rows("draft", "native:focus").isEmpty) }
            else { reveal(e); XCTAssertTrue(e.isEnabled); e.tap(); XCTAssertFalse(app.keyboards.firstMatch.exists) }
            let expected = flag == "ReadOnly" ? notes : ""
            XCTAssertEqual(e.value as? String, expected); try exact(try owner(), expected); try exact(try raw(), []); XCTAssertTrue(try rows("draft", "native:change").isEmpty)
        }
        try exact(try refs(), original); try record("S02-guard-\(flag)-restore-\(restore)")
    }
    private func combinedGuards() throws {
        try reset(); tap("Toggle multiline disabled"); tap("Toggle multiline read-only"); XCTAssertFalse(editor().isEnabled)
        tap("Toggle multiline disabled"); XCTAssertTrue(editor().isEnabled); try exact(try raw(), []); try exact(try owner(), "")
        tap("Toggle multiline read-only"); focus(); editor().typeText("X"); try agree("draft", "X"); try record("S02-guards-restored")
    }
    private func presentation(_ axis: String, action: String, field: String, expected: String, prior: Int) throws {
        try reset(); tap("G02 set multiline owner text"); tap("G02 toggle multiline owner veto"); for _ in 0..<prior { tap(action) }; let original = try refs(); let before = try raw()
        tap(action); let config = try dict("textarea-g02-config")
        let actual = config[field].map { String(describing: $0) } ?? "missing"
        if field == "statusMask" { let mask = Int(expected)!; try exact(config["errorState"], mask & 1 != 0); try exact(config["warningState"], mask & 2 != 0); try exact(config["successState"], mask & 4 != 0) }
        else if ["custom", "enableFocusStyle", "offsetFocusRing", "defaultRenderer"].contains(field) { try exact(config[field], expected == "true") }
        else { XCTAssertEqual(actual, expected) }
        let zero = (field == "width" || field == "height") && expected == "0"
        try exact(try owner(), notes); if !zero { XCTAssertEqual(editor().value as? String, notes) }; try exact(try raw(), before); try exact(try refs(), original)
        if zero {
            wait("Actual delivered native layout must resolve the explicit zero constraint") { guard let frame = try? self.dict("textarea-g02-frames")["draft"] as? [String: Any] else { return false }; return (frame[field] as? Double) == 0 }
            try record("S05-actual-zero-" + field); tap(action)
        }
        focus(); editor().typeKey("a", modifierFlags: .command); editor().typeText("X"); try agree("draft", "X", held: notes); XCTAssertEqual(try raw().count, before.count + 1)
        try exact(try refs(), original); try record("S05-presentation-\(axis)-\(expected)")
    }
    private func context(_ kind: String) throws {
        try reset(); tap("G02 set multiline owner text"); tap("G02 toggle multiline owner veto"); let original = try refs(); let ownerID = try dict("textarea-g02-owner")["owner"]; let before = try raw()
        if kind == "theme" { XCTAssertTrue(button("Light theme").isSelected); tap("Dark theme"); XCTAssertTrue(button("Dark theme").isSelected) }
        else if kind == "fixture" { XCTAssertTrue(button("Live window").isSelected); tap("Vertical blocked region"); XCTAssertTrue(button("Vertical blocked region").isSelected) }
        else { XCUIDevice.shared.orientation = .landscapeLeft; wait("Actual landscape window") { let f = self.app.windows.firstMatch.frame; return f.width > f.height }; try exact(try owner(), notes); try exact(try refs(), original); try record("S05-landscape"); XCUIDevice.shared.orientation = .portrait; wait("Actual portrait window") { let f = self.app.windows.firstMatch.frame; return f.width < f.height } }
        try exact(try dict("textarea-g02-owner")["owner"], try XCTUnwrap(ownerID)); try exact(try owner(), notes); try exact(try raw(), before); try exact(try refs(), original)
        let dismiss = button("G02 dismiss multiline keyboard"); reveal(dismiss); focus(); XCTAssertTrue(dismiss.isHittable); editor().typeKey("a", modifierFlags: .command); editor().typeText("X"); try agree("draft", "X", held: notes)
        dismiss.tap(); wait("First local keyboard-active action must dismiss") { !self.app.keyboards.firstMatch.exists }; try exact(try owner(), notes); try exact(try refs(), original); try record("S05-context-" + kind)
        if kind == "theme" { tap("Light theme") }; if kind == "fixture" { tap("Live window") }
    }
    private func lifecycle(_ remount: Bool) throws {
        try reset(); tap("G02 set multiline owner text"); let original = try refs(); let before = try raw()
        if remount { tap("G02 remount multiline editors") }
        else { let remove = button("G02 remove multiline editors"); reveal(remove); focus(); XCTAssertTrue(remove.isHittable); remove.tap(); wait("Actual old editors and keyboard must retire") { !self.editor().exists && !self.app.keyboards.firstMatch.exists }; try exact(try owner(), notes); try exact(try raw(), before); tap("Focus multiline notes"); XCTAssertFalse(app.keyboards.firstMatch.exists); try exact(try owner(), notes); try record("S06-removed"); tap("G02 reinsert multiline editors") }
        XCTAssertTrue(editor().waitForExistence(timeout: 10)); XCTAssertEqual(editor().value as? String, notes); try exact(try owner(), notes); try exact(try raw(), before)
        let old = try XCTUnwrap(original as? [String: [String: Any]]); let now = try dict("textarea-g02-refs")
        for field in ["draft", "submit", "long"] { let ref = try XCTUnwrap(now[field] as? [String: Any]); XCTAssertEqual(try XCTUnwrap(ref["attachments"] as? Int), try XCTUnwrap(old[field]?["attachments"] as? Int) + 1); XCTAssertEqual(try XCTUnwrap(ref["detachments"] as? Int), try XCTUnwrap(old[field]?["detachments"] as? Int) + 1) }
        XCTAssertFalse(app.keyboards.firstMatch.exists); try record("S06-restored-original-owner")
    }
    private func retirement() throws {
        let oldOwner = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_TEXTAREA_RETIRED_OWNER"])
        let nativeACK = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_TEXTAREA_RETIREMENT_RECEIPT_SHA256"]); XCTAssertNotNil(nativeACK.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        tap("G02 read multiline retirement"); let retired = try dict("textarea-g02-retired"); try exact(retired["owner"], oldOwner); try exact(retired["unmounted"], true)
        let events = try XCTUnwrap(retired["events"] as? [[String: Any]])
        XCTAssertTrue(events.filter { $0["afterUnmount"] as? Bool == true && $0["kind"] as? String != "ref" }.isEmpty)
        try exact(try owner(), ""); XCTAssertFalse(app.keyboards.firstMatch.exists); try record("S06-old-owner-retirement")
    }
    @objc func testS01Initial() throws { try initial() }
    @objc func testS01OwnerText() throws { try programmatic(false) }
    @objc func testS01OwnerEmpty() throws { try programmatic(true) }
    @objc func testS01RepeatedVeto() throws { try repeatedVeto() }
    @objc func testS01DefaultOnce() throws { try defaultCase(1, remount: false) }
    @objc func testS01DefaultRemountReplacement() throws { try defaultCase(1, remount: true) }
    @objc func testS01DefaultRemountEmpty() throws { try defaultCase(2, remount: true) }
    @objc func testS01DefaultRemountUndefined() throws { try defaultCase(3, remount: true) }
    @objc func testS03FreshUnpaced() throws { try freshInput() }
    @objc func testS03ReturnNewline() throws { try returnCase("draft", mode: 0) }
    @objc func testS03BlurAndSubmit() throws { try returnCase("submit", mode: 0) }
    @objc func testS03SubmitWithoutBlur() throws { try returnCase("submit", mode: 1) }
    @objc func testS03ExplicitNewline() throws { try returnCase("submit", mode: 2) }
    @objc func testS03SelectionCorrection() throws { try correction() }
    @objc func testS03DeleteToEmpty() throws { try deleteToEmpty() }
    @objc func testS03GenuineCopyPaste() throws { try paste() }
    @objc func testS03InternalScroll() throws { try internalScroll() }
    @objc func testS02Disabled() throws { try guardCase("Disabled", restore: false) }
    @objc func testS02DisabledFalse() throws { try guardCase("Disabled", restore: true) }
    @objc func testS02ReadOnly() throws { try guardCase("ReadOnly", restore: false) }
    @objc func testS02ReadOnlyFalse() throws { try guardCase("ReadOnly", restore: true) }
    @objc func testS02CombinedGuards() throws { try combinedGuards() }
    @objc func testS05GeometryRound() throws { try presentation("Geometry", action: "Next radio geometry", field: "geometry", expected: "round", prior: 0) }
    @objc func testS05GeometryOrthogonal() throws { try presentation("Geometry", action: "Next radio geometry", field: "geometry", expected: "orthogonal", prior: 1) }
    @objc func testS05GeometryRounded() throws { try presentation("Geometry", action: "Next radio geometry", field: "geometry", expected: "rounded", prior: 2) }
    @objc func testS05SizeSmall() throws { try presentation("Size", action: "G02 next multiline text size", field: "textSize", expected: "small", prior: 0) }
    @objc func testS05SizeLarge() throws { try presentation("Size", action: "G02 next multiline text size", field: "textSize", expected: "large", prior: 1) }
    @objc func testS05SizeMedium() throws { try presentation("Size", action: "G02 next multiline text size", field: "textSize", expected: "medium", prior: 2) }
    @objc func testS05Status1() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "1", prior: 0) }
    @objc func testS05Status2() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "2", prior: 1) }
    @objc func testS05Status3() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "3", prior: 2) }
    @objc func testS05Status4() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "4", prior: 3) }
    @objc func testS05Status5() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "5", prior: 4) }
    @objc func testS05Status6() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "6", prior: 5) }
    @objc func testS05Status7() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "7", prior: 6) }
    @objc func testS05Status0() throws { try presentation("Status", action: "G02 next multiline status", field: "statusMask", expected: "0", prior: 7) }
    @objc func testS05StylesTrue() throws { try presentation("Styles", action: "Toggle multiline styles", field: "custom", expected: "true", prior: 0) }
    @objc func testS05StylesFalse() throws { try presentation("Styles", action: "Toggle multiline styles", field: "custom", expected: "false", prior: 1) }
    @objc func testS05Height144() throws { try presentation("Height", action: "G02 next multiline height", field: "height", expected: "144", prior: 0) }
    @objc func testS05Height0() throws { try presentation("Height", action: "G02 next multiline height", field: "height", expected: "0", prior: 1) }
    @objc func testS05Height96() throws { try presentation("Height", action: "G02 next multiline height", field: "height", expected: "96", prior: 2) }
    @objc func testS05Width0() throws { try presentation("Width", action: "G02 next multiline width", field: "width", expected: "0", prior: 0) }
    @objc func testS05WidthUndefined() throws { try presentation("Width", action: "G02 next multiline width", field: "width", expected: "undefined", prior: 1) }
    @objc func testS05Width100Percent() throws { try presentation("Width", action: "G02 next multiline width", field: "width", expected: "100%", prior: 2) }
    @objc func testS05FocusStyleFalse() throws { try presentation("FocusStyle", action: "G02 toggle multiline focus style", field: "enableFocusStyle", expected: "false", prior: 0) }
    @objc func testS05FocusStyleTrue() throws { try presentation("FocusStyle", action: "G02 toggle multiline focus style", field: "enableFocusStyle", expected: "true", prior: 1) }
    @objc func testS05FocusOffsetFalse() throws { try presentation("FocusOffset", action: "G02 toggle multiline focus offset", field: "offsetFocusRing", expected: "false", prior: 0) }
    @objc func testS05FocusOffsetTrue() throws { try presentation("FocusOffset", action: "G02 toggle multiline focus offset", field: "offsetFocusRing", expected: "true", prior: 1) }
    @objc func testS05RendererTrue() throws { try presentation("Renderer", action: "G02 toggle multiline renderer", field: "defaultRenderer", expected: "true", prior: 0) }
    @objc func testS05RendererFalse() throws { try presentation("Renderer", action: "G02 toggle multiline renderer", field: "defaultRenderer", expected: "false", prior: 1) }
    @objc func testS05ContextTheme() throws { try context("theme") }
    @objc func testS05ContextFixture() throws { try context("fixture") }
    @objc func testS05ContextWindow() throws { try context("window") }
    @objc func testS06RemoveReinsert() throws { try lifecycle(false) }
    @objc func testS06ExplicitRemount() throws { try lifecycle(true) }
    @objc func testS06ObserveSceneRetirement() throws { try retirement() }
}
