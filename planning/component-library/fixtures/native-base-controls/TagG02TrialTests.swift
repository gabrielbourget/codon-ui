import XCTest
import UIKit

// BEGIN TAG_G02_PURE_CHECKS
struct TagG02OwnerState {
    let raw: String
    let owner: Bool
    let echo: Bool
    let requests: Int
    let last: String
    let identifier: String
    let exposed: String
    let size: String
    let armed: Bool
    let deliveredSize: [Double]?
}
enum TagG02Checks {
    static func parse(_ raw: String) throws -> TagG02OwnerState {
        let text = raw.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        func field(_ pattern: String, _ group: Int = 1) throws -> String {
            let regex = try NSRegularExpression(pattern: pattern)
            guard let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let range = Range(match.range(at: group), in: text) else {
                throw NSError(domain: "TagG02State", code: 1, userInfo: [NSLocalizedDescriptionKey: pattern])
            }
            return String(text[range])
        }
        var delivered: [Double]?
        if !text.contains("Frame: unmeasured.") {
            guard let width = Double(try field("Frame: ([0-9.]+) x ([0-9.]+)\\.")),
                  let height = Double(try field("Frame: ([0-9.]+) x ([0-9.]+)\\.", 2)),
                  width.isFinite, height.isFinite, width > 0, height > 0 else {
                throw NSError(domain: "TagG02State", code: 2)
            }
            delivered = [width, height]
        }
        guard let requests = Int(try field("Requests: ([0-9]+)\\.")) else {
            throw NSError(domain: "TagG02State", code: 3)
        }
        return try TagG02OwnerState(raw: text, owner: field("Owner: (true|false)\\.") == "true",
            echo: field("Echo: (true|false)\\.") == "true", requests: requests,
            last: field("Last: (.*?)\\. ID:"), identifier: field(" ID: (.*?)\\. Exposed:"),
            exposed: field("Exposed: (.*?)\\. Size:"), size: field("Size: (.*?)\\. Geometry:"),
            armed: field("Armed guard: (true|false)\\.") == "true", deliveredSize: delivered)
    }
    static func outcome(_ state: TagG02OwnerState, actualID: String, label: String, isButton: Bool,
                        enabled: Bool, value: String?, owner: Bool, requests: Int, last: String,
                        checked: String, expectedEnabled: Bool) -> Bool {
        state.owner == owner && state.requests == requests && state.last == last
            && state.identifier == "number 0" && actualID == "tag-example" && label == "Controlled tag"
            && isButton && enabled == expectedEnabled && value == checked
    }
    static func contained(_ child: [Double], _ parent: [Double], scale: Double) -> Bool {
        guard child.count == 4, parent.count == 4, scale.isFinite, scale > 0,
              (child + parent).allSatisfy({ $0.isFinite }) else { return false }
        let c = child.map { floor($0 * scale + 0.5) }, p = parent.map { floor($0 * scale + 0.5) }
        return c[2] > 0 && c[3] > 0 && p[2] > 0 && p[3] > 0 && c[0] >= p[0] && c[1] >= p[1]
            && c[0] + c[2] <= p[0] + p[2] && c[1] + c[3] <= p[1] + p[3]
    }
    static func wraps(_ frame: [Double], delivered: [Double], shortHeight: Double, scale: Double) -> Bool {
        guard frame.count == 4, delivered.count == 2, scale.isFinite, scale > 0,
              (frame + delivered + [shortHeight]).allSatisfy({ $0.isFinite }) else { return false }
        let pixel = 1 / scale
        return abs(frame[2] - 140) <= pixel && abs(frame[2] - delivered[0]) <= pixel
            && abs(frame[3] - delivered[1]) <= pixel && frame[3] > shortHeight + pixel
    }
}
// END TAG_G02_PURE_CHECKS


// Cached public TagScene only. Aggregate owner receipts are not a native event/ref journal.
final class TagG02TrialTests: XCTestCase {
    private lazy var app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let french = "Étiquette longue : les valeurs restent liées aux choix de la personne et les actions restent accessibles."
    private typealias OwnerState = TagG02OwnerState
    private struct Observation {
        let elements: [XCUIElementSnapshot]
        let state: OwnerState
        let target: XCUIElementSnapshot
        let window: CGRect
        let viewport: CGRect
    }
    override func setUpWithError() throws {
        continueAfterFailure = false
        for key in ["CODON_TAG_SCENE_SHA256", "CODON_TAG_PRODUCT_SHA256", "CODON_TAG_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        tap("Reset scene"); tap("Tag scene")
        XCTAssertTrue(node("tag-state").waitForExistence(timeout: 10))
        wait("Fresh Tag defaults and delivered native layout") {
            guard let current = try? self.observe() else { return false }
            return !current.state.owner && current.state.echo && current.state.requests == 0
                && current.state.last == "none" && current.state.identifier == "number 0"
                && current.state.exposed == "default" && !current.state.armed
                && current.state.deliveredSize != nil && current.target.isEnabled
        }
    }
    override func tearDownWithError() throws {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "tag-final-screen"; shot.lifetime = .keepAlways; add(shot)
        if let current = try? observe() { try mark("TAG-final", current) }
    }
    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func wait(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }
    private func reveal(_ element: XCUIElement, blocked: Bool = false) {
        XCTAssertTrue(element.waitForExistence(timeout: 10))
        let scroll = app.scrollViews.firstMatch
        for _ in 0..<16 {
            let frame = element.frame
            let viewport = app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx: 2, dy: 2)
            if !frame.isEmpty && viewport.contains(frame) && (blocked || element.isHittable) { return }
            let upward = frame.minY < viewport.minY
            scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.30 : 0.75))
                .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.70 : 0.35)))
        }
        XCTFail("Unreachable actual native element " + element.identifier)
    }
    private func tap(_ label: String) {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        if !button.isHittable { reveal(button) }
        XCTAssertTrue(button.isHittable); button.tap()
    }
    private func state(_ raw: String) throws -> OwnerState { try TagG02Checks.parse(raw) }
    private func observe() throws -> Observation {
        let root = try app.snapshot()
        var elements: [XCUIElementSnapshot] = []
        func visit(_ item: XCUIElementSnapshot) {
            elements.append(item); for child in item.children { visit(child) }
        }
        visit(root)
        func unique(_ id: String) throws -> XCUIElementSnapshot {
            let matches = elements.filter { $0.identifier == id }
            XCTAssertEqual(matches.count, 1, "One actual current target: " + id)
            return try XCTUnwrap(matches.first)
        }
        let current = try state(unique("tag-state").label)
        let target = try unique("tag-example")
        let window = try XCTUnwrap(elements.first { $0.elementType == .window }).frame
        let scroll = try XCTUnwrap(elements.first { $0.elementType == .scrollView }).frame
        XCTAssertGreaterThan(window.width, 0); XCTAssertGreaterThan(window.height, 0)
        return Observation(elements: elements, state: current, target: target,
            window: window, viewport: window.intersection(scroll).insetBy(dx: 2, dy: 2))
    }
    private func assertOwner(_ current: Observation, _ owner: Bool, _ requests: Int,
                             last: String, checked: String, enabled: Bool = true) {
        XCTAssertTrue(TagG02Checks.outcome(current.state, actualID: current.target.identifier,
            label: current.target.label, isButton: current.target.elementType == .button,
            enabled: current.target.isEnabled, value: current.target.value as? String,
            owner: owner, requests: requests, last: last, checked: checked, expectedEnabled: enabled))
        XCTAssertEqual(current.state.owner, owner); XCTAssertEqual(current.state.requests, requests)
        XCTAssertEqual(current.state.last, last); XCTAssertEqual(current.state.identifier, "number 0")
        XCTAssertEqual(current.target.identifier, "tag-example"); XCTAssertEqual(current.target.label, "Controlled tag")
        XCTAssertEqual(current.target.elementType, .button); XCTAssertEqual(current.target.isEnabled, enabled)
        XCTAssertEqual(current.target.value as? String, checked, "Pinned RN button checked state is its localized accessibilityValue; test language en")
    }
    private func quiet(_ expected: Observation) {
        let changed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard let current = try? self.observe() else { return true }
            return current.state.requests != expected.state.requests || current.state.owner != expected.state.owner
                || current.state.last != expected.state.last
        }, object: nil)
        changed.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [changed], timeout: 1), .completed, "No delayed business request/owner mutation")
    }
    private func frame(_ value: CGRect) -> [CGFloat] { [value.minX, value.minY, value.width, value.height] }
    private func mark(_ label: String, _ current: Observation, _ extra: [String: Any] = [:]) throws {
        let row: [String: Any] = ["cell": "CAT.tag.G02", "epochSeconds": Date().timeIntervalSince1970,
            "uptimeSeconds": ProcessInfo.processInfo.systemUptime, "state": current.state.raw,
            "owner": current.state.owner, "requests": current.state.requests, "last": current.state.last,
            "identifier": current.state.identifier, "armed": current.state.armed,
            "nativeTargetID": current.target.identifier, "nativeLabel": current.target.label,
            "nativeType": current.target.elementType.rawValue, "nativeEnabled": current.target.isEnabled,
            "nativeValue": current.target.value as? String ?? "", "targetFrame": frame(current.target.frame),
            "window": frame(current.window), "viewport": frame(current.viewport),
            "nativeScale": UIScreen.main.scale, "extra": extra,
            "claimScope": "Actual native snapshots plus TagScene aggregate owner/request/last marker; no JSref or cumulative native event trace"]
        let data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys])
        FileHandle.standardOutput.write(Data((label + " ").utf8) + data + Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = label; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func capture(_ label: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = label; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func contact(_ element: XCUIElement, duration: TimeInterval = 0.1) {
        reveal(element, blocked: true)
        let actual = element.frame
        XCTAssertTrue(TagG02Checks.contained(frame(actual).map(Double.init),
            frame(app.windows.firstMatch.frame.intersection(app.scrollViews.firstMatch.frame)).map(Double.init),
            scale: Double(UIScreen.main.scale)))
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: actual.midX, dy: actual.midY))
            .press(forDuration: duration)
    }
    func testT01BaselineFirstActionVetoAndSemantics() throws {
        var current = try observe()
        assertOwner(current, false, 0, last: "none", checked: "unchecked")
        let status = try XCTUnwrap(current.elements.first { $0.identifier == "tag-status" })
        XCTAssertNotEqual(status.elementType, .button); XCTAssertEqual(status.label, "Tag status inactive")
        contact(node("tag-status")); current = try observe()
        assertOwner(current, false, 0, last: "none", checked: "unchecked"); quiet(current)
        contact(node("tag-example")); current = try observe()
        assertOwner(current, true, 1, last: "number 0", checked: "checked")
        try mark("TAG-first-action", current); capture("TAG-first-action")
        tap("Toggle tag owner echo"); tap("Toggle tag owner value")
        for count in [2, 3] {
            contact(node("tag-example")); current = try observe()
            assertOwner(current, false, count, last: "number 0", checked: "unchecked")
            XCTAssertFalse(current.state.echo)
        }
        tap("Toggle tag owner value"); current = try observe()
        assertOwner(current, true, 3, last: "number 0", checked: "checked")
        tap("Next tag accessibility override"); current = try observe()
        assertOwner(current, true, 3, last: "number 0", checked: "unchecked")
        XCTAssertEqual(current.state.exposed, "false")
        try mark("TAG-owner-veto-and-exposed-false", current); capture("TAG-owner-veto-and-exposed-false")
    }
    func testT02DisabledTakeoverCancellationAndFreshAction() throws {
        tap("Toggle tag disabled"); var current = try observe()
        assertOwner(current, false, 0, last: "none", checked: "unchecked", enabled: false)
        contact(node("tag-example")); quiet(current)
        tap("Toggle tag owner value"); current = try observe()
        assertOwner(current, true, 0, last: "none", checked: "checked", enabled: false)
        tap("Toggle tag disabled"); tap("Toggle tag owner value")
        tap("Arm tag disable during press"); current = try observe()
        XCTAssertTrue(current.state.armed)
        assertOwner(current, false, 0, last: "none", checked: "unchecked")
        try mark("TAG-before-standard-one-second-press", current)
        contact(node("tag-example"), duration: 1)
        current = try observe()
        assertOwner(current, false, 0, last: "none", checked: "unchecked", enabled: false)
        XCTAssertFalse(current.state.armed); quiet(current)
        try mark("TAG-after-pressIn-disabled-takeover", current,
            ["pressDurationSeconds": 1, "observationPhase": "after-UP", "disabledWhileDownObserved": false,
             "sourceAttribution": "Exact cached TagScene only disarms guard inside onPressIn and setsDisabled(true) in that same branch"])
        capture("TAG-after-pressIn-disabled-takeover")
        tap("Toggle tag disabled"); reveal(node("tag-example"))
        current = try observe(); let actual = current.target.frame
        let candidates = [CGPoint(x: actual.midX, y: actual.maxY + 80), CGPoint(x: actual.midX, y: actual.minY - 80)]
        let end = try XCTUnwrap(candidates.first { current.viewport.contains($0) && !actual.insetBy(dx: -30, dy: -30).contains($0) })
        let origin = app.coordinate(withNormalizedOffset: .zero)
        origin.withOffset(CGVector(dx: actual.midX, dy: actual.midY)).press(forDuration: 0.2,
            thenDragTo: origin.withOffset(CGVector(dx: end.x, dy: end.y)))
        current = try observe()
        assertOwner(current, false, 0, last: "none", checked: "unchecked"); quiet(current)
        contact(node("tag-example")); current = try observe()
        assertOwner(current, true, 1, last: "number 0", checked: "checked")
        try mark("TAG-cancelled-cycle-and-fresh-action", current)
    }
    func testT03LongFrenchLabelAndReachableAction() throws {
        tap("Toggle tag owner echo"); tap("Toggle tag width constraint")
        reveal(node("tag-example")); var current = try observe()
        let shortHeight = current.target.frame.height
        tap("Toggle long tag label")
        wait("Actual wrapped target grows at fixed width140") {
            guard let row = try? self.observe() else { return false }
            return row.target.frame.height > shortHeight + 1 / UIScreen.main.scale
        }
        reveal(node("tag-example")); current = try observe()
        let scale = UIScreen.main.scale, delivered = try XCTUnwrap(current.state.deliveredSize)
        XCTAssertTrue(TagG02Checks.contained(frame(current.target.frame).map(Double.init),
            frame(current.viewport).map(Double.init), scale: Double(UIScreen.main.scale)))
        XCTAssertEqual(current.target.frame.width, 140, accuracy: 1 / scale)
        XCTAssertTrue(TagG02Checks.wraps(frame(current.target.frame).map(Double.init), delivered: delivered,
            shortHeight: Double(shortHeight), scale: Double(scale)))
        XCTAssertEqual(current.target.frame.width, CGFloat(delivered[0]), accuracy: 1 / scale)
        XCTAssertEqual(current.target.frame.height, CGFloat(delivered[1]), accuracy: 1 / scale)
        XCTAssertGreaterThan(current.target.frame.height, shortHeight)
        let readableChildren = current.elements.filter { $0.label == french }
        for child in readableChildren { XCTAssertTrue(current.target.frame.contains(child.frame)) }
        try mark("TAG-long-French-visible-wrap", current, ["authoredFrenchCopy": french,
            "shortNativeHeight": shortHeight, "exactFrenchAXChildCount": readableChildren.count,
            "fullRenderedCopyReviewRequired": true, "nativeFullTextAXClaim": !readableChildren.isEmpty])
        capture("TAG-long-French-visible-wrap")
        contact(node("tag-example")); current = try observe()
        assertOwner(current, false, 1, last: "number 0", checked: "unchecked"); quiet(current)
        let tail = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Transition:")).firstMatch
        reveal(tail, blocked: true)
        XCTAssertTrue(app.windows.firstMatch.frame.intersection(app.scrollViews.firstMatch.frame).contains(tail.frame))
        current = try observe(); assertOwner(current, false, 1, last: "number 0", checked: "unchecked")
        try mark("TAG-actual-tail-and-reachable-action", current, ["tailFrame": frame(tail.frame), "tailText": tail.label])
        capture("TAG-actual-tail-and-reachable-action")
    }
    func testT04SceneRetirementAndReentry() throws {
        tap("Toggle tag owner echo"); contact(node("tag-example"))
        let before = try observe()
        assertOwner(before, false, 1, last: "number 0", checked: "unchecked")
        try mark("TAG-before-scene-retirement", before)
        tap("Foundation scene")
        XCTAssertFalse(node("tag-example").exists); XCTAssertFalse(node("tag-state").exists)
        let reappeared = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.node("tag-example").exists || self.node("tag-state").exists
        }, object: nil)
        reappeared.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [reappeared], timeout: 1), .completed)
        capture("TAG-retired-scene-absence")
        tap("Tag scene"); let current = try observe()
        assertOwner(current, false, 0, last: "none", checked: "unchecked")
        XCTAssertTrue(current.state.echo); XCTAssertFalse(current.state.armed)
        try mark("TAG-fresh-scene-after-retirement", current,
            ["oldTargetAbsentDuringSceneExit": true, "quietAbsenceSeconds": 1,
             "JSRefDetachOrOldCallbackJournalObserved": false,
             "lifetimeScope": "Native scene absence/reentry plus separately bound source ref/event/retired-work tests"])
        capture("TAG-fresh-scene-after-retirement")
    }
}
