import XCTest
import UIKit

// Four paired G02 cohorts. Product/source identity and guest lifecycle remain root-owned.
final class MeterG02TrialTests: XCTestCase {
    private var app: XCUIApplication!
    private let targetID = "meter-g02-target"
    private let stateID = "meter-g02-state"
    private var original: [String: Any] = [:]

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
        for key in ["CODON_METER_FIXTURE_SHA256", "CODON_METER_SCENE_SHA256",
                    "CODON_METER_PRODUCT_SHA256", "CODON_METER_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        app.launch()
        XCTAssertEqual(app.state, .runningForeground, "Actual matched app must launch")
        XCUIDevice.shared.orientation = .portrait
        wait("Portrait setup") { XCUIDevice.shared.orientation == .portrait }
        XCTAssertGreaterThan(app.windows.firstMatch.frame.height, app.windows.firstMatch.frame.width)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        tap("Progress/Meter scene")
        tap("Light theme")
        tap("Live window")
        tap("G02 prepare Meter")
        wait("Actual default root/ref/layout") {
            guard let state = try? self.state(), let tag = state["rootTag"] as? NSNumber else { return false }
            return tag.intValue > 0 && ((try? self.events().contains { $0["kind"] as? String == "layout" }) == true)
        }
        original = try state()
        try equal(try owner(), ["value": 0])
        try sameRoot()
        try quietEvents(try events())
    }

    override func tearDownWithError() throws {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "meter-final-screen"; shot.lifetime = .keepAlways; add(shot)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "meter-final-hierarchy"; hierarchy.lifetime = .keepAlways; add(hierarchy)
        if let value = try? state() { try mark("meter-final-state", value) }
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
        XCTAssertTrue(scroll.exists)
        for _ in 0..<16 {
            let frame = element.frame
            if !frame.isEmpty && app.windows.firstMatch.frame.insetBy(dx: 2, dy: 12).contains(frame) && (blocked || element.isHittable) { return }
            let upward = frame.minY < scroll.frame.minY + 12
            scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.30 : 0.75))
                .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.70 : 0.35)))
        }
        XCTFail("Unreachable actual element " + element.identifier)
    }
    private func tap(_ label: String) {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        reveal(button); XCTAssertTrue(button.isHittable); button.tap()
    }
    private func state() throws -> [String: Any] {
        let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(node(stateID).label.utf8)) as? [String: Any])
        XCTAssertEqual(try int(value, "dropped"), 0)
        let rows = try XCTUnwrap(value["receipts"] as? [[String: Any]])
        XCTAssertEqual(try rows.map { try int($0, "sequence") }, rows.isEmpty ? [] : Array(1...rows.count))
        return value
    }
    private func owner() throws -> [String: Any] { try XCTUnwrap(state()["owner"] as? [String: Any]) }
    private func rows() throws -> [[String: Any]] { try XCTUnwrap(state()["receipts"] as? [[String: Any]]) }
    private func events() throws -> [[String: Any]] {
        try rows().filter { ["layout", "touchStart", "touchEnd", "touchCancel"].contains($0["kind"] as? String ?? "") }
    }
    private func int(_ value: [String: Any], _ key: String) throws -> Int { try XCTUnwrap(value[key] as? NSNumber, key).intValue }
    private func equal(_ actual: Any, _ expected: Any) throws {
        XCTAssertEqual(try JSONSerialization.data(withJSONObject: ["value": actual], options: .sortedKeys),
                       try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys))
    }
    private func sameRoot() throws {
        let current = try state()
        for key in ["rootTag", "refIdentity", "attaches", "detaches"] { XCTAssertEqual(try int(current, key), try int(original, key), key) }
        XCTAssertEqual(app.descendants(matching: .any).matching(identifier: targetID).count, 1)
        XCTAssertGreaterThan(try int(current, "rootTag"), 0)
        XCTAssertEqual(node(targetID).label, "G02 meter")
        XCTAssertEqual(node(targetID).elementType, .other, "Pinned RN meter maps to no specialized iOS trait; retained range-meter AX is Other")
    }
    private func quietEvents(_ expected: [[String: Any]]) throws {
        let bytes = try JSONSerialization.data(withJSONObject: expected, options: .sortedKeys)
        let extra = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard let rows = try? self.events(), let current = try? JSONSerialization.data(withJSONObject: rows, options: .sortedKeys) else { return true }
            return current != bytes
        }, object: nil)
        extra.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [extra], timeout: 0.75), .completed, "Unexpected native callback")
    }
    private func mark(_ name: String, _ value: [String: Any]) throws {
        var row = value; row["epochSeconds"] = Date().timeIntervalSince1970
        let data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys, .prettyPrinted])
        FileHandle.standardOutput.write(Data((name + " ").utf8) + data + Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func nativeText(_ expected: String?) {
        let value = node(targetID).value
        if let expected { XCTAssertEqual(value as? String, expected, "Actual native value text") }
        else { XCTAssertTrue(value == nil || value is NSNull || (value as? String) == "", "Actual native empty value: \(String(describing: value))") }
    }
    private func apply(_ label: String, owner expected: [String: Any]) throws {
        let before = try events()
        tap(label)
        wait("Owner acknowledgment " + label) {
            guard let owner = try? self.owner(), let a = try? JSONSerialization.data(withJSONObject: owner, options: .sortedKeys), let b = try? JSONSerialization.data(withJSONObject: expected, options: .sortedKeys) else { return false }
            return a == b && ((try? self.state()["pending"] is NSNull) == true)
        }
        try sameRoot(); try quietEvents(before)
    }

    private struct Paint {
        let width: Int
        let height: Int
        let rgba: [UInt8]
        let scale: CGFloat
    }
    private struct Baseline {
        let zero: Paint
        let full: Paint
        let y: Int
        let xs: [Int]
    }
    private func paint(_ name: String) throws -> Paint {
        let target = node(targetID); reveal(target, blocked: true)
        let frame = target.frame, window = app.windows.firstMatch.frame
        XCTAssertTrue(window.contains(frame)); XCTAssertGreaterThan(frame.width, 0); XCTAssertGreaterThan(frame.height, 0)
        let shot = XCUIScreen.main.screenshot()
        let full = XCTAttachment(screenshot: shot); full.name = name + "-screen"; full.lifetime = .keepAlways; add(full)
        let image = try XCTUnwrap(shot.image.cgImage)
        let sx = CGFloat(image.width) / window.width, sy = CGFloat(image.height) / window.height
        XCTAssertEqual(sx, sy, accuracy: 0.01)
        let rectangle = CGRect(x: ((frame.minX - window.minX) * sx).rounded(), y: ((frame.minY - window.minY) * sy).rounded(), width: (frame.width * sx).rounded(), height: (frame.height * sy).rounded())
        let crop = try XCTUnwrap(image.cropping(to: rectangle))
        let cut = XCTAttachment(image: UIImage(cgImage: crop)); cut.name = name + "-native-root"; cut.lifetime = .keepAlways; add(cut)
        var bytes = [UInt8](repeating: 0, count: crop.width * crop.height * 4)
        let drawn = bytes.withUnsafeMutableBytes { data -> Bool in
            guard let context = CGContext(data: data.baseAddress, width: crop.width, height: crop.height, bitsPerComponent: 8, bytesPerRow: crop.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
            context.draw(crop, in: CGRect(x: 0, y: 0, width: CGFloat(crop.width), height: CGFloat(crop.height))); return true
        }
        XCTAssertTrue(drawn)
        try mark(name, ["state": state(), "nativeLabel": target.label, "nativeElementType": target.elementType.rawValue, "nativeValue": target.value ?? NSNull(), "nativeValueDescription": String(describing: target.value), "nativeFrame": [frame.minX, frame.minY, frame.width, frame.height], "nativeWindow": [window.minX, window.minY, window.width, window.height], "nativePixelScale": sx, "cropPixels": [crop.width, crop.height]])
        return Paint(width: crop.width, height: crop.height, rgba: bytes, scale: sx)
    }
    private func calibrate() throws -> Baseline {
        tap("G02 MT values controls")
        try apply("G02 MT zero defaults", owner: ["value": 0]); nativeText("0%")
        let zero = try paint("MT-native-zero-baseline")
        try apply("G02 MT upper clamp", owner: ["value": 80, "minValue": -50, "maxValue": 50]); nativeText("100%")
        let full = try paint("MT-native-full-baseline")
        XCTAssertEqual(zero.width, full.width); XCTAssertEqual(zero.height, full.height)
        var best: [Int] = [], row = 0
        for y in 0..<zero.height {
            let contrast = (0..<zero.width).map { x -> Int in
                let offset = (y * zero.width + x) * 4
                return (0..<3).reduce(0) { $0 + abs(Int(full.rgba[offset + $1]) - Int(zero.rgba[offset + $1])) }
            }
            let peak = contrast.max() ?? 0
            let xs = contrast.indices.filter { peak > 0 && contrast[$0] * 4 >= peak }
            if xs.count > best.count { best = xs; row = y }
        }
        XCTAssertFalse(best.isEmpty, "Native zero/full images must visibly differ")
        let left = try XCTUnwrap(best.first), right = try XCTUnwrap(best.last)
        // Default track has a one-point border; admit its observed full span, not a half-filled calibration.
        XCTAssertLessThanOrEqual(CGFloat(left), full.scale * 2 + 2)
        XCTAssertLessThanOrEqual(CGFloat(full.width - 1 - right), full.scale * 2 + 2)
        XCTAssertEqual(best.count, right - left + 1, "Full native interior paint span must be contiguous")
        try mark("MT-native-paint-calibration", ["row": row, "firstPixel": left, "lastPixel": right, "observedSpanPixels": best.count, "quantizationPixels": 2])
        return Baseline(zero: zero, full: full, y: row, xs: best)
    }
    private func fraction(_ name: String, expected: Double, baseline: Baseline) throws {
        let current = try paint(name)
        XCTAssertEqual(current.width, baseline.zero.width); XCTAssertEqual(current.height, baseline.zero.height)
        var filled = 0
        for x in baseline.xs {
            let offset = (baseline.y * current.width + x) * 4
            var dot = 0.0, length = 0.0
            for channel in 0..<3 {
                let delta = Double(baseline.full.rgba[offset + channel]) - Double(baseline.zero.rgba[offset + channel])
                dot += (Double(current.rgba[offset + channel]) - Double(baseline.zero.rgba[offset + channel])) * delta
                length += delta * delta
            }
            if length > 0 && dot / length >= 0.5 { filled += 1 }
        }
        let observed = Double(filled) / Double(baseline.xs.count)
        let tolerance = 2.0 / Double(baseline.xs.count)
        XCTAssertEqual(observed, expected, accuracy: tolerance, "Actual native paint fraction")
        try mark(name + "-measured", ["filledNativePixels": filled, "baselineNativePixels": baseline.xs.count, "observed": observed, "expected": expected, "toleranceFromNativePixels": tolerance])
    }
    func testS01MTCallerValuesBoundsAndDeferred() throws {
        let baseline = try calibrate()
        for (label, authored, value, amount) in [
            ("G02 MT value 25", ["value": 25], "25%", 0.25),
            ("G02 MT explicit zero bounds", ["value": 0, "minValue": 0, "maxValue": 100] as [String: Any], "0%", 0.0),
            ("G02 MT negative bounded", ["value": -25, "minValue": -50, "maxValue": 50], "25%", 0.25),
            ("G02 MT lower clamp", ["value": -80, "minValue": -50, "maxValue": 50], "0%", 0.0),
            ("G02 MT upper clamp", ["value": 80, "minValue": -50, "maxValue": 50], "100%", 1.0),
            ("G02 MT restore default bounds", ["value": 80], "80%", 0.8),
        ] as [(String, [String: Any], String, Double)] {
            try apply(label, owner: authored); nativeText(value)
            try fraction(label, expected: amount, baseline: baseline)
        }
        try apply("G02 MT deferred 35", owner: ["value": 35, "minValue": -5, "maxValue": 75, "valueLabel": ""])
        nativeText(nil); try fraction("MT-deferred-35-negative-bounds", expected: 0.5, baseline: baseline)
    }

    func testS01MTFormattingEmptyLabelAndContext() throws {
        let baseline = try calibrate(); tap("G02 MT format controls")
        try apply("G02 MT English decimal", owner: ["value": 1250, "maxValue": 2000, "locale": "en-US", "formatOptions": ["style": "decimal"]])
        nativeText("1,250"); try fraction("MT-English-decimal", expected: 0.625, baseline: baseline)
        try apply("G02 MT French decimal", owner: ["value": 1250, "maxValue": 2000, "locale": "fr-CA", "formatOptions": ["style": "decimal"]])
        let french = try XCTUnwrap(node(targetID).value as? String)
        XCTAssertNotNil(french.range(of: "^1\\s250$", options: .regularExpression))
        try fraction("MT-French-decimal", expected: 0.625, baseline: baseline)
        try apply("G02 MT authored label", owner: ["value": 25, "valueLabel": "One quarter"])
        nativeText("One quarter"); try fraction("MT-authored-label", expected: 0.25, baseline: baseline)
        try apply("G02 MT empty label", owner: ["value": 0, "valueLabel": ""])
        nativeText(nil); try fraction("MT-empty-label", expected: 0, baseline: baseline)
        let before = try owner(), touches = try events().filter { $0["kind"] as? String != "layout" }
        tap("Dark theme"); tap("Compact width")
        try sameRoot(); try equal(try owner(), before); nativeText(nil)
        try equal(try events().filter { $0["kind"] as? String != "layout" }, touches)
        _ = try paint("MT-live-context-preserves-empty-zero")
        tap("Light theme"); tap("Live window")
        try sameRoot(); try equal(try owner(), before)
    }

    func testS02MTKnownLatestFillAndVisualRetirement() throws {
        let baseline = try calibrate(); tap("G02 MT motion controls")
        try apply("G02 MT value 25", owner: ["value": 25]); nativeText("25%")
        try fraction("MT-known-25", expected: 0.25, baseline: baseline)
        try apply("G02 MT value 75", owner: ["value": 75])
        nativeText("75%"); try fraction("MT-known-75", expected: 0.75, baseline: baseline)
        XCTAssertEqual(app.descendants(matching: .any).matching(identifier: targetID).count, 1)
        try mark("MT-before-supersede", state())
        try apply("G02 MT supersede fill", owner: ["value": 10])
        nativeText("10%"); try fraction("MT-latest-native-10", expected: 0.1, baseline: baseline)
        try quietEvents(try events()); nativeText("10%")
        try fraction("MT-quiet-no-obsolete-90", expected: 0.1, baseline: baseline)
        let old = try state()
        tap("G02 MT retire moving fill")
        wait("Actual retired root/ref") { !self.node(self.targetID).exists && ((try? self.state()["rootTag"] is NSNull) == true) }
        XCTAssertEqual(try int(state(), "detaches"), try int(old, "detaches") + 1)
        try quietEvents(try events())
        tap("G02 MT reinsert default zero")
        wait("New root lifetime") { self.node(self.targetID).exists && ((try? self.int(self.state(), "attaches")) == (try? self.int(old, "attaches") + 1)) }
        XCTAssertNotEqual(try int(state(), "refIdentity"), try int(old, "refIdentity"))
        original = try state(); try sameRoot(); try equal(try owner(), ["value": 0])
        nativeText("0%"); try fraction("MT-reinsert-current-default-zero", expected: 0, baseline: baseline)
        try quietEvents(try events()); nativeText("0%")
        try fraction("MT-retired-work-does-not-return", expected: 0, baseline: baseline)
    }

    private func contact(_ duration: TimeInterval = 0.2) {
        let target = node(targetID); reveal(target, blocked: true)
        let frame = target.frame
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).press(forDuration: duration)
    }
    private func delivered(_ recipient: String) throws {
        let before = try events().count
        contact()
        wait("Current raw native touch delivery") { (try? self.events().count) == before + 2 }
        try quietEvents(try events())
        let received = Array(try events().dropFirst(before))
        XCTAssertEqual(received.compactMap { $0["kind"] as? String }, ["touchStart", "touchEnd"])
        var previous: [String: Any]?
        for row in received {
            XCTAssertEqual(row["afterDetach"] as? Bool, false)
            XCTAssertEqual(try int(row, "rootTag"), try int(original, "rootTag"))
            let data = try XCTUnwrap(row["data"] as? [String: Any])
            XCTAssertEqual(data["recipient"] as? String, recipient)
            XCTAssertEqual(try int(data, "currentTarget"), try int(original, "rootTag"))
            let native = try XCTUnwrap(data["native"] as? [String: Any])
            let changed = try XCTUnwrap(native["changedTouches"] as? [[String: Any]])
            XCTAssertEqual(changed.count, 1)
            let point = try XCTUnwrap(changed.first)
            XCTAssertGreaterThan(try int(point, "target"), 0)
            if let previous {
                XCTAssertEqual(try int(point, "identifier"), try int(previous, "identifier"))
                XCTAssertEqual(try int(point, "target"), try int(previous, "target"))
                XCTAssertGreaterThanOrEqual(try int(point, "timestamp"), try int(previous, "timestamp"))
            }
            previous = point
        }
        try sameRoot()
    }
    func testS02S06MTNativeDeliveryCurrentCallbacksAndHeldRetirement() throws {
        tap("G02 MT events controls")
        try delivered("original")
        var before = try events()
        tap("G02 MT replace callbacks"); XCTAssertEqual(try state()["callback"] as? String, "current")
        try sameRoot(); try quietEvents(before); try delivered("current")
        tap("G02 MT ignore pointer input"); XCTAssertEqual(try state()["pointerEvents"] as? String, "none")
        before = try events(); let unchangedOwner = try owner()
        contact(); try quietEvents(before); try equal(try owner(), unchangedOwner); try sameRoot()
        tap("G02 MT accept pointer input"); XCTAssertEqual(try state()["pointerEvents"] as? String, "auto")
        try delivered("current")
        let layoutCount = try events().count
        tap("G02 MT widen root")
        wait("Actual current layout") { (try? self.events().count) == layoutCount + 1 }
        let layout = try XCTUnwrap(try events().last), data = try XCTUnwrap(layout["data"] as? [String: Any])
        XCTAssertEqual(layout["kind"] as? String, "layout"); XCTAssertEqual(data["recipient"] as? String, "current")
        XCTAssertEqual(try int(data, "currentTarget"), try int(original, "rootTag"))
        let native = try XCTUnwrap(data["native"] as? [String: Any]), box = try XCTUnwrap(native["layout"] as? [String: Any])
        XCTAssertEqual(try int(box, "width"), 180); XCTAssertEqual(try int(box, "height"), 10)
        XCTAssertEqual(node(targetID).frame.width, 180, accuracy: 0.5); try sameRoot(); try quietEvents(try events())
        let old = try state(), count = try rows().count
        tap("G02 MT retire on touch start"); XCTAssertEqual(try state()["retireOnStart"] as? Bool, true)
        contact(1)
        wait("Held removal actual target/ref") { !self.node(self.targetID).exists && ((try? self.state()["rootTag"] is NSNull) == true) }
        XCTAssertEqual(try int(state(), "detaches"), try int(old, "detaches") + 1)
        let tail = Array(try rows().dropFirst(count))
        XCTAssertEqual(tail.filter { $0["kind"] as? String == "touchStart" }.count, 1)
        let detach = try XCTUnwrap(tail.firstIndex { $0["kind"] as? String == "detach" })
        XCTAssertFalse(tail.dropFirst(detach + 1).contains { ["layout", "touchStart", "touchEnd", "touchCancel"].contains($0["kind"] as? String ?? "") })
        try quietEvents(try events())
        tap("G02 MT reinsert default zero")
        wait("Actual replacement root") { self.node(self.targetID).exists }
        XCTAssertEqual(try int(state(), "attaches"), try int(old, "attaches") + 1)
        XCTAssertNotEqual(try int(state(), "refIdentity"), try int(old, "refIdentity"))
        original = try state(); try sameRoot(); try equal(try owner(), ["value": 0]); nativeText("0%")
        try quietEvents(try events()); try delivered("current")
        _ = try paint("MT-current-reinserted-root-after-held-removal")
    }
}
