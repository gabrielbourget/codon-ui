import XCTest
import UIKit

final class CodonPrimitiveTrialTests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "dev.codonui.primitivetrial")
    private let phrase = "Native query text"
    override func setUpWithError() throws { continueAfterFailure = false }
    override func tearDownWithError() throws {
        if (testRun?.failureCount ?? 0) > 0 { capture("method-failure-after-diagnostic", ["diag-owner", "diag-trace-json", "diag-field-input"]) }
        XCUIDevice.shared.orientation = .portrait
    }
    private func now() -> Double { Date().timeIntervalSince1970 * 1000 }
    private func node(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func wait(_ id: String) { XCTAssertTrue(node(id).waitForExistence(timeout: 15), "Missing \(id)") }
    private func tap(_ id: String) { wait(id); XCTAssertTrue(node(id).isHittable, "Not hittable \(id)"); node(id).tap() }
    private func attach(_ name: String, _ data: [String: Any]) {
        let bytes = try! JSONSerialization.data(withJSONObject: data, options: [.prettyPrinted, .sortedKeys])
        let attachment = XCTAttachment(data: bytes, uniformTypeIdentifier: "public.json"); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func capture(_ name: String, _ ids: [String]) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); shot.name = name; shot.lifetime = .keepAlways; add(shot)
        guard app.state != .notRunning else { return }
        let tree = XCTAttachment(string: app.debugDescription); tree.name = name + "-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        func rect(_ r: CGRect) -> [String: Double] { ["x": r.minX, "y": r.minY, "width": r.width, "height": r.height].mapValues { $0.isFinite ? Double($0) : -1 } }
        var frames: [String: Any] = [:]
        for id in ids where node(id).exists { frames[id] = ["frame": rect(node(id).frame), "label": node(id).label, "value": node(id).value as? String ?? "", "hittable": node(id).isHittable] }
        let keyboard = app.keyboards.firstMatch
        attach(name + "-metrics", ["frames": frames, "window": rect(app.windows.firstMatch.frame), "keyboard": keyboard.exists ? rect(keyboard.frame) : [:], "physicalTouch": false, "capturedAt": now()])
    }
    private func read(_ id: String, _ prefix: String) -> [String: Any] {
        wait(id); let label = node(id).label
        XCTAssertTrue(label.hasPrefix(prefix), "Missing diagnostic prefix")
        return try! JSONSerialization.jsonObject(with: Data(label.dropFirst(prefix.count).utf8)) as! [String: Any]
    }
    private func start() {
        let existingState = app.state
        guard [.runningForeground, .runningBackground, .runningBackgroundSuspended].contains(existingState) else {
            XCTFail("Host must prelaunch the frozen app; XCTest must not silently launch a replacement")
            return
        }
        app.activate()
        XCTAssertEqual(app.state, .runningForeground)
        wait("case-raw")
        // Keep orientation requests after activating the owned application.
        XCUIDevice.shared.orientation = .portrait
    }
    func testTransportPreflight() {
        start(); tap("diag-transport-action")
        let callbackOwner = node("diag-transport-owner")
        let delivered = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", "Transport 1"), object: callbackOwner)
        XCTAssertEqual(XCTWaiter.wait(for: [delivered], timeout: 15), .completed, "Controlled callback must actually render Transport 1")
        XCTAssertEqual(callbackOwner.label, "Transport 1")
        XCTAssertFalse(node("diag-field-input").exists)
        capture("transport-preflight", ["diag-transport-owner", "diag-transport-action"])
    }
    private func delivery(_ kind: String, warm: Bool = false) {
        start(); tap("case-" + kind); tap("diag-field-trigger"); wait("diag-field-modal"); wait("diag-field-input")
        XCTAssertEqual(read("diag-field-option-string:status", "OBS ")["query"] as? String, "")
        let field = node("diag-field-input")
        field.tap(); XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        if kind == "raw" {
            // This instrumented condition waits before typing; production ownership and typing defaults stay intact.
            let gate = NSHomeDirectory() + "/Documents/codon-native-trace-release"
            try? FileManager.default.removeItem(atPath: gate)
            FileHandle.standardOutput.write(Data(("CODON_NATIVE_TRACE_READY " + gate + "\n").utf8))
            let gateDeadline = Date().addingTimeInterval(300)
            var nextProgress = Date().addingTimeInterval(10)
            while !FileManager.default.fileExists(atPath: gate) {
                XCTAssertTrue(Date() < gateDeadline, "Native trace setup exceeded its fixed pretyping gate")
                if Date() >= nextProgress {
                    FileHandle.standardOutput.write(Data("CODON_NATIVE_TRACE_WAITING\n".utf8))
                    nextProgress = Date().addingTimeInterval(10)
                }
                Thread.sleep(forTimeInterval: 0.25)
            }
            try? FileManager.default.removeItem(atPath: gate)
        }
        let typingStart = now()
        field.typeText(phrase)
        let typingEnd = now()
        let immediateNative = field.value as? String ?? ""
        capture(kind + "-focused-immediate", ["diag-field-input", "diag-field-option-string:status", "diag-field-option-string:remote", "diag-field-close"])
        let state = read("diag-field-option-string:status", "OBS ")
        let nativeValue = field.value as? String ?? "", keyboard = app.keyboards.firstMatch.exists
        let nativeEvent = state["native"] as! [String: Any]
        let values = [nativeValue, state["query"] as? String ?? "", state["callback"] as? String ?? "", state["committed"] as? String ?? "", nativeEvent["text"] as? String ?? ""]
        let agreement = Set(values).count == 1
        let complete = values.allSatisfy { $0 == phrase }
        let focused = state["focused"] as? Bool == true && keyboard
        let verdict: [String: Any] = ["kind": kind, "warm": warm, "intended": phrase, "typingStart": typingStart, "typingEnd": typingEnd, "capturedAt": now(), "immediateNative": immediateNative, "nativeValue": nativeValue, "observation": state, "keyboardActive": keyboard, "focused": focused, "channelsAgree": agreement, "intendedComplete": complete]
        attach(kind + "-focused-verdict", verdict)
        if !complete || !focused { capture(kind + "-focused-failure-preserved", ["diag-field-input", "diag-field-option-string:status"]) }
        if kind == "raw" {
            // Both bounded raw conditions hold only AFTER the immutable focused verdict for read-only state comparison.
            let marker = "CODON_NATIVE_INSPECTION_BEGIN " + kind + "\n"
            FileHandle.standardOutput.write(Data(marker.utf8))
            Thread.sleep(forTimeInterval: 45)
            FileHandle.standardOutput.write(Data("CODON_NATIVE_INSPECTION_END\n".utf8))
        }
        // Export follows the immutable focused verdict. Blur/end-edit results never replace that verdict.
        tap("diag-field-close"); XCTAssertTrue(node("diag-field-modal").waitForNonExistence(timeout: 15))
        tap("diag-export")
        let trace = read("diag-trace-json", "TRACE ")
        attach(kind + "-delivery-trace", ["focusedVerdict": verdict, "exportedTrace": trace, "postCloseNativeFieldPresent": node("diag-field-input").exists])
        capture(kind + "-trace-exported", ["diag-owner", "diag-trace-json"])
        XCTAssertTrue(focused, "The default diagnostic must retain focus and keyboard during its verdict")
        XCTAssertTrue(complete, "Preserved first focused delivery mismatch; inspect the trace rather than treating post-close text as a repair")
    }
    func testRaw() { delivery("raw") }
    func testInput() { delivery("input") }
    func testCombo() { delivery("combo") }
    func testRawWarm() { delivery("raw", warm: true) }
    func testInputWarm() { delivery("input", warm: true) }
    func testComboWarm() { delivery("combo", warm: true) }
}
