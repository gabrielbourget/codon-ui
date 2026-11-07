import XCTest
import UIKit

private func nativeWorkRemaining() -> TimeInterval {
    guard let text = ProcessInfo.processInfo.environment["CODON_NATIVE_WORK_DEADLINE_UNIX"],
          let deadline = Double(text), deadline.isFinite else {
        preconditionFailure("Missing admitted native work deadline")
    }
    return max(0, deadline - Date().timeIntervalSince1970)
}

// Four paired G02 cohorts. Product/source identity and guest lifecycle remain root-owned.
final class MeterG02TrialTests: XCTestCase {
    private var app: XCUIApplication!
    private let targetID = "meter-g02-target"
    private let stateID = "meter-g02-state"
    private var original: [String: Any] = [:]

    override func setUpWithError() throws {
        continueAfterFailure = false
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
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: nativeWorkRemaining()), .completed, message)
    }
    private func reveal(_ element: XCUIElement, blocked: Bool = false) {
        XCTAssertTrue(element.waitForExistence(timeout: nativeWorkRemaining()))
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
    private func layoutMatches(_ delivered: Double, _ expected: Double, _ scale: Double) -> Bool {
        delivered.isFinite && expected.isFinite && scale.isFinite && scale > 0 && abs(delivered - expected) * scale <= 1
    }
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
        let measured = try paint("MT-widened-original-layout")
        let scale = Double(measured.scale)
        let deliveredWidth = try XCTUnwrap(box["width"] as? NSNumber).doubleValue
        let deliveredHeight = try XCTUnwrap(box["height"] as? NSNumber).doubleValue
        XCTAssertTrue(layoutMatches(deliveredWidth, 180, scale), "Original native width within one physical pixel")
        XCTAssertTrue(layoutMatches(deliveredHeight, 10, scale), "Original native height within one physical pixel")
        let frame = node(targetID).frame
        XCTAssertTrue(layoutMatches(Double(frame.width), 180, scale))
        XCTAssertTrue(layoutMatches(Double(frame.height), 10, scale))
        XCTAssertTrue(layoutMatches(deliveredWidth, Double(frame.width), scale))
        XCTAssertTrue(layoutMatches(deliveredHeight, Double(frame.height), scale))
        try sameRoot(); try quietEvents(try events())
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

// Same stable XCTest target, independent raw-View style references in the installed showcase.
final class MeterStyleTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private var original: [String: Any] = [:]
    private let names = ["semantic", "fractional", "zero-width", "zero-height", "percentage", "auto-height", "physical-left", "vertical-up", "vertical-down", "orthogonal", "independent-radii", "primary", "explicit-colors", "registered-array", "post-custom-final", "native-color", "zero-opacity", "raised"]
    private let sizes: [[Double]] = [[150,10],[73.25,13.75],[0,10],[150,0],[108,20],[150,0],[160,20],[20,140],[20,140],[150,10],[150,24],[150,20],[150,20],[91,20],[84,20],[150,20],[150,10],[150,20]]

    override func setUpWithError() throws {
        continueAfterFailure = false
        if name.contains("testRestoreMeterStyleMotionSetting") { return }
        for key in ["CODON_METER_STYLE_FIXTURE_SHA256", "CODON_METER_PRODUCT_SHA256", "CODON_METER_OBSERVER_MANIFEST_SHA256"] {
            XCTAssertNotNil(ProcessInfo.processInfo.environment[key]?.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase"); app.launch()
        XCTAssertEqual(app.state, .runningForeground)
        XCUIDevice.shared.orientation = .portrait
        wait("Portrait") { XCUIDevice.shared.orientation == .portrait }
        tap("Progress/Meter scene"); tap("Light theme"); tap("Live window"); tap("Prepare Meter styles")
        wait("Original style root/layouts") {
            guard let state = try? self.state(), let tag = state["rootTag"] as? NSNumber,
                  let layouts = state["layouts"] as? [String: Any] else { return false }
            return tag.intValue > 0 && layouts["target"] != nil && layouts["reference"] != nil
        }
        original = try state()
        XCTAssertEqual(original["rawReferences"] as? Bool,false,"Real Meter fixture, not stock-reference control")
    }
    override func tearDownWithError() throws {
        if app != nil {
            let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); shot.name = "meter-style-final"; shot.lifetime = .keepAlways; add(shot)
            let tree = XCTAttachment(string: app.debugDescription); tree.name = "meter-style-final-hierarchy"; tree.lifetime = .keepAlways; add(tree)
        }
    }
    private func node(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func wait(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: nativeWorkRemaining()), .completed, message)
    }
    private func reveal(_ element: XCUIElement, blocked: Bool = false) {
        XCTAssertTrue(element.waitForExistence(timeout: nativeWorkRemaining()))
        let scroll = app.scrollViews.firstMatch; XCTAssertTrue(scroll.exists)
        for _ in 0..<16 {
            let viewport = app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx: 2, dy: 2)
            if !element.frame.isEmpty && viewport.contains(element.frame) && (blocked || element.isHittable) { return }
            let upward = element.frame.minY < viewport.minY
            scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.30 : 0.75)).press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.70 : 0.35)))
        }
        XCTFail("Unreachable style element " + element.identifier)
    }
    private func tap(_ label: String) {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        reveal(button); XCTAssertTrue(button.isHittable); button.tap()
    }
    private func state() throws -> [String: Any] {
        let marker = node("meter-style-state")
        guard marker.exists, let value = try? JSONSerialization.jsonObject(with:Data(marker.label.utf8)),
              let row = value as? [String:Any] else { throw NSError(domain:"MeterStyleStateNotReady",code:1) }
        return row
    }
    private func number(_ row: [String: Any], _ key: String) throws -> Double {
        let value = try XCTUnwrap(row[key] as? NSNumber, key).doubleValue
        XCTAssertTrue(value.isFinite); return value
    }
    private func retained(_ row: [String: Any]) throws {
        for key in ["rootTag", "attaches", "detaches"] { XCTAssertEqual(try number(row, key), try number(original, key), key) }
        XCTAssertGreaterThan(try number(row, "rootTag"), 0)
    }
    private func select(_ index: Int) throws {
        for _ in 0...names.count {
            let current = try state()
            if try number(current, "index") == Double(index) { XCTAssertEqual(current["case"] as? String, names[index]); return }
            let next = (Int(try number(current, "index")) + 1) % names.count
            tap("Next Meter style")
            wait("Style selection") { (try? self.number(self.state(), "index")) == Double(next) }
        }
        XCTFail("Style selection failed")
    }
    private func pixels(_ image: CGImage, _ frame: CGRect, _ window: CGRect, _ scale: CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame))
        let rect = CGRect(x: ((frame.minX-window.minX)*scale).rounded(), y: ((frame.minY-window.minY)*scale).rounded(), width: (frame.width*scale).rounded(), height: (frame.height*scale).rounded())
        let crop = try XCTUnwrap(image.cropping(to: rect))
        var bytes = [UInt8](repeating: 0, count: crop.width*crop.height*4)
        let drawn = bytes.withUnsafeMutableBytes { data -> Bool in
            guard let context = CGContext(data: data.baseAddress, width: crop.width, height: crop.height, bitsPerComponent: 8, bytesPerRow: crop.width*4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
            context.draw(crop, in: CGRect(x: 0, y: 0, width: CGFloat(crop.width), height: CGFloat(crop.height))); return true
        }
        XCTAssertTrue(drawn); return bytes
    }
    private func stylePixelsMatch(_ actual: [UInt8], _ reference: [UInt8]) -> Bool {
        !actual.isEmpty && actual.count % 4 == 0 && actual == reference
    }
    private func shadowFallsDown(_ above: [UInt8], _ below: [UInt8]) -> Bool {
        above.count == 4 && below.count == 4 && above[3] == 255 && below[3] == 255
            && above[0] == above[1] && above[1] == above[2]
            && below[0] == below[1] && below[1] == below[2] && below[0] < above[0]
    }
    private func raisedPaint(_ image: CGImage, _ a: CGRect, _ b: CGRect, _ window: CGRect, _ scale: CGFloat) throws -> [String:Any] {
        func sample(_ parent: CGRect, _ x: CGFloat, _ y: CGFloat) throws -> [UInt8] {
            try pixels(image,CGRect(x:parent.minX+x,y:parent.minY+y,width:1/scale,height:1/scale),window,scale)
        }
        let points: [(String,CGFloat,CGFloat)] = [("bar",12+150*0.125,22),("track",12+150*0.625,22),("solid-border1",12+150*0.75,12+1/scale),("solid-border2",12+150*0.75,12+2/scale)]
        var samples: [[String:Any]] = [], colors: [[UInt8]] = []
        for (name,x,y) in points {
            let actual = try sample(a,x,y), reference = try sample(b,x,y)
            XCTAssertEqual(actual,reference,"Exact opaque "+name);colors.append(actual)
            samples.append(["name":name,"rgba":actual,"referenceRGBA":reference])
        }
        XCTAssertNotEqual(colors[0],colors[1],"Nonvacuous opaque bar/track")
        var shadows: [[String:Any]] = []
        for parent in [a,b] {
            let above = try sample(parent,87,10), below = try sample(parent,87,34)
            XCTAssertTrue(shadowFallsDown(above,below),"Actual neutral downward shadow")
            for (x,y) in [(CGFloat(0),CGFloat(0)),(239,0),(0,169),(239,169)] { XCTAssertEqual(try sample(parent,x,y),[255,255,255,255],"Isolated parent corner") }
            shadows.append(["aboveRGBA":above,"belowRGBA":below])
        }
        return ["opaqueSamples":samples,"shadowSamples":shadows,"opaqueSamplesExact":true,"shadowPresenceDirection":true,"shadowReviewPending":true]
    }
    private func frameValues(_ frame: CGRect) -> [CGFloat] { [frame.minX, frame.minY, frame.width, frame.height] }
    private func observe(_ name: String) throws {
        reveal(node("meter-style-pair"), blocked: true)
        let before = try state(); try retained(before)
        let index = Int(try number(before, "index")); XCTAssertEqual(before["case"] as? String, names[index])
        let window = app.windows.firstMatch.frame, a = node("meter-style-parent").frame, b = node("meter-style-reference-parent").frame
        let screenshot = XCUIScreen.main.screenshot(), image = try XCTUnwrap(screenshot.image.cgImage)
        let attachment = XCTAttachment(screenshot:screenshot); attachment.name = "meter-style-"+name; attachment.lifetime = .keepAlways; add(attachment)
        XCTAssertEqual(screenshot.image.imageOrientation, .up)
        let scale = CGFloat(image.width)/window.width; XCTAssertEqual(scale, CGFloat(image.height)/window.height, accuracy: 0.01)
        for frame in [a,b] { XCTAssertEqual(frame.width, 240, accuracy: 1/scale); XCTAssertEqual(frame.height, 170, accuracy: 1/scale); XCTAssertTrue(window.contains(frame)) }
        let layouts = try XCTUnwrap(before["layouts"] as? [String: Any])
        var expected: [Double] = [12, index == 14 ? 17 : 12, sizes[index][0], sizes[index][1]]
        if index == 5 {
            let event = try XCTUnwrap(layouts["reference"] as? [String:Any]), box = try XCTUnwrap(event["layout"] as? [String:Any])
            expected[3] = try number(box,"height");XCTAssertGreaterThanOrEqual(expected[3],0)
        }
        for owner in ["target", "reference"] {
            let event = try XCTUnwrap(layouts[owner] as? [String: Any]), box = try XCTUnwrap(event["layout"] as? [String: Any])
            XCTAssertEqual(try number(event, "nativeTarget"), try number(event, "currentTarget")); XCTAssertGreaterThan(try number(event, "nativeTarget"), 0)
            if owner == "target" { XCTAssertEqual(try number(event, "currentTarget"), try number(before, "rootTag")) }
            for (key,value) in zip(["x","y","width","height"],expected) { XCTAssertEqual(try number(box,key), value, accuracy: 1/Double(scale), owner+" "+key) }
        }
        let actual = try pixels(image,a,window,scale), reference = try pixels(image,b,window,scale)
        let wholeMatch = stylePixelsMatch(actual,reference)
        let raised = index == 17 ? try raisedPaint(image,a,b,window,scale) : [:]
        if index != 17 { XCTAssertTrue(wholeMatch, "Exact whole-parent reference includes contour, border, opacity and native colors") }
        let absent = index == 16
        if absent { XCTAssertTrue(actual.allSatisfy { $0 == 255 }, "Whole isolated parent must be white") }
        else if ![2,3,5].contains(index) {
            XCTAssertTrue(actual.contains { $0 != 255 }, "Nonvacuous visible paint required")
            let target = node("meter-style-target"); XCTAssertEqual(app.descendants(matching:.any).matching(identifier:"meter-style-target").count,1)
            XCTAssertEqual(target.elementType,.other); XCTAssertEqual(target.label,"Style meter"); XCTAssertEqual(target.value as? String,String(Int(try number(before,"value")))+"%")
            let frame = target.frame
            for (actual,expected) in zip(frameValues(frame),[a.minX+CGFloat(expected[0]),a.minY+CGFloat(expected[1]),CGFloat(expected[2]),CGFloat(expected[3])]) { XCTAssertEqual(actual,expected,accuracy:1/scale) }
        }
        let after = try state(); try retained(after)
        for key in ["index","case","value","mode","layouts"] {
            XCTAssertEqual(try JSONSerialization.data(withJSONObject:[before[key] ?? NSNull()],options:.sortedKeys),try JSONSerialization.data(withJSONObject:[after[key] ?? NSNull()],options:.sortedKeys),"Fresh capture "+key)
        }
        var row: [String:Any] = ["name":name,"state":before,"afterState":after,"expectedLayout":expected,"nativeParents":[frameValues(a),frameValues(b)],"screen":frameValues(window),"scale":scale,"imagePixels":[image.width,image.height],"comparedPixels":actual.count/4,"wholeParentExact":wholeMatch,"absent":absent]
        row.merge(raised) { _,new in new }
        let data = try JSONSerialization.data(withJSONObject:row,options:.sortedKeys)
        FileHandle.standardOutput.write(Data("METER_STYLE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let receipt = XCTAttachment(data:data,uniformTypeIdentifier:"public.json"); receipt.name="meter-style-"+name+"-receipt";receipt.lifetime = .keepAlways;add(receipt)
    }
    func testMeterStyleDimensions() throws { for index in 0..<6 { try select(index); try observe(names[index]) } }
    func testMeterStyleGeometry() throws { for index in 6..<12 { try select(index); try observe(names[index]) } }
    func testMeterStyleSlots() throws { for index in 12..<18 { try select(index); try observe(names[index]) } }
    func testMeterStyleProviders() throws {
        tap("Dark theme"); wait("Dark provider") { (try? self.state()["mode"] as? String) == "dark" }
        for index in [0,11,14,15] { try select(index);try observe("dark-"+names[index]) }
    }
    func testMeterStyleConstraint() throws {
        let host = node("showcase-scene-shell"), liveWidth = host.frame.width
        XCTAssertGreaterThan(liveWidth,320)
        let rangeWidth = node("range-meter").frame.width
        try select(4);try observe("before-compact")
        tap("Compact width");XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label CONTAINS %@","Fixture: compact")).firstMatch.exists)
        XCTAssertEqual(host.frame.width,320,accuracy:1/UIScreen.main.scale,"Actual bounded320-point native host")
        XCTAssertEqual(node("range-meter").frame.width,298,accuracy:1/UIScreen.main.scale,"Actual percentage Meter in bordered/padded host")
        XCTAssertEqual(node("range-meter").value as? String,"-25")
        try observe("compact")
        tap("Live window");try observe("live-restored")
        XCTAssertEqual(host.frame.width,liveWidth,accuracy:1/UIScreen.main.scale)
        XCTAssertEqual(node("range-meter").frame.width,rangeWidth,accuracy:1/UIScreen.main.scale)
        XCTAssertEqual(node("range-meter").value as? String,"-25")
        FileHandle.standardOutput.write(Data(("METER_STYLE_HOST_WIDTHS "+[liveWidth,320,host.frame.width].map { String(Double($0)) }.joined(separator:",")+"\n").utf8))
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }
    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
    func testMeterStyleMotionAndReset() throws {
        let settings = XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch()
        let initial = motionSwitch(settings), original = try XCTUnwrap(initial.value as? String)
        XCTAssertTrue(["0","1"].contains(original))
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock { [self] in
            let toggle = self.motionSwitch(settings)
            self.setMotion(toggle,original)
            XCTAssertEqual(toggle.value as? String,original,"Exact original Reduce Motion restoration")
            self.app.activate()
            FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))
        }
        if initial.value as? String != "0" {
            setMotion(initial,"0");app.activate();reveal(node("meter-style-state"),blocked:true)
            _ = motionSwitch(settings)
        }
        setMotion(settings.switches["Reduce Motion"].firstMatch,"1");app.activate();reveal(node("meter-style-state"),blocked:true)
        wait("Native public reduced event") { ((try? self.state()["motionEvents"] as? [Bool]) ?? []).last == true }
        tap("Change Meter style value");wait("Reduced current value") { (try? self.number(self.state(),"value")) == 75 };try observe("reduced-value75")
        let reduced = motionSwitch(settings);XCTAssertEqual(reduced.value as? String,"1");setMotion(reduced,"0");app.activate();reveal(node("meter-style-state"),blocked:true)
        wait("Native public motion restoration") { ((try? self.state()["motionEvents"] as? [Bool]) ?? []).last == false }
        tap("Change Meter style value");wait("Current restored value") { (try? self.number(self.state(),"value")) == 25 };try observe("motion-restored-value25")
    }
    func testMeterStyleReset() throws {
        try select(11);tap("Change Meter style value");wait("Changed owner") { (try? self.number(self.state(),"value")) == 75 }
        tap("Prepare Meter styles");wait("Explicit defaults") { (try? self.state()["case"] as? String) == "semantic" && (try? self.number(self.state(),"value")) == 25 };try observe("explicit-reset")
    }
    func testRestoreMeterStyleMotionSetting() throws {
        let expected = try XCTUnwrap(ProcessInfo.processInfo.environment["CODON_METER_RESTORE_MOTION"])
        XCTAssertTrue(["0","1"].contains(expected))
        let settings = XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch()
        let toggle = motionSwitch(settings)
        setMotion(toggle,expected)
        XCTAssertEqual(toggle.value as? String,expected,"Restore exact captured original setting")
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-restored-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+expected+"\n").utf8))
    }
    func testMeterStyleZeroWidth() throws { try select(2);try observe("zero-width") }
    func testMeterStyleRemainingDimensions() throws { for index in [3,4,5] { try select(index);try observe(names[index]) } }
    func testMeterStyleRaised() throws { try select(17);try observe("raised") }

    private var progressRiskTrackRGBA: [UInt8] = []
    private func progressRiskCapture(_ name: String, unknown: Bool, events: [Bool]) throws -> [UInt8] {
        let target = node("range-progress"); reveal(target,blocked:true)
        XCTAssertEqual(app.descendants(matching:.any).matching(identifier:"range-progress").count,1)
        XCTAssertEqual(target.label,"Task progress")
        let value = target.value
        if unknown { XCTAssertTrue(value == nil || value is NSNull || (value as? String) == "","Unknown must retire the native percentage") }
        else { XCTAssertEqual(value as? String,"25%") }
        let frame = target.frame, window = app.windows.firstMatch.frame
        let shot = XCUIScreen.main.screenshot(), image = try XCTUnwrap(shot.image.cgImage)
        XCTAssertEqual(shot.image.imageOrientation,.up)
        let scale = CGFloat(image.width)/window.width
        XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        XCTAssertTrue(window.contains(frame));XCTAssertEqual(frame.height,14,accuracy:1/scale)
        let attachment = XCTAttachment(screenshot:shot);attachment.name="linear-progress-risk-"+name;attachment.lifetime = .keepAlways;add(attachment)
        let crop = try pixels(image,frame,window,scale)
        var row: [String:Any] = ["name":name,"unknown":unknown,"nativeLabel":target.label,"nativeValue":value ?? NSNull(),"elementType":target.elementType.rawValue,"frame":frameValues(frame),"window":frameValues(window),"scale":Double(scale),"captureEpochMs":Date().timeIntervalSince1970*1000,"motionEvents":events,"pixelBytes":crop.count]
        if unknown {
            let center = CGRect(x:frame.midX-6,y:frame.minY+3,width:12,height:frame.height-6)
            let bytes = try pixels(image,center,window,scale)
            XCTAssertEqual(progressRiskTrackRGBA.count,4,"Captured actual empty-track sample required")
            let painted = stride(from:0,to:bytes.count,by:4).filter { i in bytes[i] != progressRiskTrackRGBA[0] || bytes[i+1] != progressRiskTrackRGBA[1] || bytes[i+2] != progressRiskTrackRGBA[2] }.count
            row["centerBackgroundRGBA"]=progressRiskTrackRGBA
            XCTAssertGreaterThan(painted,0,"Actual unknown cue must remain visibly centered")
            row["centerPaintedPixels"]=painted
        } else {
            let reference = node("range-meter");XCTAssertTrue(reference.exists && window.contains(reference.frame))
            XCTAssertEqual(frame.width,reference.frame.width,accuracy:1/scale)
            var samples: [[String:Any]] = []
            for fraction in [CGFloat(0.125),CGFloat(0.625)] {
                let a = CGRect(x:frame.minX+frame.width*fraction,y:frame.midY,width:1,height:1)
                let b = CGRect(x:reference.frame.minX+reference.frame.width*fraction,y:reference.frame.midY,width:1,height:1)
                let actual = try pixels(image,a,window,scale), expected = try pixels(image,b,window,scale)
                XCTAssertTrue(stylePixelsMatch(actual,expected),"Actual known LP/shared-host opaque paint")
                samples.append(["rgba":actual,"referenceRGBA":expected])
            }
            XCTAssertNotEqual(samples[0]["rgba"] as? [UInt8],samples[1]["rgba"] as? [UInt8])
            row["samples"]=samples
            progressRiskTrackRGBA=Array(try XCTUnwrap(samples[1]["rgba"] as? [UInt8]).prefix(4))
        }
        let data = try JSONSerialization.data(withJSONObject:row,options:[.sortedKeys])
        FileHandle.standardOutput.write(Data("LINEAR_PROGRESS_RISK_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let receipt = XCTAttachment(data:data,uniformTypeIdentifier:"public.json");receipt.name="linear-progress-risk-"+name+"-receipt";receipt.lifetime = .keepAlways;add(receipt)
        return crop
    }
    func testLinearProgressLiveMotion() throws {
        tap("Toggle range styles")
        _ = try progressRiskCapture("known-styled",unknown:false,events:[])
        let settings = XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch()
        let initial = motionSwitch(settings), original = try XCTUnwrap(initial.value as? String)
        XCTAssertTrue(["0","1"].contains(original))
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock { [self] in
            let toggle = self.motionSwitch(settings);self.setMotion(toggle,original)
            XCTAssertEqual(toggle.value as? String,original,"Exact original Reduce Motion restoration")
            self.app.activate()
            FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))
        }
        setMotion(initial,"0");app.activate();reveal(node("meter-style-state"),blocked:true)
        let movingEvents = (try state()["motionEvents"] as? [Bool]) ?? []
        tap("Toggle unknown progress");Thread.sleep(forTimeInterval:0.5)
        let a = try progressRiskCapture("moving-0",unknown:true,events:movingEvents)
        Thread.sleep(forTimeInterval:0.17)
        let b = try progressRiskCapture("moving-1",unknown:true,events:movingEvents)
        Thread.sleep(forTimeInterval:0.29)
        let c = try progressRiskCapture("moving-2",unknown:true,events:movingEvents)
        XCTAssertTrue(!stylePixelsMatch(a,b) || !stylePixelsMatch(b,c),"A real native unknown motion interval is required")
        let reduced = motionSwitch(settings);setMotion(reduced,"1");app.activate();reveal(node("meter-style-state"),blocked:true)
        wait("Actual native public Reduce Motion event") { ((try? self.state()["motionEvents"] as? [Bool]) ?? []).last == true }
        let stoppedEvents = try XCTUnwrap(try state()["motionEvents"] as? [Bool]);Thread.sleep(forTimeInterval:0.5)
        let x = try progressRiskCapture("stopped-0",unknown:true,events:stoppedEvents)
        Thread.sleep(forTimeInterval:0.17)
        let y = try progressRiskCapture("stopped-1",unknown:true,events:stoppedEvents)
        Thread.sleep(forTimeInterval:0.29)
        let z = try progressRiskCapture("stopped-2",unknown:true,events:stoppedEvents)
        XCTAssertTrue(stylePixelsMatch(x,y) && stylePixelsMatch(y,z),"Reduced unknown cue must stay visible and static")
        tap("Toggle unknown progress");Thread.sleep(forTimeInterval:0.5)
        _ = try progressRiskCapture("known-restored",unknown:false,events:stoppedEvents)
        FileHandle.standardOutput.write(Data("LINEAR_PROGRESS_RISK_INTERVALS movingDifferent=true stoppedExact=true\n".utf8))
    }

    func testMeterStyleAReferenceControl() throws {
        func capture(_ label: String) throws -> ([CGRect],Bool,Int) {
            reveal(node("meter-style-pair"),blocked:true)
            let a = node("meter-style-parent").frame, b = node("meter-style-reference-parent").frame, window = app.windows.firstMatch.frame
            let shot = XCUIScreen.main.screenshot(), image = try XCTUnwrap(shot.image.cgImage)
            let attachment = XCTAttachment(screenshot:shot);attachment.name="meter-style-reference-control-"+label;attachment.lifetime = .keepAlways;add(attachment)
            let scale = CGFloat(image.width)/window.width
            let x = try pixels(image,a,window,scale), y = try pixels(image,b,window,scale)
            XCTAssertEqual(x.count,y.count)
            let different = stride(from:0,to:x.count,by:4).filter { offset in (0..<4).contains { x[offset+$0] != y[offset+$0] } }.count
            return ([a,b],stylePixelsMatch(x,y),different)
        }
        try select(17)
        let component = try capture("component")
        tap("Compare raw Meter style references")
        wait("Two identical raw references") { (try? self.state()["rawReferences"] as? Bool) == true }
        XCTAssertNotEqual(node("meter-style-target").label,"Style meter","Stock control must not claim the component's semantics")
        let controls = try capture("two-raw")
        for (before,after) in zip(component.0,controls.0) {
            for (a,b) in zip(frameValues(before),frameValues(after)) { XCTAssertEqual(a,b,accuracy:1/UIScreen.main.scale,"Matched physical capture positions") }
        }
        let current = try state();XCTAssertEqual(current["case"] as? String,"raised");XCTAssertEqual(try number(current,"value"),25)
        let layouts = try XCTUnwrap(current["layouts"] as? [String:Any])
        for owner in ["target","reference"] {
            let event = try XCTUnwrap(layouts[owner] as? [String:Any]), box = try XCTUnwrap(event["layout"] as? [String:Any])
            XCTAssertEqual(try number(event,"nativeTarget"),try number(event,"currentTarget"));XCTAssertGreaterThan(try number(event,"nativeTarget"),0)
            XCTAssertEqual(try number(box,"width"),150,accuracy:1/UIScreen.main.scale);XCTAssertEqual(try number(box,"height"),20,accuracy:1/UIScreen.main.scale)
        }
        let row: [String:Any] = ["kind":"stock-reference-diagnostic-only","componentPairExact":component.1,"componentDifferencePixels":component.2,"rawReferencePairExact":controls.1,"rawReferenceDifferencePixels":controls.2,"matchedNativeParents":controls.0.map(frameValues),"matchedPositions":true,"state":current]
        let data = try JSONSerialization.data(withJSONObject:row,options:.sortedKeys)
        FileHandle.standardOutput.write(Data("METER_STYLE_REFERENCE_CONTROL ".utf8)+data+Data("\n".utf8))
        let receipt = XCTAttachment(data:data,uniformTypeIdentifier:"public.json");receipt.name="meter-style-reference-control-receipt";receipt.lifetime = .keepAlways;add(receipt)
    }
}


final class TextStyleTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private let content = "Native text remains readable: sélectionnez les paramètres et continuez lorsque vous êtes prêt."
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch()
        XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Text/Button scene");tap("Light theme");tap("Live window")
    }
    override func tearDownWithError() throws {
        let screenshot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());screenshot.name="text-style-final";screenshot.lifetime = .keepAlways;add(screenshot)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="text-style-final-hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
    }
    private func node(_ id:String)->XCUIElement { app.descendants(matching:.any).matching(identifier:id).firstMatch }
    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame) && element.isHittable { return }
            let upward=element.frame.minY<viewport.minY
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:upward ? 0.30:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:upward ? 0.70:0.35)))
        }
        XCTFail("Unreachable actual Text element "+element.identifier)
    }
    private func tap(_ label:String) {
        let button=app.buttons.matching(NSPredicate(format:"label == %@",label)).firstMatch;reveal(button);button.tap()
        if label == "Text/Button scene" {
            let selected=XCTNSPredicateExpectation(predicate:NSPredicate { _,_ in button.isSelected },object:nil)
            XCTAssertEqual(XCTWaiter.wait(for:[selected],timeout:nativeWorkRemaining()),.completed,"Actual selected Text scene before capture")
        }
    }
    private func capture(_ name:String,dark:Bool=false) throws -> CGRect {
        let target=node("library-text-preview");reveal(target);XCTAssertEqual(target.label,content);XCTAssertEqual(target.elementType,.staticText)
        Thread.sleep(forTimeInterval:0.35)
        let frame=target.frame,window=app.windows.firstMatch.frame,screenshot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(screenshot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertTrue(window.contains(frame));XCTAssertGreaterThan(frame.height,0)
        let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let drawn=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else {return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(drawn)
        let foreground:UInt8=dark ? 255:23
        var count=0
        for index in stride(from:0,to:bytes.count,by:4) {
            if bytes[index]==foreground && bytes[index+1]==foreground && bytes[index+2]==foreground && bytes[index+3]==255 { count += 1 }
        }
        XCTAssertGreaterThan(count,0,"Actual expected foreground must paint native text")
        XCTAssertEqual(target.frame,frame);XCTAssertEqual(target.label,content)
        let row:[String:Any]=["name":name,"text":target.label,"frame":[Double(frame.minX),Double(frame.minY),Double(frame.width),Double(frame.height)],"scale":Double(scale),"expectedRGB":dark ? 16777215:1513239,"foregroundPixels":count,"nativeElementType":target.elementType.rawValue,"captureEpochMs":Date().timeIntervalSince1970*1000,"imageWidth":image.width,"imageHeight":image.height,"stableFrameAndContent":true]
        let data=try JSONSerialization.data(withJSONObject:row,options:[.sortedKeys]);FileHandle.standardOutput.write(Data("TEXT_STYLE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let receipt=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");receipt.name="text-style-"+name+"-receipt";receipt.lifetime = .keepAlways;add(receipt)
        let shot=XCTAttachment(screenshot:screenshot);shot.name="text-style-"+name;shot.lifetime = .keepAlways;add(shot);return frame
    }
    func testTextTypographyAndClear() throws {
        let initial=try capture("default");tap("Toggle library styles");let custom=try capture("custom")
        XCTAssertGreaterThan(custom.height,initial.height,"Custom typography must affect actual native layout")
        tap("Clear text typography");let cleared=try capture("cleared");XCTAssertEqual(cleared.width,initial.width,accuracy:1/UIScreen.main.scale);XCTAssertEqual(cleared.height,initial.height,accuracy:1/UIScreen.main.scale)
        tap("Toggle library styles");tap("Clear text typography");let restored=try capture("restored");XCTAssertEqual(restored.height,initial.height,accuracy:1/UIScreen.main.scale)
    }
    func testTextProviderChange() throws {
        let light=try capture("light");tap("Dark theme");let dark=try capture("dark",dark:true);XCTAssertEqual(dark.size,light.size)
    }
    func testTextCompactAndLiveRestoration() throws {
        let target=node("library-text-preview");reveal(target);XCTAssertEqual(target.label,content);let initial=target.frame
        tap("Compact width");let compact=try capture("compact");XCTAssertLessThanOrEqual(compact.width,320);XCTAssertGreaterThan(compact.height,14)
        tap("Live window");let restored=try capture("live-restored");XCTAssertEqual(restored.size,initial.size)
    }
}

private func circularPixelsMatch(_ actual: [UInt8], _ expected: [UInt8]) -> Bool {
    !actual.isEmpty && actual.count % 4 == 0 && actual == expected
}

final class CircularProgressTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private let cases = ["quarter","zero","full","lower-clamp","upper-clamp","empty-range","half","reverse","round","square","wide","zero-width","zero-height","six-slots","named-paint","current-color","context-label","empty-label","node-label","unknown"]
    private var originalTag: Double = 0
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch()
        XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Circular/Counter scene");tap("Light theme");tap("Live window");tap("Prepare CircularProgress checks")
        wait("Actual delivered CircularProgress root and layout") {
            guard let row=try? self.state(),let tag=row["rootTag"] as? NSNumber,let layouts=row["layouts"] as? [String:Any] else {return false}
            return tag.doubleValue>0 && layouts["target"] != nil
        }
        originalTag=try number(state(),"rootTag")
    }
    override func tearDownWithError() throws {
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="circular-final";shot.lifetime = .keepAlways;add(shot)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="circular-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}
    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let gate=XCTNSPredicateExpectation(predicate:NSPredicate { _,_ in predicate() },object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[gate],timeout:nativeWorkRemaining()),.completed,message)
    }
    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()))
        let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame) {return}
            let up=element.frame.minY<viewport.minY
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.30:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.70:0.35)))
        }
        XCTFail("Unreachable actual CircularProgress element "+element.identifier)
    }
    private func tap(_ label:String) {
        let button=app.buttons.matching(NSPredicate(format:"label == %@",label)).firstMatch;reveal(button);XCTAssertTrue(button.isHittable);button.tap()
        if label == "Circular/Counter scene" {wait("Actual selected Circular scene") {button.isSelected}}
    }
    private func state() throws -> [String:Any] {
        guard let row=try JSONSerialization.jsonObject(with:Data(node("circular-native-state").label.utf8)) as? [String:Any] else {throw NSError(domain:"CircularNativeState",code:1)}
        return row
    }
    private func number(_ row:[String:Any],_ key:String) throws -> Double {
        let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value
    }
    private func select(_ index:Int) throws {
        for _ in 0...cases.count {
            let current=try state();if try number(current,"index")==Double(index) {XCTAssertEqual(current["case"] as? String,cases[index]);return}
            let next=(Int(try number(current,"index"))+1)%cases.count;tap("Next CircularProgress check")
            wait("Actual caller-owned case") {(try? self.number(self.state(),"index"))==Double(next)}
        };XCTFail("CircularProgress case selection failed")
    }
    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let ok=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else {return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(ok);return bytes
    }
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot) throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys)
        FileHandle.standardOutput.write(Data("CIRCULAR_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let receipt=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");receipt.name="circular-"+name+"-receipt";receipt.lifetime = .keepAlways;add(receipt)
        let image=XCTAttachment(screenshot:shot);image.name="circular-"+name;image.lifetime = .keepAlways;add(image)
    }
    private func capture(_ name:String) throws {
        reveal(node("circular-native-pair"));Thread.sleep(forTimeInterval:0.5)
        let row=try state(),kind=try XCTUnwrap(row["case"] as? String),index=Int(try number(row,"index"))
        XCTAssertEqual(try number(row,"rootTag"),originalTag,"Retain actual caller View ref across case/provider updates")
        XCTAssertEqual(try number(row,"detaches"),0)
        let layouts=try XCTUnwrap(row["layouts"] as? [String:Any]),event=try XCTUnwrap(layouts["target"] as? [String:Any]),layout=try XCTUnwrap(event["layout"] as? [String:Any])
        XCTAssertEqual(try number(event,"target"),originalTag);XCTAssertEqual(try number(event,"currentTarget"),originalTag)
        XCTAssertEqual(try number(layout,"width"),try number(row,"width"),accuracy:1/UIScreen.main.scale)
        XCTAssertEqual(try number(layout,"height"),try number(row,"height"),accuracy:1/UIScreen.main.scale)
        let target=node("circular-native-target"),window=app.windows.firstMatch.frame,a=node("circular-native-parent").frame,b=node("circular-native-reference-parent").frame
        let shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01);XCTAssertEqual(shot.image.imageOrientation,.up)
        let actual=try pixels(image,a,window,scale),reference=try pixels(image,b,window,scale)
        let exact=circularPixelsMatch(actual,reference)
        var ink=0;for i in stride(from:0,to:actual.count,by:4) {if actual[i]<245 || actual[i+1]<245 || actual[i+2]<245 {ink += 1}}
        try mark(name+"-raw",["name":name+"-raw","state":row,"parent":[a.minX,a.minY,a.width,a.height],"referenceParent":[b.minX,b.minY,b.width,b.height],"scale":scale,"referenceExact":exact,"inkPixels":ink],shot)
        if ![11,12,16].contains(index) {XCTAssertGreaterThan(ink,0,"Real SVG paint required");XCTAssertTrue(exact,"Actual native SVG versus independent primitive reference for "+kind)}
        if [11,12].contains(index) {XCTAssertEqual(ink,0,"Zero dimension paints no neighboring geometry")}
        if ![11,12].contains(index) {
            XCTAssertTrue(target.exists,"Required native CircularProgress target")
            XCTAssertEqual(app.descendants(matching:.any).matching(identifier:"circular-native-target").count,1)
            XCTAssertEqual(target.label,index==16 ? "Scoped circular task":"Circular verification")
            if index==19 {XCTAssertTrue(target.value == nil || (target.value as? String)=="")}
            else if index==18 {XCTAssertEqual(target.value as? String,"[object Object]")}
            else if index==16 {XCTAssertEqual(target.value as? String,"13%")}
            else if index==5 {XCTAssertEqual(target.value as? String,"NaN%")}
            else {XCTAssertEqual(target.value as? String,index==1 || index==3 ? "0%":index==2 || index==4 ? "100%":"25%")}
        }
        XCTAssertFalse(app.staticTexts["Semantic node stays unmounted"].exists)
        try mark(name,["name":name,"state":row,"nativeLabel":target.exists ? target.label:"","nativeValue":target.exists ? target.value ?? NSNull():NSNull(),"parent":[a.minX,a.minY,a.width,a.height],"referenceParent":[b.minX,b.minY,b.width,b.height],"scale":scale,"referenceExact":exact,"inkPixels":ink,"captureEpochMs":Date().timeIntervalSince1970*1000],shot)
    }
    func testCircularGeometrySemanticsAndSlots() throws {
        for index in 0..<cases.count {try select(index);try capture(cases[index])}
    }
    func testCircularProvidersAndConstraint() throws {
        try capture("light");tap("Dark theme");try capture("dark");tap("Compact width");try capture("compact");tap("Live window");try capture("live-restored")
        tap("Change CircularProgress value");wait("Current caller value75") {(try? self.number(self.state(),"value"))==75}
        reveal(node("circular-native-pair"));Thread.sleep(forTimeInterval:0.5)
        XCTAssertEqual(node("circular-native-target").value as? String,"75%")
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }
    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
    private func observeCircularMotion(_ label:String,reduced:Bool) throws {
        reveal(node("circular-native-pair"))
        let arm=app.buttons.matching(NSPredicate(format:"label == %@","Arm CircularProgress interruption and retirement")).firstMatch
        let window=app.windows.firstMatch.frame,a=node("circular-native-parent").frame,b=node("circular-native-reference-parent").frame
        XCTAssertTrue(window.contains(arm.frame) && arm.isHittable,"Admit arm control and drawing together before starting timers")
        let before=try state()
        arm.tap()
        var samples:[[String:Any]]=[]
        let until=Date().timeIntervalSince1970+10
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
            let actual=try pixels(image,a,window,scale),reference=try pixels(image,b,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4) {if actual[i]<245 || actual[i+1]<245 || actual[i+2]<245 {ink += 1}}
            let row:[String:Any]=["name":label+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"inkPixels":ink,"referenceExact":circularPixelsMatch(actual,reference),"parent":[a.minX,a.minY,a.width,a.height],"referenceParent":[b.minX,b.minY,b.width,b.height],"scale":scale]
            samples.append(row);try mark(label+"-"+String(samples.count),row,shot);Thread.sleep(forTimeInterval:0.1)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let row=try state(),scheduled=try XCTUnwrap(row["scheduled"] as? [[String:Any]])
        XCTAssertEqual(scheduled.compactMap{$0["kind"] as? String},["to-full","supersede-ten","to-sixty","to-twenty","to-ninety","retire","reinsert-zero"])
        let first=try number(scheduled[0],"epochMs"),retired=try number(scheduled[5],"epochMs")
        let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=first && ($0["captureEpochMs"] as? Double ?? .infinity)<retired}
        XCTAssertGreaterThan(moving.count,2,"Actual screenshots must cover delivered transitions, before retirement")
        if reduced {XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true},"Live reduced motion must draw the current native target without moving intermediate paint")}
        else {XCTAssertTrue(moving.contains{$0["referenceExact"] as? Bool==false},"Actual normal path motion must differ from the immediate raw reference at an intermediate frame")}
        XCTAssertEqual(try number(row,"value"),0);XCTAssertEqual(row["visible"] as? Bool,true)
        XCTAssertEqual(try number(row,"detaches"),try number(before,"detaches")+1);XCTAssertEqual(try number(row,"attaches"),try number(before,"attaches")+1)
        XCTAssertNotEqual(try number(row,"rootTag"),try number(before,"rootTag"));XCTAssertEqual(node("circular-native-target").value as? String,"0%")
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Observe actual retired drawing before fresh insertion")
        XCTAssertEqual(node("circular-native-parent").frame,a,"No observer scrolling after arm or native parent movement")
        try mark(label+"-final",["name":label+"-final","state":row,"samples":samples,"movingRows":moving.count,"reduced":reduced],XCUIScreen.main.screenshot())
    }
    func testCircularInterruptionAndRetirement() throws {
        let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch()
        let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String)
        XCTAssertTrue(["0","1"].contains(original))
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock { [self] in
            let current=self.motionSwitch(settings);self.setMotion(current,original)
            XCTAssertEqual(current.value as? String,original);self.app.activate()
            FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))
        }
        setMotion(toggle,"0");app.activate();try observeCircularMotion("motion",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("circular-native-state"))
        wait("Actual live Reduce Motion event") {((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true}
        try observeCircularMotion("reduced",reduced:true)
    }
}


final class CircleLoaderTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private var original: [String:Any] = [:]
    override func setUpWithError() throws {
        continueAfterFailure=false
        app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground)
        XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Loading scene");tap("Light theme");tap("Live window")
        wait("Actual CircleLoader ref/layout") {
            guard let state=try? self.state(),let tag=state["rootTag"] as? NSNumber else{return false}
            return tag.intValue>0 && state["layout"] is [String:Any]
        };original=try state()
    }
    override func tearDownWithError() throws {
        let shot=XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="circle-loader-final";shot.lifetime = .keepAlways;add(shot)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="circle-loader-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}
    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }
    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            let up=element.frame.minY<viewport.minY
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.30:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.70:0.35)))
        };XCTFail("Unreachable CircleLoader control/canvas "+element.identifier)
    }
    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Loading scene"{wait("Actual selected Loading scene"){control.isSelected}}
    }
    private func state() throws -> [String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("loading-native-state").label.utf8)) as? [String:Any])}
    private func number(_ value:[String:Any],_ name:String) throws -> Double {
        let result=try XCTUnwrap(value[name] as? NSNumber,name).doubleValue;XCTAssertTrue(result.isFinite);return result
    }
    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func mark(_ row:[String:Any],_ shot:XCUIScreenshot) throws {
        let name=try XCTUnwrap(row["name"] as? String),data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys)
        FileHandle.standardOutput.write(Data("CIRCLE_LOADER_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let json=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");json.name="circle-loader-"+name+"-receipt";json.lifetime = .keepAlways;add(json)
        let image=XCTAttachment(screenshot:shot);image.name="circle-loader-"+name;image.lifetime = .keepAlways;add(image)
    }
    @discardableResult private func capture(_ name:String,staticPaint:Bool) throws -> [UInt8] {
        reveal(node("loading-circle-pair"));let current=try state(),window=app.windows.firstMatch.frame,a=node("loading-circle-parent").frame,b=node("loading-circle-reference-parent").frame
        let shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01);XCTAssertEqual(shot.image.imageOrientation,.up)
        let actual=try pixels(image,a,window,scale),reference=try pixels(image,b,window,scale),target=node("loading-circle")
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i]<255 || actual[i+1]<255 || actual[i+2]<255{ink += 1}}
        let row:[String:Any]=["name":name,"state":current,"parent":[a.minX,a.minY,a.width,a.height],"referenceParent":[b.minX,b.minY,b.width,b.height],"scale":scale,"imageWidth":image.width,"imageHeight":image.height,"referenceExact":circularPixelsMatch(actual,reference),"inkPixels":ink,"nativeType":target.exists ? target.elementType.rawValue : -1,"nativeLabel":target.exists ? target.label:"","nativeValue":target.exists ? target.value ?? NSNull():NSNull(),"captureEpochMs":Date().timeIntervalSince1970*1000]
        try mark(row,shot)
        if current["visible"] as? Bool==false {XCTAssertFalse(target.exists);XCTAssertEqual(ink,0);return actual}
        XCTAssertEqual(try number(current,"rootTag"),try number(original,"rootTag"));XCTAssertEqual(try number(current,"detaches"),try number(original,"detaches"))
        let event=try XCTUnwrap(current["layout"] as? [String:Any]),layout=try XCTUnwrap(event["layout"] as? [String:Any])
        XCTAssertEqual(try number(event,"eventTarget"),try number(current,"rootTag"));XCTAssertEqual(try number(event,"currentTarget"),try number(current,"rootTag"))
        for key in ["width","height"]{XCTAssertEqual(try number(layout,key),try number(current,key=="width" ? "rootWidth":"rootHeight"),accuracy:1/Double(scale))}
        if try number(current,"size")>0 {
            XCTAssertTrue(target.exists);XCTAssertEqual(target.label,"Saving circle")
            XCTAssertTrue(target.elementType == .other || target.elementType == .progressIndicator)
            XCTAssertNil((target.value as? String)?.range(of:"[0-9]",options:.regularExpression),"Indeterminate loader must not invent numeric value")
            XCTAssertGreaterThan(ink,0)
        } else {XCTAssertEqual(ink,0,"Exactly white parent for zero ring")}
        if staticPaint{XCTAssertTrue(circularPixelsMatch(actual,reference),"Actual static ring against independent native reference")}
        return actual
    }
    private func snapshots(_ label:String,moving:Bool) throws {
        if moving{Thread.sleep(forTimeInterval:1.7)}
        var values:[[UInt8]]=[]
        for index in 0..<4 {values.append(try capture(label+"-"+String(index),staticPaint:!moving));Thread.sleep(forTimeInterval:index%2==0 ? 0.17:0.29)}
        let changes=zip(values,values.dropFirst()).filter{!circularPixelsMatch($0.0,$0.1)}.count
        let report:[String:Any]=["name":label,"frames":values.count,"changedPairs":changes,"moving":moving]
        let reportData=try JSONSerialization.data(withJSONObject:report,options:.sortedKeys)
        FileHandle.standardOutput.write(Data("CIRCLE_LOADER_MOTION ".utf8)+reportData+Data("\n".utf8))
        if moving{XCTAssertGreaterThan(changes,0,"Real repeating native motion after two default periods")}
        else{XCTAssertTrue(values.dropFirst().allSatisfy{circularPixelsMatch(values[0],$0)},"Stopped/reduced native frame must remain exact")}
    }
    func testCircleLoaderGeometryAndProviders() throws {
        tap("Toggle stopped motion");try capture("default",staticPaint:true)
        tap("Next circle size");try capture("large",staticPaint:true)
        tap("Next circle size");try capture("zero",staticPaint:true)
        tap("Next circle size");tap("Toggle fractional circle");try capture("fractional",staticPaint:true)
        tap("Toggle loader styles");try capture("root-independent",staticPaint:true)
        tap("Toggle loader colors");try capture("explicit-colors",staticPaint:true)
        tap("Toggle transparent track");try capture("transparent",staticPaint:true)
        tap("Toggle transparent track");try capture("track-restored",staticPaint:true)
        tap("Toggle loader colors");try capture("foreground-restored",staticPaint:true)
        tap("Toggle loader styles");tap("Toggle fractional circle");try capture("root-restored",staticPaint:true)
        tap("Dark theme");try capture("dark",staticPaint:true)
        tap("Compact width");try capture("compact",staticPaint:true)
        tap("Live window");try capture("live-restored",staticPaint:true)
        tap("Light theme");try capture("light-restored",staticPaint:true)
        let button=app.buttons["loading-owned-button"].firstMatch
        reveal(button)
        let hierarchy=XCTAttachment(string:app.debugDescription);hierarchy.name="circle-loader-button-hierarchy";hierarchy.lifetime = .keepAlways;add(hierarchy)
        FileHandle.standardOutput.write(Data(("CIRCLE_LOADER_BUTTON_LABEL "+button.label+"\n").utf8))
        XCTAssertEqual(button.label,"Saving example action","Owned loader stays decorative in Button content")
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }
    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
    func testCircleLoaderMotionAndRetirement() throws {
        let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch()
        let toggle=motionSwitch(settings),originalMotion=try XCTUnwrap(toggle.value as? String)
        XCTAssertTrue(["0","1"].contains(originalMotion));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+originalMotion+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,originalMotion);XCTAssertEqual(current.value as? String,originalMotion);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+originalMotion+"\n").utf8))}
        setMotion(toggle,"0");app.activate();try snapshots("moving",moving:true)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("loading-native-state"))
        wait("Live actual Reduce Motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true}
        try snapshots("reduced",moving:false)
        setMotion(motionSwitch(settings),"0");app.activate();reveal(node("loading-native-state"))
        wait("Live motion restoration event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false}
        try snapshots("resumed",moving:true)
        tap("Toggle stopped motion");try snapshots("duration-zero",moving:false)
        let previous=try state();tap("Toggle circle presence")
        wait("Actual ref null"){(try? self.state()["rootTag"]) is NSNull}
        try capture("retired",staticPaint:false);Thread.sleep(forTimeInterval:1.7);try capture("retired-quiet",staticPaint:false)
        let retired=try state();XCTAssertEqual(try number(retired,"detaches"),try number(previous,"detaches")+1)
        tap("Toggle circle presence");wait("Fresh real View ref"){((try? self.state()["rootTag"] as? NSNumber)?.doubleValue ?? 0)>0}
        original=try state();XCTAssertNotEqual(try number(original,"rootTag"),try number(previous,"rootTag"));XCTAssertEqual(try number(original,"attaches"),try number(previous,"attaches")+1)
        try capture("fresh-stopped",staticPaint:true);tap("Toggle stopped motion");try snapshots("fresh-moving",moving:true)
    }
}

final class LaggingLinesTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private var original: [String:Any] = [:]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Loading scene");tap("Light theme");tap("Live window")
        wait("Actual LaggingLines ref/layout/host") {guard let value=try? self.state() else{return false};return ((value["rootTag"] as? NSNumber)?.intValue ?? 0)>0 && value["layout"] is [String:Any] && ((value["hostWidth"] as? NSNumber)?.doubleValue ?? 0)>0};original=try state()
    }
    override func tearDownWithError() throws {
        let image=XCTAttachment(screenshot:XCUIScreen.main.screenshot());image.name="lagging-final";image.lifetime = .keepAlways;add(image)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="lagging-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws -> [String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("loading-lines-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String) throws -> Double {let result=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(result.isFinite);return result}
    private func rectangle(_ frame:CGRect)->[Double] {[frame.minX,frame.minY,frame.width,frame.height].map(Double.init)}
    @discardableResult private func capture(_ name:String,staticPaint:Bool) throws -> ([UInt8],[Double]) {
        reveal(node("loading-lines-pair"));let snapshot=try app.snapshot();var elements:[XCUIElementSnapshot]=[]
        func visit(_ item:XCUIElementSnapshot){elements.append(item);for child in item.children{visit(child)}};visit(snapshot)
        func identified(_ id:String)->XCUIElementSnapshot? {let matches=elements.filter{$0.identifier==id};XCTAssertLessThanOrEqual(matches.count,1,"Unique actual snapshot "+id);return matches.first}
        let current=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(identified("loading-lines-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(elements.first{$0.elementType == .window}).frame
        let parent=try XCTUnwrap(identified("loading-lines-parent")).frame,referenceParent=try XCTUnwrap(identified("loading-lines-reference-parent")).frame,host=identified("loading-lines-host")
        let target=identified("loading-lines"),track=identified("loading-lines-track"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),reference=try pixels(image,referenceParent,window,scale)
        let background:UInt8=current["mode"] as? String=="dark" ? 16:255
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != background || actual[i+1] != background || actual[i+2] != background{ink += 1}}
        var wrappers:[[Double]]=[],visuals:[[Double]]=[]
        for index in 0..<3 {if let wrapper=identified("loading-lines-motion-"+String(index)){wrappers.append(rectangle(wrapper.frame))};if let visual=identified("loading-lines-slide-"+String(index)){visuals.append(rectangle(visual.frame))}}
        let row:[String:Any]=["name":name,"state":current,"parent":rectangle(parent),"referenceParent":rectangle(referenceParent),"host":host.map{rectangle($0.frame)} ?? [],"backgroundRGB":[background,background,background],"target":target.map{rectangle($0.frame)} ?? [],"track":track.map{rectangle($0.frame)} ?? [],"wrappers":wrappers,"visuals":visuals,"scale":scale,"imageWidth":image.width,"imageHeight":image.height,"referenceExact":circularPixelsMatch(actual,reference),"inkPixels":ink,"nativeLabel":target?.label ?? "","nativeValue":target?.value ?? NSNull(),"captureEpochMs":Date().timeIntervalSince1970*1000]
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data("LAGGING_LINES_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let json=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");json.name="lagging-"+name+"-receipt";json.lifetime = .keepAlways;add(json);let png=XCTAttachment(screenshot:shot);png.name="lagging-"+name;png.lifetime = .keepAlways;add(png)
        XCTAssertEqual(Array(actual.prefix(4)),[background,background,background,255],"Actual opaque canvas background");XCTAssertEqual(Array(reference.prefix(4)),[background,background,background,255],"Reference opaque canvas background")
        XCTAssertEqual(parent.height,100);XCTAssertEqual(parent.size,referenceParent.size);XCTAssertLessThanOrEqual(parent.width,330)
        if current["visible"] as? Bool==false {XCTAssertNil(target);XCTAssertEqual(ink,0);return(actual,[])}
        XCTAssertEqual(try number(current,"rootTag"),try number(original,"rootTag"));XCTAssertEqual(try number(current,"detaches"),try number(original,"detaches"))
        let event=try XCTUnwrap(current["layout"] as? [String:Any]),layout=try XCTUnwrap(event["layout"] as? [String:Any]),width=try number(current,"rootWidth")
        XCTAssertEqual(try number(event,"eventTarget"),try number(current,"rootTag"));XCTAssertEqual(try number(event,"currentTarget"),try number(current,"rootTag"))
        XCTAssertEqual(try number(layout,"width"),width,accuracy:1/Double(scale));XCTAssertEqual(try number(layout,"height"),50,accuracy:1/Double(scale))
        if width==0 {if let root=target{XCTAssertEqual(root.frame.width,0,accuracy:1/scale)};if let currentTrack=track{XCTAssertEqual(currentTrack.frame.width,0,accuracy:1/scale)};XCTAssertEqual(ink,0);XCTAssertTrue(circularPixelsMatch(actual,reference));return(actual,[])}
        let root=try XCTUnwrap(target),trackFrame=try XCTUnwrap(track).frame,hostFrame=try XCTUnwrap(host).frame;XCTAssertEqual(root.label,"Fetching lines");XCTAssertEqual(root.value as? String,"busy")
        XCTAssertEqual(root.frame.width,width,accuracy:1/scale);XCTAssertEqual(root.frame.height,50,accuracy:1/scale);XCTAssertEqual(hostFrame.width,try number(current,"hostWidth"),accuracy:1/scale)
        XCTAssertEqual(hostFrame.height,current["custom"] as? Bool==true ? 60:50,accuracy:1/scale);XCTAssertEqual(trackFrame.width,width,accuracy:1/scale)
        XCTAssertEqual(wrappers.count,3);XCTAssertEqual(visuals.count,3);XCTAssertGreaterThan(ink,0)
        for index in 0..<3 {let wrapper=wrappers[index],visual=visuals[index],factor=[1.2,1.1,1.0][index];XCTAssertEqual(wrapper[2],Double(trackFrame.width)*0.2,accuracy:1/Double(scale));XCTAssertEqual(visual[2],wrapper[2]*factor,accuracy:1/Double(scale));XCTAssertEqual(visual[3],current["custom"] as? Bool==true ? 7:5,accuracy:1/Double(scale));XCTAssertGreaterThanOrEqual(wrapper[0],Double(trackFrame.minX)-1/Double(scale));XCTAssertLessThanOrEqual(wrapper[0],Double(trackFrame.maxX)+1/Double(scale));if staticPaint{XCTAssertEqual(wrapper[0],Double(trackFrame.minX),accuracy:1/Double(scale))}}
        if staticPaint{XCTAssertTrue(circularPixelsMatch(actual,reference),"Whole-parent exact independent native three-line reference")}
        return(actual,wrappers.map{$0[0]*Double(scale)})
    }
    private func snapshots(_ name:String,moving:Bool) throws {
        if moving{Thread.sleep(forTimeInterval:6.2)}
        var frames:[[UInt8]]=[],positions:[[Double]]=[]
        for index in 0..<4 {let captured=try capture(name+"-"+String(index),staticPaint:!moving);frames.append(captured.0);positions.append(captured.1);if index<3{Thread.sleep(forTimeInterval:[0.17,0.43,0.71][index])}}
        let changed=zip(frames,frames.dropFirst()).filter{!circularPixelsMatch($0.0,$0.1)}.count
        let perLine=(0..<3).map{index in zip(positions,positions.dropFirst()).filter{abs($0.0[index]-$0.1[index])>1}.count}
        let row:[String:Any]=["name":name,"frames":4,"moving":moving,"changedPairs":changed,"changedPairsPerLine":perLine];let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data("LAGGING_LINES_MOTION ".utf8)+data+Data("\n".utf8))
        if moving {XCTAssertGreaterThan(changed,0);XCTAssertTrue(perLine.allSatisfy{$0>0},"All three real wrappers continue moving beyond two default periods")}
        else{XCTAssertEqual(changed,0);XCTAssertEqual(perLine,[0,0,0])}
    }

    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            let up=element.frame.minY<viewport.minY
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.30:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.70:0.35)))
        };XCTFail("Unreachable CircleLoader control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Loading scene"{wait("Actual selected Loading scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }

    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
    func testLaggingLinesGeometryAndProviders() throws {
        tap("Toggle stopped motion");try capture("default",staticPaint:true)
        tap("Next line width");try capture("percentage",staticPaint:true)
        tap("Next line width");try capture("zero",staticPaint:true)
        tap("Next line width");tap("Toggle fractional lines");try capture("fractional",staticPaint:true)
        tap("Toggle loader styles");try capture("slide-slot-root",staticPaint:true)
        tap("Toggle loader colors");try capture("slide-overrides-explicit",staticPaint:true)
        tap("Toggle loader styles");try capture("explicit-foreground",staticPaint:true)
        tap("Toggle loader colors");try capture("restored-foreground",staticPaint:true)
        tap("Toggle fractional lines");try capture("numeric-restored",staticPaint:true)
        tap("Next line width");try capture("percentage-before-compact",staticPaint:true);let liveWidth=try number(state(),"rootWidth")
        tap("Dark theme");try capture("dark",staticPaint:true)
        tap("Compact width");try capture("compact",staticPaint:true);XCTAssertNotEqual(try number(state(),"rootWidth"),liveWidth)
        tap("Live window");try capture("live-restored",staticPaint:true);XCTAssertEqual(try number(state(),"rootWidth"),liveWidth,accuracy:1.0/3.0)
        tap("Light theme");try capture("light-restored",staticPaint:true)
        let button=app.buttons["loading-owned-button"].firstMatch;reveal(button)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="lagging-button-hierarchy";tree.lifetime = .keepAlways;add(tree)
        FileHandle.standardOutput.write(Data(("LAGGING_LINES_BUTTON_LABEL "+button.label+"\n").utf8));XCTAssertEqual(button.label,"Saving example action")
    }
    func testLaggingLinesMotionAndRetirement() throws {
        let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),originalMotion=try XCTUnwrap(toggle.value as? String)
        XCTAssertTrue(["0","1"].contains(originalMotion));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+originalMotion+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,originalMotion);XCTAssertEqual(current.value as? String,originalMotion);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+originalMotion+"\n").utf8))}
        setMotion(toggle,"0");app.activate();try snapshots("moving",moving:true)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("loading-lines-native-state"));wait("Real Reduce Motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try snapshots("reduced",moving:false)
        setMotion(motionSwitch(settings),"0");app.activate();reveal(node("loading-lines-native-state"));wait("Real motion restoration event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try snapshots("resumed",moving:true)
        tap("Toggle stopped motion");try snapshots("duration-zero",moving:false)
        let previous=try state();tap("Toggle lines presence");wait("Actual lines ref null"){(try? self.state()["rootTag"]) is NSNull}
        try capture("retired",staticPaint:false);Thread.sleep(forTimeInterval:6.2);try capture("retired-quiet",staticPaint:false);XCTAssertEqual(try number(state(),"detaches"),try number(previous,"detaches")+1)
        tap("Toggle lines presence");wait("Fresh actual lines ref"){((try? self.state()["rootTag"] as? NSNumber)?.doubleValue ?? 0)>0};original=try state();XCTAssertNotEqual(try number(original,"rootTag"),try number(previous,"rootTag"));XCTAssertEqual(try number(original,"attaches"),try number(previous,"attaches")+1)
        try capture("fresh-stopped",staticPaint:true);tap("Toggle stopped motion");try snapshots("fresh-moving",moving:true)
        tap("Next line width");try snapshots("resized-moving",moving:true)
    }
}


final class CounterTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private var originalTag: Double = 0
    private let cases=["baseline","zero","raw-string","warning","danger","numeric-max-zero","string-max-zero","raw-text","hidden-parts","three-slots","explicit-color","fractional","zero-width","auto-width","percentage"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Circular/Counter scene");tap("Light theme");tap("Live window");tap("Prepare Counter checks")
        wait("Actual Counter ref/layout") {guard let row=try? self.state() else{return false};return ((row["rootTag"] as? NSNumber)?.doubleValue ?? 0)>0 && (row["layouts"] as? [String:Any])?["target"] != nil};originalTag=try number(state(),"rootTag")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="counter-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="counter-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws -> [String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("counter-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String) throws -> Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot) throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data("COUNTER_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let json=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");json.name="counter-"+name+"-receipt";json.lifetime = .keepAlways;add(json)
        let png=XCTAttachment(screenshot:shot);png.name="counter-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        reveal(node("counter-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ item:XCUIElementSnapshot){all.append(item);for child in item.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,"Unique actual "+id);return values.first}
        let current=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("counter-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame
        let parent=try XCTUnwrap(one("counter-native-parent")).frame,reference=try XCTUnwrap(one("counter-native-reference-parent")).frame,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),background:UInt8=current["mode"] as? String=="dark" ? 16:255
        let target=one("counter-native-target"),value=one("counter-native-target-value"),suffix=one("counter-native-target-max"),ring=one("counter-native-target-progress"),child=one("counter-native-empty-child") ?? one("counter-native-child")
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != background || actual[i+1] != background || actual[i+2] != background {ink+=1}}
        let row:[String:Any]=["name":name,"state":current,"parent":rect(parent),"referenceParent":rect(reference),"target":target.map{rect($0.frame)} ?? [],"valueFrame":value.map{rect($0.frame)} ?? [],"valueLabel":value?.label ?? "","suffixLabel":suffix?.label ?? NSNull(),"ringLabel":ring?.label ?? NSNull(),"ringValue":ring?.value ?? NSNull(),"ringFrame":ring.map{rect($0.frame)} ?? [],"childFrame":child.map{rect($0.frame)} ?? [],"referenceExact":circularPixelsMatch(actual,expected),"inkPixels":ink,"scale":scale,"backgroundRGB":[background,background,background],"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,row,shot)
        XCTAssertEqual(Array(actual.prefix(4)),[background,background,background,255]);XCTAssertEqual(Array(expected.prefix(4)),[background,background,background,255]);XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,72)
        XCTAssertTrue(circularPixelsMatch(actual,expected),"Exact raw text/SVG/native child reference")
        XCTAssertEqual(try number(current,"rootTag"),originalTag);let layouts=try XCTUnwrap(current["layouts"] as? [String:Any]),event=try XCTUnwrap(layouts["target"] as? [String:Any]),layout=try XCTUnwrap(event["layout"] as? [String:Any])
        XCTAssertEqual(try number(event,"target"),originalTag);XCTAssertEqual(try number(event,"currentTarget"),originalTag)
        let named=current["case"] as? String ?? "",width=named=="zero-width" ? 0:named=="fractional" ? 183.25:["auto-width","percentage"].contains(named) ? Double(parent.width)-16:180
        XCTAssertEqual(try number(layout,"width"),width,accuracy:1/Double(scale));XCTAssertEqual(try number(layout,"height"),40,accuracy:1/Double(scale))
        if width>0 {XCTAssertEqual(try XCTUnwrap(target).frame.width,width,accuracy:1/scale);XCTAssertEqual(try XCTUnwrap(target).frame.height,40,accuracy:1/scale);XCTAssertGreaterThan(ink,0)}
        if width==0 {return}
        XCTAssertEqual(value?.label,String(describing:current["value"]!))
        if named != "motion" {
            let values=["zero":"0%","raw-string":"49%","warning":"80%","danger":"90%"]
            if !["numeric-max-zero","hidden-parts","string-max-zero","raw-text"].contains(named) {XCTAssertEqual(ring?.value as? String,values[named] ?? "25%")}
            let optional = !["numeric-max-zero","hidden-parts"].contains(named)
            if optional {XCTAssertEqual(ring?.label,"Native counter Progress");XCTAssertEqual(suffix?.label,"/"+String(describing:current["maxValue"]!));let size=named=="three-slots" ? 20.0:12.0;XCTAssertEqual(try XCTUnwrap(ring).frame.width,size,accuracy:1/scale);XCTAssertEqual(try XCTUnwrap(ring).frame.height,size,accuracy:1/scale)}
            else {XCTAssertNil(ring);XCTAssertNil(suffix)}
            if named != "three-slots" {let frame=try XCTUnwrap(child).frame;XCTAssertEqual(frame.width,20,accuracy:1/scale);XCTAssertEqual(frame.height,20,accuracy:1/scale)}
        }
    }
    func testCounterValuesStylesAndProviders() throws {
        for name in cases {
            wait("Current Counter case "+name){(try? self.state()["case"] as? String)==name};try capture(name)
            if name=="baseline" {
                node("counter-native-target").coordinate(withNormalizedOffset:CGVector(dx:0.97,dy:0.95)).tap()
                wait("Original Counter touch") {((try? self.state()["contacts"] as? [[String:Any]]) ?? []).count>0}
                let contact=try XCTUnwrap((try state()["contacts"] as? [[String:Any]])?.last);XCTAssertEqual(try number(contact,"currentTarget"),originalTag);XCTAssertGreaterThan(try number(contact,"target"),0)
                FileHandle.standardOutput.write(Data("COUNTER_NATIVE_TOUCH ".utf8)+(try JSONSerialization.data(withJSONObject:contact,options:.sortedKeys))+Data("\n".utf8))
            }
            if name != cases.last {tap("Next Counter check")}
        }
        let originalLayout=try XCTUnwrap(try XCTUnwrap(try state()["layouts"] as? [String:Any])["target"] as? [String:Any])
        let before=try number(try XCTUnwrap(originalLayout["layout"] as? [String:Any]),"width")
        tap("Dark theme");try capture("dark");tap("Compact width");try capture("compact")
        let compact=try XCTUnwrap(try XCTUnwrap(try state()["layouts"] as? [String:Any])["target"] as? [String:Any]);XCTAssertNotEqual(try number(try XCTUnwrap(compact["layout"] as? [String:Any]),"width"),before)
        tap("Live window");try capture("live-restored");tap("Light theme");try capture("light-restored")
    }
    private func observeColor(_ name:String,reduced:Bool) throws {
        reveal(node("counter-native-pair"));let arm=app.buttons["Arm Counter color interruption and retirement"].firstMatch,window=app.windows.firstMatch.frame,parent=node("counter-native-parent").frame,reference=node("counter-native-reference-parent").frame
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));let before=try state();arm.tap();var rows:[[String:Any]]=[];let until=Date().timeIntervalSince1970+10
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255 {ink+=1}}
            let row:[String:Any]=["name":name+"-"+String(rows.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"referenceExact":circularPixelsMatch(actual,expected),"inkPixels":ink,"parent":rect(parent),"referenceParent":rect(reference),"scale":scale];rows.append(row);try mark(name+"-"+String(rows.count),row,shot);Thread.sleep(forTimeInterval:0.1)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),scheduled=try XCTUnwrap(after["scheduled"] as? [[String:Any]]);XCTAssertEqual(scheduled.compactMap{$0["kind"] as? String},["red","supersede-green","blue","red-again","green-again","retire","fresh-blue"])
        let started=try number(scheduled[0],"epochMs"),retired=try number(scheduled[5],"epochMs"),moving=rows.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=started && ($0["captureEpochMs"] as? Double ?? .infinity)<retired}
        XCTAssertGreaterThan(moving.count,2);if reduced{XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true})}else{XCTAssertTrue(moving.contains{$0["referenceExact"] as? Bool==false},"Observe real Counter color interpolation independently of SVG motion")}
        XCTAssertTrue(rows.contains{($0["inkPixels"] as? Int)==0},"Real retired Counter paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));XCTAssertEqual(try number(after,"attaches"),try number(before,"attaches")+1);XCTAssertEqual(try number(after,"detaches"),try number(before,"detaches")+1)
        originalTag=try number(after,"rootTag");try capture(name+"-fresh")
        let result:[String:Any]=["name":name,"reduced":reduced,"state":after,"movingRows":moving.count,"samples":rows];FileHandle.standardOutput.write(Data("COUNTER_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
    }
    func testCounterColorInterruptionAndRetirement() throws {
        let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();try observeColor("normal",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("counter-native-state"));wait("Actual Counter Reduce Motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try observeColor("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            let up=element.frame.minY<viewport.minY
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.30:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.70:0.35)))
        };XCTFail("Unreachable Counter control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Circular/Counter scene"{wait("Actual selected Counter scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }

    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}


final class ThumbnailTrialTests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Thumbnail scene");tap("Light theme");tap("Live window")
        try ready()
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="thumbnail-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="thumbnail-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws -> [String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("thumbnail-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String) throws -> Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func event(_ row:[String:Any],_ kind:String) -> [String:Any]? {(row["events"] as? [[String:Any]])?.last{$0["kind"] as? String==kind}}
    private func ready(_ minimumLoads:Double=0) throws {
        reveal(node("thumbnail-native-state"))
        wait("Actual Thumbnail decode and independent reference") {
            guard let row=try? self.state(),let load=self.event(row,"load"),let source=load["source"] as? [String:Any],let frame=row["frame"] as? [String:Any] else{return false}
            return ((row["loads"] as? NSNumber)?.doubleValue ?? 0) > minimumLoads && source["uri"] as? String==row["expectedURI"] as? String && row["referenceSource"] as? String==row["expectedURI"] as? String && ((frame["width"] as? NSNumber)?.doubleValue ?? 0)>0 && ((row["referenceLoads"] as? NSNumber)?.doubleValue ?? 0)>0
        }
    }
    private func capture(_ name:String) throws {
        reveal(node("thumbnail-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ item:XCUIElementSnapshot){all.append(item);for child in item.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let matches=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(matches.count,1,"Unique actual "+id);return matches.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("thumbnail-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame
        let parent=try XCTUnwrap(one("thumbnail-native-parent")).frame,reference=try XCTUnwrap(one("thumbnail-native-reference-parent")).frame,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),target=one("thumbnail-example"),referenceTarget=one("thumbnail-native-reference")
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255 {ink+=1}}
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"target":target.map{rect($0.frame)} ?? [],"referenceTarget":referenceTarget.map{rect($0.frame)} ?? [],"nativeLabel":target?.label ?? NSNull(),"nativeType":target?.elementType.rawValue ?? 0,"referenceExact":circularPixelsMatch(actual,expected),"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height,"backgroundRGB":[255,255,255]]
        let data=try JSONSerialization.data(withJSONObject:observed,options:.sortedKeys);FileHandle.standardOutput.write(Data("THUMBNAIL_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8));let json=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");json.name="thumbnail-"+name+"-receipt";json.lifetime = .keepAlways;add(json);let png=XCTAttachment(screenshot:shot);png.name="thumbnail-"+name;png.lifetime = .keepAlways;add(png)
        XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,180);XCTAssertLessThanOrEqual(parent.width,280);XCTAssertEqual(Array(actual.prefix(4)),[255,255,255,255]);XCTAssertTrue(circularPixelsMatch(actual,expected),"Whole-parent exact independent native Image/Text reference")
        if row["visible"] as? Bool==false {XCTAssertNil(target);XCTAssertEqual(ink,0);return}
        let fallback=(row["callerSelected"] as? Bool != true) && [1,2].contains((row["mode"] as? NSNumber)?.intValue ?? -1)
        if fallback {XCTAssertNil(target);XCTAssertGreaterThan(ink,0);return}
        let layoutEvent=try XCTUnwrap(event(row,"layout")),layout=try XCTUnwrap(layoutEvent["layout"] as? [String:Any]);XCTAssertGreaterThan(try number(layoutEvent,"target"),0);XCTAssertEqual(try number(layoutEvent,"target"),try number(layoutEvent,"currentTarget"))
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let adapter=row["adapter"] as? Bool==true,custom=row["custom"] as? Bool==true,constrained=row["constrained"] as? Bool==true,density=(row["callerSelected"] as? Bool != true) && ((row["densityIndex"] as? NSNumber)?.intValue ?? 0)>0,dimension=(row["dimensionIndex"] as? NSNumber)?.intValue ?? 0
        let sourceWidth=try number(row,"nativeSourceWidth"),sourceHeight=try number(row,"nativeSourceHeight"),width=constrained ? 140:dimension==1 ? 83.25:dimension==2 ? (Double(parent.width)-24)/2:custom ? 120:density ? 32:adapter ? 96:sourceWidth,height=(constrained || dimension>0) ? width*sourceHeight/sourceWidth:custom ? 80:density ? 32:adapter ? 48:sourceHeight
        XCTAssertEqual(try number(layout,"width"),width,accuracy:1/Double(scale));XCTAssertEqual(try number(layout,"height"),height,accuracy:1/Double(scale));XCTAssertGreaterThan(ink,0)
        if let current=target {
            let border=custom ? 2.0:0.0,outer=[Double(parent.minX)+(try number(layout,"x")),Double(parent.minY)+(try number(layout,"y")),width,height],content=try XCTUnwrap(thumbnailImageContentFrame(outer,border)),expectedFrame=CGRect(x:content[0],y:content[1],width:content[2],height:content[3])
            XCTAssertEqual(current.frame.minX,expectedFrame.minX,accuracy:1/scale);XCTAssertEqual(current.frame.minY,expectedFrame.minY,accuracy:1/scale)
            XCTAssertEqual(current.frame.width,expectedFrame.width,accuracy:1/scale);XCTAssertEqual(current.frame.height,expectedFrame.height,accuracy:1/scale)
            let raw=try XCTUnwrap(referenceTarget).frame;XCTAssertEqual(current.frame.origin.x-parent.minX,raw.origin.x-reference.minX,accuracy:1/scale);XCTAssertEqual(current.frame.origin.y-parent.minY,raw.origin.y-reference.minY,accuracy:1/scale);XCTAssertEqual(current.frame.width,raw.width,accuracy:1/scale);XCTAssertEqual(current.frame.height,raw.height,accuracy:1/scale)
            XCTAssertEqual(current.label,row["emptyAlt"] as? Bool==true ? "":"Thumbnail preview / aperçu")
        }
        else{XCTAssertEqual(row["emptyAlt"] as? Bool,true,"Only decorative images may be absent from AX snapshots")}
        let load=try XCTUnwrap(event(row,"load")),source=try XCTUnwrap(load["source"] as? [String:Any]);XCTAssertEqual(source["uri"] as? String,row["expectedURI"] as? String);XCTAssertGreaterThan(try number(source,"width"),0);XCTAssertGreaterThan(try number(source,"height"),0);XCTAssertEqual(try number(load,"currentTarget"),try number(layoutEvent,"currentTarget"))
        if adapter{XCTAssertEqual(try number(try XCTUnwrap(row["adapterBinding"] as? [String:Any]),"tag"),try number(layoutEvent,"currentTarget"))}
    }
    func testThumbnailDecodeFallbackAndLifetime() throws {
        try capture("baseline");let baseline=try state();XCTAssertEqual(try number(baseline,"errors"),1)
        let events=try XCTUnwrap(baseline["events"] as? [[String:Any]]);XCTAssertLessThan(try XCTUnwrap(events.firstIndex{$0["kind"] as? String=="error"}),try XCTUnwrap(events.firstIndex{$0["kind"] as? String=="load"}))
        tap("Toggle equivalent thumbnail candidates");try capture("equivalent");XCTAssertEqual(try number(state(),"errors"),1)
        tap("Next thumbnail sources");wait("Both genuine failed candidates exhaust"){((try? self.state()["errors"] as? NSNumber)?.doubleValue ?? 0)>=3 && self.node("thumbnail-fallback").exists};try capture("all-fail")
        tap("Next thumbnail sources");try capture("empty-list");XCTAssertEqual(try number(state(),"errors"),3)
        tap("Toggle zero thumbnail fallback");try capture("zero-fallback")
        tap("Next thumbnail sources");try ready();try capture("square")
        tap("Next thumbnail sources");try ready();try capture("landscape")
        let beforeAdapter=try number(state(),"loads");tap("Toggle thumbnail renderer");try ready(beforeAdapter);try capture("adapter");let binding=try XCTUnwrap(try state()["adapterBinding"] as? [String:Any])
        tap("Toggle empty thumbnail alt");try capture("adapter-empty-alt");XCTAssertEqual(try number(try XCTUnwrap(try state()["adapterBinding"] as? [String:Any]),"tag"),try number(binding,"tag"))
        tap("Toggle empty thumbnail alt");let old=try state();tap("Toggle thumbnail presence");try capture("retired");Thread.sleep(forTimeInterval:1);try capture("retired-quiet");XCTAssertEqual(try number(state(),"loads"),try number(old,"loads"));XCTAssertEqual(try number(state(),"errors"),try number(old,"errors"))
        tap("Toggle thumbnail presence");try ready(try number(old,"loads"));try capture("fresh");let fresh=try XCTUnwrap(try state()["adapterBinding"] as? [String:Any]);XCTAssertNotEqual(try number(fresh,"tag"),try number(binding,"tag"));XCTAssertEqual(try number(fresh,"detaches"),try number(binding,"detaches")+1)
    }
    func testThumbnailGeometryDensityAndProviders() throws {
        try capture("geometry-baseline");let before=try number(state(),"loads");tap("Next thumbnail density set");try ready(before);try capture("density-full")
        let full=try number(state(),"loads");tap("Next thumbnail density set");try ready(full);try capture("density-src")
        tap("Toggle thumbnail zero size");wait("Delivered explicit zero image layout"){guard let row=try? self.state(),let layout=row["frame"] as? [String:Any] else{return false};return (layout["width"] as? NSNumber)?.doubleValue==0 && (layout["height"] as? NSNumber)?.doubleValue==0};try capture("zero-density")
        let zero=try state(),tag=try number(try XCTUnwrap(event(zero,"layout")),"currentTarget");tap("Restart thumbnail lifetime");wait("Fresh zero-sized native host layout"){guard let row=try? self.state(),let layout=self.event(row,"layout") else{return false};return ((layout["currentTarget"] as? NSNumber)?.doubleValue ?? 0)>0 && (layout["currentTarget"] as? NSNumber)?.doubleValue != tag};try capture("zero-fresh")
        tap("Toggle thumbnail zero size");try ready(try number(zero,"loads"));try capture("positive-fresh")
        let density=try number(state(),"loads");tap("Toggle caller-selected thumbnail src");try ready(density);try capture("caller-selected")
        tap("Toggle thumbnail styles");try capture("styled");tap("Toggle thumbnail width constraint");try capture("constrained")
        tap("Toggle thumbnail width constraint");tap("Toggle thumbnail styles");tap("Next thumbnail dimension");try capture("fractional");tap("Next thumbnail dimension");try capture("percentage");let live=try number(try XCTUnwrap(try state()["frame"] as? [String:Any]),"width")
        tap("Dark theme");try capture("dark");tap("Vertical blocked region");try capture("narrow");XCTAssertNotEqual(try number(try XCTUnwrap(try state()["frame"] as? [String:Any]),"width"),live)
        tap("Live window");try capture("live-restored");tap("Light theme");try capture("light-restored")
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            let up=element.frame.minY<viewport.minY
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.30:0.75)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:up ? 0.70:0.35)))
        };XCTFail("Unreachable Thumbnail control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Thumbnail scene"{wait("Actual selected Thumbnail scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }

}

private func thumbnailImageContentFrame(_ outer: [Double], _ border: Double) -> [Double]? {
    guard outer.count == 4, outer.allSatisfy({ $0.isFinite }), border.isFinite, border >= 0, outer[2] >= 2 * border, outer[3] >= 2 * border else { return nil }
    return [outer[0] + border, outer[1] + border, outer[2] - 2 * border, outer[3] - 2 * border]
}

final class GalleryTrialTests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Gallery scene");tap("Light theme");tap("Live window");try ready()
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="gallery-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="gallery-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws -> [String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("gallery-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String) throws -> Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() throws {
        reveal(node("gallery-native-state"));wait("Current primary native Image decode") {
            guard let row=try? self.state(),let load=(row["primaryLoads"] as? [[String:Any]])?.last,let layouts=row["originalLayouts"] as? [String:[String:Any]],let image=layouts["image"] else{return false}
            return load["uri"] as? String==row["expectedURI"] as? String && (load["target"] as? NSNumber)?.doubleValue == (image["currentTarget"] as? NSNumber)?.doubleValue && ((load["width"] as? NSNumber)?.doubleValue ?? 0)>0
        }
    }
    private func capture(_ name:String) throws {
        reveal(node("gallery-position-host"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func matches(_ id:String)->[XCUIElementSnapshot] {all.filter{$0.identifier==id}}
        func one(_ id:String)->XCUIElementSnapshot? {let found=matches(id);XCTAssertLessThanOrEqual(found.count,1,id);return found.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("gallery-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,host=try XCTUnwrap(one("gallery-position-host")).frame
        let root=one("gallery-example"),primary=one("thumbnail-showcase-primary"),grid=one("thumbnail-showcase-grid"),slots=matches("thumbnail-showcase-secondary-slot").sorted{abs($0.frame.minY-$1.frame.minY)>0.1 ? $0.frame.minY<$1.frame.minY:$0.frame.minX<$1.frame.minX}
        let shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width;XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let crop=try pixels(image,host,window,scale);var ink=0;for i in stride(from:0,to:crop.count,by:4){if Array(crop[i..<i+3]) != [255,255,255]{ink+=1}}
        let layouts=try XCTUnwrap(row["originalLayouts"] as? [String:[String:Any]]),rootEvent=try XCTUnwrap(layouts["root"]),rootLayout=try XCTUnwrap(rootEvent["layout"] as? [String:Any]);XCTAssertGreaterThan(try number(rootEvent,"target"),0);XCTAssertEqual(try number(rootEvent,"target"),try number(rootEvent,"currentTarget"))
        let custom=row["custom"] as? Bool==true,overrides=row["customizations"] as? [String] ?? [],zero=row["zero"] as? Bool==true,mode=try XCTUnwrap(row["mode"] as? String),kind=try XCTUnwrap(row["kind"] as? String),items=try XCTUnwrap(row["items"] as? [String]),rawCount=Double(row["count"] as? String ?? "") ?? .nan,count=rawCount.isFinite ? max(0,Int(rawCount.rounded(.down))):4
        let columns=(row["columns"] as? NSNumber)?.intValue ?? max(count,1),rootBorder=overrides.contains("root") ? 2.0:custom ? 1:0,rootPadding=overrides.contains("root") ? 7.0:custom ? 5:0,rootGap=overrides.contains("root") ? 14.0:custom ? 12:10
        let widthValue=row["width"],width=zero ? 0:custom ? 260:(widthValue as? NSNumber)?.doubleValue ?? (widthValue as? String=="50%" ? (Double(host.width)-24)/2:Double(host.width)-24),inner=max(0,width-2*(rootBorder+rootPadding))
        let primaryBorder=overrides.contains("primary") ? 3.0:custom ? 2:0,primaryHeight=inner/((overrides.contains("primary") || custom) ? 2:1),rowBorder=overrides.contains("row") ? 2.0:0,rowPadding=overrides.contains("row") ? 6.0:custom ? 4:0,rowGap=overrides.contains("row") ? 12.0:custom ? 6:10,columnGap=overrides.contains("row") ? 8.0:custom ? 4:10,gridWidth=max(0,inner-2*(rowBorder+rowPadding)),track=try XCTUnwrap(galleryTrackWidth(gridWidth,columnGap,columns)),slotBorder=overrides.contains("secondary") ? 2.0:custom ? 1:0,slotWidth=overrides.contains("secondary") ? 48.0:custom ? 40:track
        let showPrimary=mode != "secondary",hasMedia = !["undefined","null"].contains(kind) || !items.isEmpty,showRow=mode != "primary" && hasMedia && count>0,rows=showRow ? (count+columns-1)/columns:0,gridHeight=showRow ? (gridWidth==0 ? Double(max(0,rows-1))*rowGap:Double(rows)*slotWidth+Double(max(0,rows-1))*rowGap):0,rowHeight=showRow ? gridHeight+2*(rowBorder+rowPadding):0,height=2*(rootBorder+rootPadding)+(showPrimary ? primaryHeight:0)+(showRow ? rowHeight:0)+(showPrimary && showRow ? rootGap:0)
        var checks:[[String:Any]]=[]
        func color(_ value:String)->[Int] {let v=UInt32(value.replacingOccurrences(of:"#",with:""),radix:16)!;return [Int((v>>16)&255),Int((v>>8)&255),Int(v&255)]}
        func border(_ id:String,_ frame:CGRect,_ thickness:Double,_ rgb:[Int]) throws {
            guard thickness>0 && frame.width>20 && frame.height>10 else{return}
            let box=CGRect(x:frame.midX-3,y:frame.minY+1/scale,width:6,height:CGFloat(thickness)-2/scale),bytes=try pixels(image,box,window,scale);var exact=true
            for i in stride(from:0,to:bytes.count,by:4){if Array(bytes[i..<i+3]).map(Int.init) != rgb{exact=false}}
            checks.append(["owner":id,"frame":rect(box),"expectedRGB":rgb,"exact":exact,"pixels":bytes.count/4])
        }
        if !zero {
            let frame=try XCTUnwrap(root).frame
            try border("root",frame,rootBorder,overrides.contains("root") ? [8,127,140]:color(try XCTUnwrap((row["colors"] as? [String:String])?["border"])))
            if let p=primary {try border("primary",p.frame,primaryBorder,overrides.contains("primary") ? [190,18,60]:color(try XCTUnwrap((row["colors"] as? [String:String])?["selected"])))}
            if let g=grid {
                let frame=CGRect(x:g.frame.minX-CGFloat(rowBorder+rowPadding),y:g.frame.minY-CGFloat(rowBorder+rowPadding),width:CGFloat(inner),height:CGFloat(rowHeight))
                try border("row",frame,rowBorder,[124,58,237])
                if custom {try border("row-background",frame.insetBy(dx:CGFloat(rowBorder),dy:CGFloat(rowBorder)),rowPadding,color(try XCTUnwrap((row["colors"] as? [String:String])?["track"])))}
            }
            if let slot=slots.first {try border("secondary",slot.frame,slotBorder,overrides.contains("secondary") ? [22,101,52]:color(try XCTUnwrap((row["colors"] as? [String:String])?["border"])))}
        }
        var primaryTexts:[String]=[]
        func textLeaves(_ item:XCUIElementSnapshot){if item.elementType == .staticText && item.children.isEmpty{primaryTexts.append(item.label)};for child in item.children{textLeaves(child)}}
        if let primary=primary{textLeaves(primary)}
        let controls=all.filter{$0.identifier.hasPrefix("gallery-item-") || $0.identifier=="gallery-overflow"}.map{["id":$0.identifier,"label":$0.label,"frame":rect($0.frame),"enabled":$0.isEnabled] as [String:Any]}
        let observed:[String:Any]=["name":name,"state":row,"host":rect(host),"root":root.map{rect($0.frame)} ?? [],"primary":primary.map{rect($0.frame)} ?? [],"grid":grid.map{rect($0.frame)} ?? [],"slots":slots.map{rect($0.frame)},"controls":controls,"placeholderCount":matches("gallery-secondary-placeholder").count,"primaryPlaceholder":one("gallery-primary-placeholder") != nil,"primaryLabel":primary?.label ?? "","primaryTexts":primaryTexts,"scale":scale,"imageWidth":image.width,"imageHeight":image.height,"inkPixels":ink,"paintChecks":checks]
        let data=try JSONSerialization.data(withJSONObject:observed,options:.sortedKeys);FileHandle.standardOutput.write(Data("GALLERY_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8));let json=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");json.name="gallery-"+name+"-receipt";json.lifetime = .keepAlways;add(json);let png=XCTAttachment(screenshot:shot);png.name="gallery-"+name;png.lifetime = .keepAlways;add(png)
        XCTAssertEqual(try number(rootLayout,"width"),width,accuracy:1/Double(scale));XCTAssertEqual(try number(rootLayout,"height"),height,accuracy:1/Double(scale));
        for check in checks{XCTAssertEqual(check["exact"] as? Bool,true,"Opaque border "+String(describing:check["owner"]!))}
        if zero {XCTAssertEqual(ink,0);return}
        XCTAssertEqual(primary != nil,showPrimary);XCTAssertEqual(grid != nil,showRow);XCTAssertEqual(slots.count,showRow ? count:0)
        XCTAssertEqual(one("gallery-primary-placeholder") != nil,showPrimary && ["undefined","null"].contains(kind));XCTAssertEqual(matches("gallery-secondary-placeholder").count,showRow ? max(0,count-items.count):0)
        if showPrimary && kind=="zero"{XCTAssertEqual(primaryTexts,["0"])}
        let frame=try XCTUnwrap(root).frame;XCTAssertEqual(frame.width,CGFloat(width),accuracy:1/scale);XCTAssertEqual(frame.height,CGFloat(height),accuracy:1/scale);XCTAssertEqual(frame.minX-host.minX,CGFloat(try number(rootLayout,"x")),accuracy:1/scale);XCTAssertEqual(frame.minY-host.minY,CGFloat(try number(rootLayout,"y")),accuracy:1/scale)
        if let p=primary {XCTAssertEqual(p.frame.width,CGFloat(inner),accuracy:1/scale);XCTAssertEqual(p.frame.height,CGFloat(primaryHeight),accuracy:1/scale)}
        if let g=grid {
            XCTAssertEqual(g.frame.width,CGFloat(gridWidth),accuracy:1/scale);XCTAssertEqual(g.frame.height,CGFloat(gridHeight),accuracy:1/scale)
            for (index,slot) in slots.enumerated(){XCTAssertEqual(slot.frame.width,CGFloat(slotWidth),accuracy:1/scale);XCTAssertEqual(slot.frame.height,CGFloat(slotWidth),accuracy:1/scale);XCTAssertEqual(slot.frame.minX-g.frame.minX,CGFloat(index%columns)*(CGFloat(track+columnGap)),accuracy:1/scale);XCTAssertEqual(slot.frame.minY-g.frame.minY,CGFloat(index/columns)*(CGFloat(slotWidth+rowGap)),accuracy:1/scale)}
        }
        if showPrimary && kind=="image" {
            let event=try XCTUnwrap(layouts["image"]),load=try XCTUnwrap((row["primaryLoads"] as? [[String:Any]])?.last);XCTAssertEqual(load["uri"] as? String,row["expectedURI"] as? String);XCTAssertGreaterThan(try number(load,"width"),0);XCTAssertEqual(try number(load,"target"),try number(event,"currentTarget"));XCTAssertEqual(try number(try XCTUnwrap(layouts["primary"]),"currentTarget"),try number(row,"primaryTag"))
        }
        let overflow=row["overflow"] as? Bool==true && items.count>count && showRow,visible=showRow ? min(items.count,count)-(overflow ? 1:0):0
        XCTAssertEqual(controls.filter{($0["id"] as? String)?.hasPrefix("gallery-item-")==true}.count,visible);XCTAssertEqual(controls.filter{$0["id"] as? String=="gallery-overflow"}.count,overflow ? 1:0)
        if overflow {XCTAssertEqual(controls.first{$0["id"] as? String=="gallery-overflow"}?["label"] as? String,"Gallery overflow "+String(items.count-count))}
    }
    func testGalleryModesActionsAndLifetimes() throws {
        try capture("baseline");let first=try state(),tag=try number(try XCTUnwrap((first["originalLayouts"] as? [String:[String:Any]])?["A"]),"currentTarget")
        tap("Gallery A, count 0");try capture("touched");XCTAssertEqual(try number(state(),"actions"),1)
        tap("Reorder gallery items");try capture("reordered");tap("Next gallery column count");try capture("two-columns");tap("Next gallery column count");try capture("three-columns")
        XCTAssertTrue(app.buttons["Gallery A, count 1"].exists);XCTAssertEqual(try number(try XCTUnwrap((try state()["originalLayouts"] as? [String:[String:Any]])?["A"]),"currentTarget"),tag)
        tap("Gallery overflow 1");try capture("overflow-action");XCTAssertEqual(try number(state(),"overflowActions"),1)
        tap("Toggle gallery actions disabled");let a=node("gallery-item-A");reveal(a);XCTAssertFalse(a.isEnabled);a.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap();Thread.sleep(forTimeInterval:1);try capture("disabled");XCTAssertEqual(try number(state(),"actions"),1)
        tap("Toggle gallery actions disabled");tap("Next gallery mode");try capture("primary-only");tap("Next gallery mode");try capture("secondary-only");tap("Next gallery mode");try ready();try capture("all-restored");XCTAssertTrue(app.buttons["Gallery A, count 0"].exists)
        let oldPrimary=try number(state(),"primaryTag");tap("Restart gallery content");try ready();try capture("fresh");XCTAssertNotEqual(try number(state(),"primaryTag"),oldPrimary)
        tap("Toggle empty gallery items");tap("Next gallery primary");try capture("empty-media");tap("Next gallery primary");tap("Next gallery primary");try capture("falsy-zero")
        tap("Toggle empty gallery items");tap("Next gallery primary");tap("Next gallery primary");tap("Next gallery primary");try ready();try capture("media-restored")
        tap("Next gallery slot count");try capture("two-slots");tap("Next gallery slot count");try capture("zero-slots");tap("Next gallery slot count");try capture("fractional-count")
    }
    func testGalleryPrimitiveAndRemainingCounts() throws {
        tap("Gallery A, count 0");tap("Reorder gallery items");tap("Next gallery column count");tap("Next gallery column count");tap("Gallery overflow 1");tap("Restart gallery content");try ready()
        tap("Toggle empty gallery items");tap("Next gallery primary");tap("Next gallery primary");tap("Next gallery primary");try capture("falsy-zero")
        tap("Toggle empty gallery items");tap("Next gallery primary");tap("Next gallery primary");tap("Next gallery primary");try ready();try capture("media-restored")
        tap("Next gallery slot count");try capture("two-slots");tap("Next gallery slot count");try capture("zero-slots");tap("Next gallery slot count");try capture("fractional-count")
    }
    func testGalleryStylesWidthsAndProviders() throws {
        try capture("style-baseline");tap("Gallery A, count 0");tap("Toggle gallery root styles");try capture("root-style");tap("Toggle gallery primary slot styles");try capture("primary-style");tap("Toggle gallery row styles");try capture("row-style");tap("Toggle gallery secondary slot styles");try capture("four-styles")
        tap("Toggle gallery primary slot styles");try capture("primary-cleared");tap("Toggle gallery root styles");tap("Toggle gallery row styles");tap("Toggle gallery secondary slot styles");try capture("styles-restored")
        tap("Toggle gallery styles");try capture("composite");tap("Next gallery width");try capture("style-width-wins");tap("Toggle gallery styles");try capture("fractional-width");tap("Next gallery width");try capture("percentage-width");tap("Next gallery width");try capture("auto-width");tap("Next gallery width");try capture("width-restored")
        tap("Toggle gallery zero width");try capture("zero-width");tap("Toggle gallery zero width");tap("Next gallery positioning");try capture("relative");tap("Next gallery positioning");try capture("absolute");tap("Next gallery positioning")
        tap("Toggle gallery styles");try capture("dynamic-light");tap("Dark theme");try capture("dynamic-dark");tap("Light theme");try capture("light-restored")
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Gallery target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("GALLERY_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable Gallery control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Gallery scene"{wait("Actual selected Gallery scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }

}

private func galleryTrackWidth(_ width:Double,_ gap:Double,_ columns:Int)->Double? {
    guard width.isFinite, width>=0, gap.isFinite, gap>=0, columns>0 else{return nil}
    return max(0,(width-gap*Double(columns-1))/Double(columns))
}

private func galleryScrollFraction(_ targetMin:Double,_ targetHeight:Double,_ viewportMin:Double,_ viewportHeight:Double)->Double? {
    guard [targetMin,targetHeight,viewportMin,viewportHeight].allSatisfy({$0.isFinite}),targetHeight>0,viewportHeight>0,targetHeight<=viewportHeight else{return nil}
    return max(-0.35,min(0.35,(targetMin+targetHeight/2-viewportMin-viewportHeight/2)/viewportHeight))
}

final class AvatarTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private let behavior=["baseline","sample","invalid","removed","first-name","last-name","anonymous","disabled","passive","missing-handler","held-cancel","restored","retired","fresh","delayed"]
    private let styles=["style-baseline","orthogonal","rounded","raised","root-style","fallback-style","text-style","image-style","final-precedence","fractional","percentage","auto","zero","dark","light-restored","narrow","name-enlarged"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Avatar scene");tap("Light theme");tap("Live window")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="avatar-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="avatar-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws -> [String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("avatar-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String) throws -> Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func capture(_ name:String,early:Bool=false) throws {
        reveal(node("avatar-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("avatar-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame
        let parent=try XCTUnwrap(one("avatar-native-parent")).frame,reference=try XCTUnwrap(one("avatar-native-reference-parent")).frame,root=one("avatar-native-target"),raw=one("avatar-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let exact=circularPixelsMatch(actual,expected),named=all.filter{$0.identifier=="avatar-native-target"},epoch=Date().timeIntervalSince1970*1000
        let observation:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"targetCount":named.count,"referenceExact":exact,"inkPixels":ink,"captureEpochMs":epoch,"early":early,"scale":scale,"imageWidth":image.width,"imageHeight":image.height]
        let data=try JSONSerialization.data(withJSONObject:observation,options:.sortedKeys);FileHandle.standardOutput.write(Data("AVATAR_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="avatar-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="avatar-"+name;png.lifetime = .keepAlways;add(png)
        XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,128);XCTAssertEqual(Array(actual.prefix(4)),[255,255,255,255]);XCTAssertEqual(Array(expected.prefix(4)),[255,255,255,255])
        if early {XCTAssertLessThan(epoch-(try number(row,"mountedEpochMs")),try number(row,"delay"));XCTAssertTrue(exact,"Premature fallback paint");return}
        XCTAssertTrue(exact,"Actual Avatar differs from independent core-native Image/Text/View reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertEqual(ink,0);XCTAssertTrue(row["rootTag"] is NSNull);return}
        let tag=try number(row,"rootTag"),events=try XCTUnwrap(row["layouts"] as? [[String:Any]]),event=try XCTUnwrap(events.last),layout=try XCTUnwrap(event["layout"] as? [String:Any])
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        let size=row["size"] as? NSNumber,zero=size?.doubleValue==0
        if zero {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),referenceRoot=try XCTUnwrap(raw),width=try number(layout,"width"),height=try number(layout,"height")
        XCTAssertEqual(target.frame.width,width,accuracy:1/scale);XCTAssertEqual(target.frame.height,height,accuracy:1/scale);XCTAssertEqual(target.frame.size.width,referenceRoot.frame.size.width,accuracy:1/scale);XCTAssertEqual(target.frame.size.height,referenceRoot.frame.size.height,accuracy:1/scale)
        if let expectedSize=size?.doubleValue {XCTAssertEqual(width,expectedSize,accuracy:1/Double(scale));XCTAssertEqual(height,expectedSize,accuracy:1/Double(scale))}
        XCTAssertEqual(target.label,row["label"] as? String);XCTAssertEqual(named.count,1);XCTAssertEqual(target.elementType,row["interactive"] as? Bool==true ? .button:.image)
        if row["interactive"] as? Bool==true {XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false))}
        if row["imageMode"] as? String=="sample" {XCTAssertTrue((row["referenceLoaded"] as? String ?? "").hasPrefix("data:image/png;base64,"))}
        if row["delayed"] as? Bool==true {XCTAssertGreaterThanOrEqual(epoch-(try number(row,"mountedEpochMs")),try number(row,"delay"))}
    }
    func testAvatarImagesActionsAndLifetimes() throws {
        tap("Prepare Avatar behavior checks");var initialTag=0.0;var retiredActions=0.0
        for name in behavior {
            wait("Current Avatar case "+name){(try? self.state()["case"] as? String)==name}
            if name != "retired" {wait("Current original Avatar layout/ref") {guard let row=try? self.state(), let events=row["layouts"] as? [[String:Any]],let last=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (last["currentTarget"] as? NSNumber)?.doubleValue}}
            if name=="sample" {wait("Independent sample Image decode"){((try? self.state()["referenceLoaded"] as? String) ?? "").hasPrefix("data:image/png;base64,")}}
            if name=="delayed" {try capture("delay-before",early:true);Thread.sleep(forTimeInterval:8.1)}
            try capture(name)
            if name=="baseline" {
                initialTag=try number(state(),"rootTag");let target=node("avatar-native-target");reveal(target);target.coordinate(withNormalizedOffset:CGVector(dx:34/30,dy:0.5)).tap();wait("Original Avatar activation beyond visual thirty-point root"){((try? self.state()["actions"] as? NSNumber)?.intValue ?? 0)==1};let contact=try XCTUnwrap((try state()["contacts"] as? [[String:Any]])?.last);XCTAssertEqual(try number(contact,"currentTarget"),initialTag);XCTAssertGreaterThan(try number(contact,"target"),0);try capture("touched")
            }
            if ["sample","invalid","removed","first-name","last-name","anonymous"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),initialTag)}
            if ["disabled","passive","missing-handler","held-cancel","restored"].contains(name) {
                let before=try number(state(),"actions"),target=node("avatar-native-target");reveal(target)
                target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:name=="held-cancel" ? 1.0:0)
                if name=="restored" {wait("Fresh enabled Avatar action"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1}}
                else {Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)}
                if name=="held-cancel" {XCTAssertEqual(try state()["canceled"] as? Bool,true);XCTAssertEqual(try state()["disabled"] as? Bool,true);try capture("held-canceled")}
            }
            if name=="retired" {retiredActions=try number(state(),"actions");Thread.sleep(forTimeInterval:1.1);XCTAssertEqual(try number(state(),"actions"),retiredActions)}
            if name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),initialTag);XCTAssertEqual(try number(state(),"actions"),retiredActions)}
            if name != behavior.last {tap("Next Avatar check")}
        }
    }
    func testAvatarGeometryStylesAndProviders() throws {
        tap("Prepare Avatar style checks")
        for name in styles {
            wait("Current Avatar style "+name){(try? self.state()["case"] as? String)==name}
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            if name=="image-style" {wait("Independent styled Image decode"){((try? self.state()["referenceLoaded"] as? String) ?? "").hasPrefix("data:image/png;base64,")}}
            try capture(name)
            if name != styles.last {tap("Next Avatar check")}
        }
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Avatar target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("AVATAR_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable Avatar control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Avatar scene"{wait("Actual selected Avatar scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }

}

final class ListBoxItemTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private var heldIntervals:[[String:Double]]=[]
    private let behavior=["baseline","echo","string-zero","empty-key","programmatic-off","disabled","readonly","held-disabled","restored","child-callback","renderer","replaced","retired","fresh"]
    private let styles=["style-baseline","selected","small-text","large-text","root-custom","final-style","foreground","explicit-child","square","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Select scene");tap("Light theme");tap("Live window");tap("Prepare standalone ListBoxItem checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="list-item-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="list-item-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("list-item-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual current ListBoxItem root/ref/layout") {guard let row=try? self.state(),let events=row["layouts"] as? [[String:Any]],let event=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (event["currentTarget"] as? NSNumber)?.doubleValue}}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot,prefix:String="LIST_ITEM_NATIVE_OBSERVATION") throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data((prefix+" ").utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="list-item-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="list-item-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        reveal(node("list-item-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("list-item-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("list-item-native-parent")).frame,reference=try XCTUnwrap(one("list-item-native-reference-parent")).frame,root=one("list-item-native-target"),raw=one("list-item-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),exact=circularPixelsMatch(actual,expected)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeValue":root?.value ?? NSNull(),"nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"heldContactIntervals":heldIntervals,"targetCount":all.filter{$0.identifier=="list-item-native-target"}.count,"referenceExact":exact,"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,observed,shot);XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,224);XCTAssertTrue(exact,"ListBoxItem paint differs from independent core-native reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);return}
        let events=try XCTUnwrap(row["layouts"] as? [[String:Any]]),event=try XCTUnwrap(events.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw);XCTAssertEqual(target.label,row["textValue"] as? String);XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false))
        XCTAssertTrue(listItemValueMatches(target.value as? String ?? "",row["selected"] as? Bool==true),"Current stock UIKit radio/check value")
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        for (actual,expected) in zip([target.frame.minX-parent.minX,target.frame.minY-parent.minY,target.frame.width,target.frame.height],[nativeReference.frame.minX-reference.minX,nativeReference.frame.minY-reference.minY,nativeReference.frame.width,nativeReference.frame.height]) {XCTAssertEqual(actual,expected,accuracy:1/scale)}
        if let width=row["width"] as? NSNumber {XCTAssertEqual(target.frame.width,width.doubleValue,accuracy:1/scale)}
        if row["small"] as? Bool==true {XCTAssertEqual(target.frame.height,24,accuracy:1/scale)}else{XCTAssertGreaterThanOrEqual(target.frame.height,44-1/scale)}
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan(target.frame.height,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    func testListBoxItemActionsAndLifetimes() throws {
        tap("ListBoxItem behavior checks");var original=0.0
        for name in behavior {
            wait("Current ListBoxItem case "+name){(try? self.state()["case"] as? String)==name};if name != "retired" {ready()};try capture(name)
            if name=="baseline" {original=try number(state(),"rootTag");let target=node("list-item-native-target");reveal(target);target.tap();wait("Original owner request"){((try? self.state()["actions"] as? NSNumber)?.intValue ?? 0)==1};XCTAssertEqual(try state()["selected"] as? Bool,false);try capture("vetoed")}
            if name=="echo" {let target=node("list-item-native-target");reveal(target);target.tap();wait("Controlled owner echo"){(try? self.state()["selected"] as? Bool)==true};try capture("echo-selected")}
            if ["string-zero","empty-key","programmatic-off","disabled","readonly","held-disabled","restored","child-callback","renderer"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if ["disabled","readonly","held-disabled","restored"].contains(name) {
                let before=try number(state(),"actions"),target=node("list-item-native-target");reveal(target);let began=Date().timeIntervalSince1970*1000;target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:name=="held-disabled" ? 1:0)
                if name=="restored" {wait("New enabled owner action"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1}}
                else {Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)}
                if name=="held-disabled" {let ended=Date().timeIntervalSince1970*1000,current=try state(),events=try XCTUnwrap(current["events"] as? [[String:Any]]),entry=try XCTUnwrap(events.last{$0["phase"] as? String=="in"});let epoch=try number(entry,"epochMs");XCTAssertGreaterThanOrEqual(epoch,began);XCTAssertLessThan(epoch,ended-400,"Disabled from real onPressIn while the contact is held");heldIntervals.append(["beganEpochMs":began,"endedEpochMs":ended,"disabledOnPressInEpochMs":epoch]);XCTAssertEqual(current["canceled"] as? Bool,true);try capture("held-canceled")}
            }
            if name=="replaced" || name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="retired" {let before=try number(state(),"actions");Thread.sleep(forTimeInterval:0.5);XCTAssertEqual(try number(state(),"actions"),before)}
            if name != behavior.last {tap("Next ListBoxItem check")}
        }
        let row=try state(),presses=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(presses.count,3);XCTAssertTrue(presses.allSatisfy{($0["currentTarget"] as? NSNumber)?.doubleValue==original && (($0["target"] as? NSNumber)?.doubleValue ?? 0)>0})
    }
    func testListBoxItemStylesAndConstraints() throws {
        tap("ListBoxItem style checks")
        for name in styles {
            wait("Current ListBoxItem style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last {tap("Next ListBoxItem check")}
        }
    }
    private func motion(_ name:String,reduced:Bool) throws {
        reveal(node("list-item-native-pair"));ready();let before=try state(),window=app.windows.firstMatch.frame,parent=node("list-item-native-parent").frame,reference=node("list-item-native-reference-parent").frame,root=node("list-item-native-target").frame,raw=node("list-item-native-reference").frame,arm=app.buttons["Arm ListBoxItem motion and retirement"].firstMatch
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));arm.tap();var samples:[[String:Any]]=[];let until=Date().timeIntervalSince1970+6.1
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),point=CGRect(x:root.maxX-10,y:root.minY+4,width:2,height:2),referencePoint=CGRect(x:raw.maxX-10,y:raw.minY+4,width:2,height:2),paint=try pixels(image,point,window,scale),referencePaint=try pixels(image,referencePoint,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
            let row:[String:Any]=["name":name+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"parent":rect(parent),"referenceParent":rect(reference),"sampleFrame":rect(point),"referenceSampleFrame":rect(referencePoint),"referenceExact":circularPixelsMatch(actual,expected),"sampleRGBA":listItemSampleRGBA(paint),"referenceSampleRGBA":listItemSampleRGBA(referencePaint),"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height];samples.append(row);try mark(name+"-"+String(samples.count),row,shot,prefix:"LIST_ITEM_NATIVE_MOTION_FRAME");Thread.sleep(forTimeInterval:0.10)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),trace=try XCTUnwrap(after["motionTrace"] as? [[String:Any]]);XCTAssertEqual(trace.compactMap{$0["name"] as? String},["select","interrupt","retarget","retire","fresh"]);let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=(trace[0]["epochMs"] as? Double ?? .infinity) && ($0["captureEpochMs"] as? Double ?? .infinity)<(trace[3]["epochMs"] as? Double ?? 0)}
        XCTAssertGreaterThan(moving.count,1);if reduced{XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true})}else{XCTAssertTrue(moving.contains{row in guard let rgba=row["sampleRGBA"] as? [Int] else{return false};return listItemIntermediate(rgba)},"Real interrupted background interpolation")}
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Real retired paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));ready();try capture(name+"-fresh")
        let result:[String:Any]=["name":name,"reduced":reduced,"movingRows":moving.count,"state":after,"samples":samples];FileHandle.standardOutput.write(Data("LIST_ITEM_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
    }
    func testListBoxItemMotionAndRetirement() throws {
        tap("ListBoxItem motion checks");let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();reveal(node("list-item-native-state"));wait("Real normal-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try motion("normal",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("list-item-native-state"));wait("Real reduced-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try motion("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("ListBoxItem target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("LIST_ITEM_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable ListBoxItem control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected ListBoxItem scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}

private func listItemValueMatches(_ value:String,_ selected:Bool)->Bool {
    value.split(separator:",").map{$0.trimmingCharacters(in:.whitespaces)} == ["radio button",selected ? "checked":"unchecked"]
}

private func listItemIntermediate(_ rgba:[Int])->Bool {
    rgba.count==4 && rgba.allSatisfy{0...255 ~= $0} && rgba[0]>17 && rgba[0]<187 && rgba[1]>51 && rgba[1]<119 && rgba[2]>34 && rgba[2]<51 && rgba[3]==255
}

private func listItemSampleRGBA(_ rgba:[UInt8])->[Int] {
    rgba.prefix(4).map(Int.init)
}

final class ToggleButtonTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private var heldIntervals:[[String:Double]]=[]
    private let behavior=["baseline","echo","disabled","held-disabled","restored","state-method","renderer","replaced","retired","fresh","auto-focus","local","local-default-changed","single-group","multiple-group"]
    private let styles=["style-baseline","selected","root-custom","final-style","foreground","explicit-child","square","round","raised","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Toggle scene");tap("Light theme");tap("Live window");tap("Prepare standalone ToggleButton checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="toggle-button-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="toggle-button-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("toggle-button-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual current ToggleButton root/ref/layout") {guard let row=try? self.state(),let events=row["layouts"] as? [[String:Any]],let event=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (event["currentTarget"] as? NSNumber)?.doubleValue}}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot,prefix:String="TOGGLE_BUTTON_NATIVE_OBSERVATION") throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data((prefix+" ").utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="toggle-button-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="toggle-button-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        reveal(node("toggle-button-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("toggle-button-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("toggle-button-native-parent")).frame,reference=try XCTUnwrap(one("toggle-button-native-reference-parent")).frame,root=one("toggle-button-native-target"),raw=one("toggle-button-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        var expected=separated,matchedReferenceParent:[Double]=[]
        if row["case"] as? String=="raised" {
            let control=app.buttons["Match raised reference position"].firstMatch;XCTAssertTrue(control.isHittable && window.contains(control.frame));control.tap()
            wait("Reference uses original physical origin"){(try? self.state()["referenceAtOrigin"] as? Bool)==true}
            let frame=node("toggle-button-native-reference-parent").frame,referenceShot=XCUIScreen.main.screenshot(),referenceImage=try XCTUnwrap(referenceShot.image.cgImage)
            XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(frame),Double(scale)),"Shadow reference must use the same physical origin and dimensions")
            XCTAssertEqual(referenceImage.width,image.width);XCTAssertEqual(referenceImage.height,image.height)
            expected=try pixels(referenceImage,frame,window,scale);matchedReferenceParent=rect(frame)
            let attachment=XCTAttachment(screenshot:referenceShot);attachment.name="toggle-button-raised-matched-reference";attachment.lifetime = .keepAlways;add(attachment)
        }
        let exact=circularPixelsMatch(actual,expected)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeValue":root?.value ?? NSNull(),"nativeButton":root?.elementType == .button,"nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"heldContactIntervals":heldIntervals,"targetCount":all.filter{$0.identifier=="toggle-button-native-target"}.count,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"matchedReferenceParent":matchedReferenceParent,"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,observed,shot);XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,224);XCTAssertTrue(exact,"ToggleButton paint differs from independent core-native reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);return}
        let events=try XCTUnwrap(row["layouts"] as? [[String:Any]]),event=try XCTUnwrap(events.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw);XCTAssertEqual(target.label,row["label"] as? String);XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false))
        XCTAssertTrue(toggleButtonValueMatches(target.value as? String ?? "",row["selected"] as? Bool==true,row["radio"] as? Bool==true),"Current stock UIKit Button or radio/check value");XCTAssertTrue(row["radio"] as? Bool==true || target.elementType == .button)
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        for (actual,expected) in zip([target.frame.minX-parent.minX,target.frame.minY-parent.minY,target.frame.width,target.frame.height],[nativeReference.frame.minX-reference.minX,nativeReference.frame.minY-reference.minY,nativeReference.frame.width,nativeReference.frame.height]) {XCTAssertEqual(actual,expected,accuracy:1/scale)}
        if let width=row["width"] as? NSNumber {XCTAssertEqual(target.frame.width,width.doubleValue,accuracy:1/scale)}
        if row["small"] as? Bool==true {XCTAssertEqual(target.frame.height,24,accuracy:1/scale)}else{XCTAssertGreaterThanOrEqual(target.frame.height,44-1/scale)}
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan(target.frame.height,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    func testToggleButtonActionsAndLifetimes() throws {
        tap("ToggleButton behavior checks");var original=0.0
        for name in behavior {
            wait("Current ToggleButton case "+name){(try? self.state()["case"] as? String)==name};if name != "retired" {ready()};try capture(name)
            if name=="baseline" {original=try number(state(),"rootTag");let target=node("toggle-button-native-target");reveal(target);target.tap();wait("Original vetoed request"){((try? self.state()["actions"] as? NSNumber)?.intValue ?? 0)==1};XCTAssertEqual(try state()["selected"] as? Bool,false);try capture("vetoed")}
            if name=="echo" {let target=node("toggle-button-native-target");reveal(target);target.tap();wait("Controlled owner echo"){(try? self.state()["selected"] as? Bool)==true};try capture("echo-selected")}
            if ["echo","disabled","held-disabled","restored","state-method","renderer"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if ["disabled","held-disabled","restored"].contains(name) {
                let before=try number(state(),"actions"),target=node("toggle-button-native-target");reveal(target);let began=Date().timeIntervalSince1970*1000;target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:name=="held-disabled" ? 1:0)
                if name=="restored" {wait("Enabled current owner action"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1}}
                else {Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)}
                if name=="held-disabled" {let ended=Date().timeIntervalSince1970*1000,current=try state(),events=try XCTUnwrap(current["events"] as? [[String:Any]]),entry=try XCTUnwrap(events.last{$0["phase"] as? String=="in"});let epoch=try number(entry,"epochMs");XCTAssertGreaterThanOrEqual(epoch,began);XCTAssertLessThan(epoch,ended-400);heldIntervals.append(["beganEpochMs":began,"endedEpochMs":ended,"disabledOnPressInEpochMs":epoch]);XCTAssertEqual(current["canceled"] as? Bool,true);try capture("held-canceled")}
            }
            if name=="state-method" {let before=try number(state(),"actions");tap("Toggle through exposed state");wait("Original exposed selection state toggle"){(try? self.state()["selected"] as? Bool)==true};XCTAssertEqual(try number(state(),"actions"),before);let phases=try XCTUnwrap(state()["phases"] as? [String]);XCTAssertEqual(Array(phases.prefix(6)),["change","press","change","press","change","press"]);XCTAssertEqual(phases.last,"change");try capture("state-requested")}
            if name=="replaced" || name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="retired" {let before=try number(state(),"actions");Thread.sleep(forTimeInterval:0.5);XCTAssertEqual(try number(state(),"actions"),before)}
            if name=="local" {let target=node("toggle-button-native-target");reveal(target);XCTAssertEqual(try state()["selected"] as? Bool,true);target.tap();wait("Actual local off"){(try? self.state()["selected"] as? Bool)==false};try capture("local-off");reveal(target);target.tap();wait("Actual local on"){(try? self.state()["selected"] as? Bool)==true};try capture("local-on")}
            if name=="local-default-changed" {XCTAssertEqual(try state()["selected"] as? Bool,true)}
            if name=="single-group" || name=="multiple-group" {let target=node("toggle-button-native-target");reveal(target);target.tap();wait("Actual group selection"){(try? self.state()["selected"] as? Bool)==true};try capture(name+"-selected")}
            if name != behavior.last {tap("Next ToggleButton check")}
        }
        let row=try state(),presses=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(presses.count,7);XCTAssertTrue(presses.prefix(3).allSatisfy{($0["currentTarget"] as? NSNumber)?.doubleValue==original && (($0["target"] as? NSNumber)?.doubleValue ?? 0)>0})
    }
    func testToggleButtonStylesAndConstraints() throws {
        tap("ToggleButton styles checks")
        for name in styles {
            wait("Current ToggleButton style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last {tap("Next ToggleButton check")}
        }
    }
    private func motion(_ name:String,reduced:Bool) throws {
        reveal(node("toggle-button-native-pair"));ready();let before=try state(),window=app.windows.firstMatch.frame,parent=node("toggle-button-native-parent").frame,reference=node("toggle-button-native-reference-parent").frame,root=node("toggle-button-native-target").frame,raw=node("toggle-button-native-reference").frame,arm=app.buttons["Arm ToggleButton motion and retirement"].firstMatch
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));arm.tap();var samples:[[String:Any]]=[];let until=Date().timeIntervalSince1970+6.1
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),point=CGRect(x:root.maxX-10,y:root.minY+4,width:2,height:2),referencePoint=CGRect(x:raw.maxX-10,y:raw.minY+4,width:2,height:2),paint=try pixels(image,point,window,scale),referencePaint=try pixels(image,referencePoint,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
            let row:[String:Any]=["name":name+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"parent":rect(parent),"referenceParent":rect(reference),"sampleFrame":rect(point),"referenceSampleFrame":rect(referencePoint),"referenceExact":circularPixelsMatch(actual,expected),"sampleRGBA":listItemSampleRGBA(paint),"referenceSampleRGBA":listItemSampleRGBA(referencePaint),"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height];samples.append(row);try mark(name+"-"+String(samples.count),row,shot,prefix:"TOGGLE_BUTTON_NATIVE_MOTION_FRAME");Thread.sleep(forTimeInterval:0.10)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),trace=try XCTUnwrap(after["motionTrace"] as? [[String:Any]]);XCTAssertEqual(trace.compactMap{$0["name"] as? String},["select","interrupt","retarget","retire","fresh"]);let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=(trace[0]["epochMs"] as? Double ?? .infinity) && ($0["captureEpochMs"] as? Double ?? .infinity)<(trace[3]["epochMs"] as? Double ?? 0)}
        XCTAssertGreaterThan(moving.count,1);if reduced{XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true})}else{XCTAssertTrue(moving.contains{row in guard let rgba=row["sampleRGBA"] as? [Int] else{return false};return listItemIntermediate(rgba)},"Real interrupted background interpolation")}
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Real retired paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));ready();try capture(name+"-fresh")
        let result:[String:Any]=["name":name,"reduced":reduced,"movingRows":moving.count,"state":after,"samples":samples];FileHandle.standardOutput.write(Data("TOGGLE_BUTTON_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
    }
    func testToggleButtonMotionAndRetirement() throws {
        tap("ToggleButton motion checks");let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();reveal(node("toggle-button-native-state"));wait("Real normal-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try motion("normal",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("toggle-button-native-state"));wait("Real reduced-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try motion("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("ToggleButton target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("TOGGLE_BUTTON_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable ToggleButton control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected ToggleButton scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}

private func toggleButtonValueMatches(_ value:String,_ selected:Bool,_ radio:Bool)->Bool {
    value.split(separator:",").map{$0.trimmingCharacters(in:.whitespaces)} == (radio ? ["radio button",selected ? "checked":"unchecked"] : [selected ? "checked":"unchecked"])
}

private func toggleButtonMatchedFrame(_ first:[Double],_ second:[Double],_ scale:Double)->Bool {
    first.count==4 && second.count==4 && scale.isFinite && scale>0 && first.allSatisfy{$0.isFinite} && second.allSatisfy{$0.isFinite} && zip(first,second).allSatisfy{round($0*scale)==round($1*scale)}
}

final class RadioTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private var heldIntervals:[[String:Double]]=[]
    private let behavior=["baseline","echo","reselected","disabled","readonly","held-disabled","restored","renderer","replaced","retired","fresh","local","local-default-changed","empty-value"]
    private let styles=["style-baseline","selected","root-custom","final-style","shape-custom","explicit-child","square","round","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Multiline/Radio scene");tap("Light theme");tap("Live window");tap("Prepare standalone Radio checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="radio-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="radio-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("radio-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual current Radio root/ref/layout") {guard let row=try? self.state(),let events=row["layouts"] as? [[String:Any]],let event=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (event["currentTarget"] as? NSNumber)?.doubleValue}}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot,prefix:String="RADIO_NATIVE_OBSERVATION") throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data((prefix+" ").utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="radio-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="radio-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        reveal(node("radio-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("radio-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("radio-native-parent")).frame,reference=try XCTUnwrap(one("radio-native-reference-parent")).frame,root=one("radio-native-target"),raw=one("radio-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        let expected=separated
        let exact=circularPixelsMatch(actual,expected)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeValue":root?.value ?? NSNull(),"nativeButton":root?.elementType == .button,"nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"heldContactIntervals":heldIntervals,"targetCount":all.filter{$0.identifier=="radio-native-target"}.count,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,observed,shot);XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,224);XCTAssertTrue(exact,"Radio paint differs from independent core-native reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);return}
        let events=try XCTUnwrap(row["layouts"] as? [[String:Any]]),event=try XCTUnwrap(events.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw);XCTAssertEqual(target.label,row["label"] as? String);XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false))
        XCTAssertTrue(listItemValueMatches(target.value as? String ?? "",row["selected"] as? Bool==true),"Current stock UIKit radio/check value")
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        for (actual,expected) in zip([target.frame.minX-parent.minX,target.frame.minY-parent.minY,target.frame.width,target.frame.height],[nativeReference.frame.minX-reference.minX,nativeReference.frame.minY-reference.minY,nativeReference.frame.width,nativeReference.frame.height]) {XCTAssertEqual(actual,expected,accuracy:1/scale)}
        if let width=row["width"] as? NSNumber {XCTAssertEqual(target.frame.width,width.doubleValue,accuracy:1/scale)}
        if row["small"] as? Bool==true {XCTAssertEqual(target.frame.height,24,accuracy:1/scale)}else{XCTAssertGreaterThanOrEqual(target.frame.height,44-1/scale)}
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan(target.frame.height,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    func testRadioActionsAndLifetimes() throws {
        tap("Radio behavior checks");var original=0.0
        for name in behavior {
            wait("Current Radio case "+name){(try? self.state()["case"] as? String)==name};if name != "retired" {ready()};try capture(name)
            if name=="baseline" {
                original=try number(state(),"rootTag")
                for count in 1...2 {let target=node("radio-native-target");reveal(target);target.tap();wait("Original vetoed Radio request"){((try? self.state()["actions"] as? NSNumber)?.intValue ?? 0)==count};XCTAssertEqual(try state()["selected"] as? Bool,false);try capture("vetoed-"+String(count))}
            }
            if ["echo","reselected","restored","local","empty-value"].contains(name) {
                let before=try number(state(),"actions"),target=node("radio-native-target");reveal(target);target.tap();wait("Current Radio native activation"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1};XCTAssertEqual(try state()["selected"] as? Bool,true);try capture(name+"-activated")
            }
            if ["echo","reselected","disabled","readonly","held-disabled","restored","renderer"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if ["disabled","readonly","held-disabled"].contains(name) {
                let before=try number(state(),"actions"),target=node("radio-native-target");reveal(target);let began=Date().timeIntervalSince1970*1000;target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:name=="held-disabled" ? 1:0)
                Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)
                if name=="held-disabled" {let ended=Date().timeIntervalSince1970*1000,current=try state(),events=try XCTUnwrap(current["events"] as? [[String:Any]]),entry=try XCTUnwrap(events.last{$0["phase"] as? String=="in"});let epoch=try number(entry,"epochMs");XCTAssertGreaterThanOrEqual(epoch,began);XCTAssertLessThan(epoch,ended-400);heldIntervals.append(["beganEpochMs":began,"endedEpochMs":ended,"disabledOnPressInEpochMs":epoch]);XCTAssertEqual(current["canceled"] as? Bool,true);try capture("held-canceled")}
            }
            if name=="replaced" || name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="retired" {let before=try number(state(),"actions");Thread.sleep(forTimeInterval:0.5);XCTAssertEqual(try number(state(),"actions"),before)}
            if name=="local-default-changed" {XCTAssertEqual(try state()["selected"] as? Bool,true)}
            if name != behavior.last {tap("Next Radio check")}
        }
        let row=try state(),presses=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(presses.count,7);XCTAssertTrue(presses.prefix(5).allSatisfy{($0["currentTarget"] as? NSNumber)?.doubleValue==original && (($0["target"] as? NSNumber)?.doubleValue ?? 0)>0})
        XCTAssertEqual(row["requests"] as? [String],["a","a","a",""]);XCTAssertEqual(row["phases"] as? [String],["change","press","change","press","change","press","press","press","press","change","press"])
    }
    func testRadioStylesAndConstraints() throws {
        tap("Radio styles checks")
        for name in styles {
            wait("Current Radio style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last {tap("Next Radio check")}
        }
    }
    private func motion(_ name:String,reduced:Bool) throws {
        reveal(node("radio-native-pair"));ready();let before=try state(),window=app.windows.firstMatch.frame,parent=node("radio-native-parent").frame,reference=node("radio-native-reference-parent").frame,root=node("radio-native-target").frame,raw=node("radio-native-reference").frame,arm=app.buttons["Arm Radio motion and retirement"].firstMatch
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));arm.tap();var samples:[[String:Any]]=[];let until=Date().timeIntervalSince1970+11.4
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),point=CGRect(x:root.minX+4,y:root.midY-1,width:2,height:2),referencePoint=CGRect(x:raw.minX+4,y:raw.midY-1,width:2,height:2),paint=try pixels(image,point,window,scale),referencePaint=try pixels(image,referencePoint,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
            let row:[String:Any]=["name":name+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"parent":rect(parent),"referenceParent":rect(reference),"sampleFrame":rect(point),"referenceSampleFrame":rect(referencePoint),"referenceExact":circularPixelsMatch(actual,expected),"sampleRGBA":listItemSampleRGBA(paint),"referenceSampleRGBA":listItemSampleRGBA(referencePaint),"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height];samples.append(row);try mark(name+"-"+String(samples.count),row,shot,prefix:"RADIO_NATIVE_MOTION_FRAME");Thread.sleep(forTimeInterval:0.10)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),trace=try XCTUnwrap(after["motionTrace"] as? [[String:Any]]),retired=try XCTUnwrap(trace.first{$0["name"] as? String=="retire"})
        let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=(trace[0]["epochMs"] as? Double ?? .infinity) && ($0["captureEpochMs"] as? Double ?? .infinity)<(retired["epochMs"] as? Double ?? 0)}
        let result:[String:Any]=["name":name,"reduced":reduced,"movingRows":moving.count,"state":after,"samples":samples];FileHandle.standardOutput.write(Data("RADIO_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
        XCTAssertEqual(trace.compactMap{$0["name"] as? String},["select","interrupt","retarget"]+(3...31).map{"retarget-"+String($0)}+["settle","retire","fresh"])
        XCTAssertGreaterThan(moving.count,1);if reduced{XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true})}else{XCTAssertTrue(moving.contains{row in guard let rgba=row["sampleRGBA"] as? [Int] else{return false};return listItemIntermediate(rgba)},"Real interrupted background interpolation")}
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Real retired paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));ready();try capture(name+"-fresh")

    }
    func testRadioMotionAndRetirement() throws {
        tap("Radio motion checks");let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();reveal(node("radio-native-state"));wait("Real normal-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try motion("normal",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("radio-native-state"));wait("Real reduced-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try motion("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Radio target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("RADIO_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable Radio control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected Radio scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}

final class PlaceholderTrialTests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
        app.launch()
        XCTAssertEqual(app.state, .runningForeground)
        XCUIDevice.shared.orientation = .portrait
        try tap("Reset scene")
        try tap("Live window")
        try tap("Light theme")
        try tap("Text/Button scene")
        XCTAssertTrue(node("placeholder-g02-state").waitForExistence(timeout: nativeWorkRemaining()))
        try tap("G02 prepare placeholder")
        XCTAssertEqual(try state()["actions"] as? Int, 0)
    }
    private func node(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func reveal(_ element: XCUIElement) throws {
        XCTAssertTrue(element.waitForExistence(timeout: nativeWorkRemaining()))
        let scroll=app.scrollViews.firstMatch
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame) { return }
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else { XCTFail("Placeholder control does not fit actual viewport");return }
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset: CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        }
        XCTFail("Original visible control unreachable: " + element.identifier)
    }
    private func tap(_ label: String) throws {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        try reveal(button)
        button.tap()
    }
    private func state() throws -> [String: Any] {
        let marker = node("placeholder-g02-state")
        try reveal(marker)
        let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(marker.label.utf8)) as? [String: Any])
        XCTAssertEqual(value["dropped"] as? Int, 0)
        XCTAssertGreaterThan(try XCTUnwrap(value["rootTag"] as? Int), 0)
        return value
    }
    private func retain(_ original: [String: Any], _ current: [String: Any]) {
        for key in ["rootTag", "refIdentity", "attaches", "detaches"] { XCTAssertEqual(original[key] as? Int, current[key] as? Int, key) }
    }
    private func mark(_ name: String, _ value: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        FileHandle.standardOutput.write(Data("PLACEHOLDER_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    private func observe(_ name: String, rgb: [UInt8], text: String, original: [String: Any]) throws -> CGRect {
        // Allow the existing public 250ms color transition to settle before exact opaque-pixel checks.
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in false }, object: nil)
        gate.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 0.4), .completed)
        let target = node("library-placeholder")
        try reveal(target)
        let before = try state()
        retain(original, before)
        XCTAssertEqual(target.label, text)
        let frame = target.frame
        XCTAssertGreaterThan(frame.width, 0)
        XCTAssertGreaterThan(frame.height, 0)
        let screenshot = XCUIScreen.main.screenshot()
        let screen = app.windows.firstMatch.frame
        let source = try XCTUnwrap(screenshot.image.cgImage)
        let sx = CGFloat(source.width) / screen.width
        let sy = CGFloat(source.height) / screen.height
        XCTAssertLessThan(abs(sx - sy), 0.01)
        XCTAssertGreaterThan(source.height, source.width)
        let crop = CGRect(x: ((frame.minX - screen.minX) * sx).rounded(), y: ((frame.minY - screen.minY) * sy).rounded(), width: (frame.width * sx).rounded(), height: (frame.height * sy).rounded())
        XCTAssertTrue(CGRect(x: 0, y: 0, width: source.width, height: source.height).contains(crop))
        let image = try XCTUnwrap(source.cropping(to: crop))
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let decoded = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            return true
        }
        XCTAssertTrue(decoded)
        var count = 0
        for offset in stride(from: 0, to: bytes.count, by: 4) {
            if Array(bytes[offset..<(offset + 4)]) == rgb + [255] { count += 1 }
        }
        XCTAssertGreaterThanOrEqual(count, 5, "Expected opaque glyph paint")
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTAssertEqual(target.frame, frame)
        XCTAssertEqual(target.label, text)
        retain(original, try state())
        try mark(name + "-native", ["name": name, "text": text, "frame": [frame.minX, frame.minY, frame.width, frame.height], "screen": [screen.minX, screen.minY, screen.width, screen.height], "opaquePixels": count, "expectedRGBA": rgb + [255], "state": before, "scale": sx, "imageWidth": source.width, "imageHeight": source.height, "nativeLabel": target.label, "targetCount": app.descendants(matching: .any).matching(identifier: "library-placeholder").count])
        return frame
    }
    func testP01LightStylePrecedenceAndRestore() throws {
        let original = try state()
        _ = try observe("light-default", rgb: [112,112,112], text: "Choose an item", original: original)
        try tap("Toggle placeholder alignment")
        _ = try observe("light-center", rgb: [112,112,112], text: "Choose an item", original: original)
        try tap("Toggle placeholder custom styles")
        let custom = try observe("light-custom", rgb: [166,107,0], text: "Choose an item", original: original)
        try tap("Toggle placeholder final styles")
        let final = try observe("light-final", rgb: [126,34,206], text: "Choose an item", original: original)
        XCTAssertGreaterThan(final.height, custom.height)
        try tap("Toggle placeholder final styles")
        _ = try observe("light-custom-restored", rgb: [166,107,0], text: "Choose an item", original: original)
        try tap("Toggle placeholder custom styles")
        _ = try observe("light-computed-restored", rgb: [112,112,112], text: "Choose an item", original: original)
        XCTAssertEqual(try state()["actions"] as? Int, 0)
    }
    func testP02DarkProviderExplicitAndEmptyReset() throws {
        let original = try state()
        try tap("Dark theme")
        _ = try observe("dark-default", rgb: [135,135,135], text: "Choose an item", original: original)
        try tap("Toggle placeholder custom styles")
        try tap("Toggle placeholder final styles")
        _ = try observe("dark-final", rgb: [126,34,206], text: "Choose an item", original: original)
        try tap("Light theme")
        _ = try observe("light-explicit-retained", rgb: [126,34,206], text: "Choose an item", original: original)
        try tap("Toggle placeholder final styles")
        try tap("Toggle placeholder custom styles")
        _ = try observe("light-after-provider", rgb: [112,112,112], text: "Choose an item", original: original)
        try tap("G02 scene placeholder content")
        try tap("Toggle empty placeholder")
        XCTAssertTrue(!node("library-placeholder").exists || node("library-placeholder").label.isEmpty)
        retain(original, try state())
        try tap("Toggle empty placeholder")
        _ = try observe("empty-restored", rgb: [112,112,112], text: "Choose an item", original: original)
    }
    func testP03NarrowWrappedFirstActionAndReset() throws {
        let original = try state()
        try tap("Toggle placeholder final styles")
        try tap("G02 deferred placeholder content")
        let wide = try observe("full-final-deferred", rgb: [126,34,206], text: "Deferred owner content", original: original)
        try tap("Vertical blocked region")
        let narrow = try observe("narrow-final-deferred", rgb: [126,34,206], text: "Deferred owner content", original: original)
        XCTAssertLessThan(narrow.width, wide.width)
        XCTAssertGreaterThan(narrow.height, wide.height * 1.5)
        let target = node("library-placeholder")
        try reveal(target)
        target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.2)
        let action = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in (try? self.state()["actions"] as? Int) == 1 }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [action], timeout: nativeWorkRemaining()), .completed)
        let after = try state()
        retain(original, after)
        let rows = try XCTUnwrap(after["receipts"] as? [[String: Any]])
        XCTAssertEqual(rows.compactMap { $0["kind"] as? String }, ["pressIn", "pressOut", "press"])
        for row in rows { XCTAssertEqual((row["native"] as? [String: Any])?["target"] as? Int, original["rootTag"] as? Int) }
        _ = try observe("narrow-after-first-action", rgb: [126,34,206], text: "Deferred owner content", original: original)
        try tap("Live window")
        try tap("Reset scene")
        try tap("Text/Button scene")
        try tap("G02 prepare placeholder")
        let reset = try state()
        XCTAssertEqual(reset["actions"] as? Int, 0)
        _ = try observe("reset-default", rgb: [112,112,112], text: "Choose an item", original: reset)
    }
}

// Actual held screenshots are captured independently through standard simctl while XCTest owns input.
final class SliderHitLayoutTrialTests: XCTestCase {
    private var app: XCUIApplication!
    private let holdSeconds: TimeInterval = 5
    private var admission: [String: String] = [:]

    override func setUpWithError() throws {
        continueAfterFailure = false
        for key in ["CODON_SLIDER_SCENE_SHA256", "CODON_SLIDER_PRODUCT_SHA256",
                    "CODON_SLIDER_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing admission identity " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression), "Invalid " + key)
            admission[key] = value
        }
        app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
        app.launch()
        XCTAssertEqual(app.state, .runningForeground)
        XCUIDevice.shared.orientation = .portrait
        tap("Reset scene")
        tap("Live window")
        tap("Light theme")
        tap("Slider scene")
        XCTAssertEqual(XCUIDevice.shared.orientation, .portrait)
        let window = app.windows.firstMatch.frame
        XCTAssertGreaterThan(window.height, window.width)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        XCTAssertTrue(node("slider-scalar").waitForExistence(timeout: nativeWorkRemaining()))
    }

    override func tearDownWithError() throws {
        let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screen.name = "slider-hit-layout-final-screen"
        screen.lifetime = .keepAlways
        add(screen)
        let tree = XCTAttachment(string: app.debugDescription)
        tree.name = "slider-hit-layout-final-hierarchy"
        tree.lifetime = .keepAlways
        add(tree)
    }

    private func node(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    private func tap(_ label: String) {
        let button=app.buttons.matching(NSPredicate(format:"label == %@",label)).firstMatch
        XCTAssertTrue(button.waitForExistence(timeout:nativeWorkRemaining()))
        let scroll=app.scrollViews.firstMatch
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !button.frame.isEmpty && viewport.contains(button.frame) { button.tap();return }
            guard let distance=galleryScrollFraction(Double(button.frame.minY),Double(button.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else { XCTFail("Slider setup control cannot fit measured viewport");return }
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        }
        XCTFail("Slider setup control unreachable: "+label)
    }

    private func waitUntil(_ message: String, _ predicate: @escaping () -> Bool) {
        let gate = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: nativeWorkRemaining()), .completed, message)
    }

    private func revealScalarSetup() {
        let scroll=app.scrollViews.firstMatch
        XCTAssertTrue(scroll.exists)
        XCTAssertTrue(node("slider-layout-held-json").exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:4,dy:4)
            let scalar=node("slider-scalar").frame
            let held=node("slider-layout-held-json").frame
            if !scalar.isEmpty && !held.isEmpty && viewport.contains(scalar) && viewport.contains(held) { return }
            let union=scalar.union(held)
            guard let distance=galleryScrollFraction(Double(union.minY),Double(union.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else { XCTFail("Original scalar and held receipt cannot fit actual viewport");return }
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        }
        XCTFail("Original scalar and held receipt unreachable before measuring")
    }

    private func number(_ row: [String: Any], _ key: String) throws -> Double {
        let value = try XCTUnwrap(row[key] as? NSNumber, "Missing numeric " + key).doubleValue
        XCTAssertTrue(value.isFinite, "Nonfinite " + key)
        return value
    }

    private func rect(_ row: [String: Any], _ key: String) throws -> CGRect {
        let value = try XCTUnwrap(row[key] as? [String: Any], "Missing original native frame " + key)
        let frame = CGRect(x: try number(value, "x"), y: try number(value, "y"),
                           width: try number(value, "width"), height: try number(value, "height"))
        XCTAssertGreaterThan(frame.width, 0)
        XCTAssertGreaterThan(frame.height, 0)
        return frame
    }

    private func sameFrame(_ actual: CGRect, _ expected: CGRect, accuracy: CGFloat = 1) {
        for (left, right) in zip([actual.minX, actual.minY, actual.width, actual.height],
                                 [expected.minX, expected.minY, expected.width, expected.height]) {
            XCTAssertEqual(left, right, accuracy: accuracy)
        }
    }

    private func geometry() throws -> [String: Any] {
        let raw = node("slider-layout-native-geometry").label
        let first = try XCTUnwrap(raw.firstIndex(of: "{"), "Native geometry unavailable: " + raw)
        let last = try XCTUnwrap(raw.lastIndex(of: "}"))
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw[first...last].utf8)) as? [String: Any])
    }

    private func measure() throws -> [String: Any] {
        tap("Measure scalar original thumb geometry")
        waitUntil("Original native geometry did not arrive") { (try? self.geometry()) != nil }
        let value = try geometry()
        XCTAssertEqual(value["coordinateSpace"] as? String,
                       "stock-native-viewport-bounds-with-original-root-window-offset")
        let tags = try XCTUnwrap(value["tags"] as? [Int])
        XCTAssertEqual(tags.count, 4)
        XCTAssertEqual(Set(tags).count, 4)
        XCTAssertTrue(tags.allSatisfy { $0 > 0 })
        XCTAssertTrue(try XCTUnwrap(value["targetID"] as? String).hasSuffix(":thumb:0"))
        return value
    }

    private func state() throws -> [String: Any] {
        let raw = node("slider-layout-held-json").label
        let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any])
        try exact(value["dropped"], 0)
        return value
    }

    private func events() throws -> [[String: Any]] {
        try XCTUnwrap(try state()["receipts"] as? [[String: Any]])
    }

    private func exact(_ actual: Any?, _ expected: Any) throws {
        let value = try XCTUnwrap(actual)
        let left = try JSONSerialization.data(withJSONObject: ["value": value], options: .sortedKeys)
        let right = try JSONSerialization.data(withJSONObject: ["value": expected], options: .sortedKeys)
        XCTAssertEqual(left, right)
    }

    private func mark(_ name: String, _ values: [String: Any]) throws {
        var row = values
        row["epochSeconds"] = Date().timeIntervalSince1970
        row["uptimeSeconds"] = ProcessInfo.processInfo.systemUptime
        let data = try JSONSerialization.data(withJSONObject: row, options: .sortedKeys)
        FileHandle.standardOutput.write(Data((name + " ").utf8) + data + Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testP01TranslatedOriginalThumbHoldThenDrag() throws {
        tap("Prepare scalar layout witness")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        revealScalarSetup()
        let baseline = try measure()
        tap("Use scalar layout translated")
        let translated = try measure()
        try exact(translated["tags"], try XCTUnwrap(baseline["tags"]))
        try exact(translated["targetID"], try XCTUnwrap(baseline["targetID"]))
        let before = try XCTUnwrap(baseline["window"] as? [String: Any])
        let current = try XCTUnwrap(translated["window"] as? [String: Any])
        sameFrame(try rect(translated, "rootWindow"), try rect(baseline, "rootWindow"))
        let track = try rect(current, "track")
        sameFrame(track, try rect(before, "track"))
        for key in ["target", "paint"] {
            let original = try rect(before, key)
            sameFrame(try rect(current, key), original.offsetBy(dx: 48, dy: 0))
        }
        let target = try rect(current, "target")
        let paint = try rect(current, "paint")
        let rootWindow = try rect(translated, "rootWindow")
        let viewport = try XCTUnwrap(translated["viewport"] as? [String: Any])
        let rootViewport = try rect(viewport, "root")
        let pageOffset = CGPoint(x: rootWindow.minX - rootViewport.minX, y: rootWindow.minY - rootViewport.minY)
        sameFrame(node("slider-scalar").frame, rootWindow)
        sameFrame(node("slider-scalar-thumb-1-target").frame, target)
        let start = CGPoint(x: paint.midX, y: paint.midY)
        XCTAssertTrue(target.contains(start))
        let inset: CGFloat = track.width > 44 ? 22 : 0
        let span = track.width - 2 * inset
        XCTAssertGreaterThan(span, 0)
        let end = CGPoint(x: start.x + 0.2 * span, y: start.y)
        let window = app.windows.firstMatch
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(start))
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(end))
        XCTAssertTrue(track.contains(start))
        XCTAssertTrue(track.contains(end))
        let hud = node("slider-layout-held-json")
        XCTAssertTrue(hud.exists, "The independent held-state capture needs the compact fixture receipt")
        XCTAssertTrue(window.frame.contains(hud.frame), "Held receipt must be visible without scrolling during input")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        XCTAssertTrue(try events().isEmpty)
        let origin = window.coordinate(withNormalizedOffset: .zero)
        let from = origin.withOffset(CGVector(dx: start.x - window.frame.minX, dy: start.y - window.frame.minY))
        let to = origin.withOffset(CGVector(dx: end.x - window.frame.minX, dy: end.y - window.frame.minY))
        try mark("CODON_SLIDER_GESTURE_BEGIN", [
            "admission": admission, "geometry": translated, "before": try state(),
            "startPoints": [start.x, start.y], "endPoints": [end.x, end.y], "holdSeconds": holdSeconds,
            "heldCheckpoint": "INDEPENDENT_CAPTURE_REQUIRED_NOT_ASSERTED_BY_THIS_METHOD"
        ])
        from.press(forDuration: holdSeconds, thenDragTo: to)
        try mark("CODON_SLIDER_GESTURE_RETURN", ["owner": try state(), "events": try events()])
        waitUntil("Original drag did not produce one end at 0.7") {
            guard let row = try? self.state() else { return false }
            return row["scalar"] as? Double == 0.7 && row["ends"] as? Int == 1
        }
        let result = try state()
        try exact(result["scalar"], 0.7)
        try exact(result["ends"], 1)
        XCTAssertGreaterThan(try XCTUnwrap(result["requests"] as? Int), 0)
        let rows = try events()
        try exact(result["preset"], "translated")
        let tags = try XCTUnwrap(translated["tags"] as? [Int])
        try exact(result["rootTag"], tags[0])
        for (index, row) in rows.enumerated() {
            try exact(row["rootTag"], tags[0])
            try exact(row["preset"], "translated")
            try exact(row["sequence"], index + 1)
        }
        let touches = rows.filter { $0["kind"] as? String == "touch" }
        let downs = touches.filter { $0["phase"] as? String == "start" }
        XCTAssertEqual(downs.count, 1)
        let down = try XCTUnwrap(downs.first, "Original DOWN was lost")
        let moves = touches.filter { $0["phase"] as? String == "move" }
        XCTAssertFalse(moves.isEmpty, "Actual native MOVE receipts are required")
        let ups = touches.filter { $0["phase"] as? String == "end" }
        XCTAssertEqual(ups.count, 1)
        XCTAssertFalse(touches.contains { $0["phase"] as? String == "cancel" })
        let up = try XCTUnwrap(ups.first)
        try exact(down["target"], tags[2])
        XCTAssertEqual(try number(down, "pageX") + Double(pageOffset.x), Double(start.x), accuracy: 1)
        XCTAssertEqual(try number(down, "pageY") + Double(pageOffset.y), Double(start.y), accuracy: 1)
        for row in moves + [up] {
            try exact(row["identifier"], try XCTUnwrap(down["identifier"]))
            try exact(row["target"], tags[2])
            XCTAssertGreaterThanOrEqual(try number(row, "timestamp"), try number(down, "timestamp"))
            XCTAssertLessThanOrEqual(try number(row, "timestamp"), try number(up, "timestamp"))
        }
        XCTAssertLessThan(try number(down, "sequence"), try number(try XCTUnwrap(moves.first), "sequence"))
        XCTAssertLessThan(try number(try XCTUnwrap(moves.last), "sequence"), try number(up, "sequence"))
        XCTAssertEqual(try number(up, "pageX") - number(down, "pageX"), Double(0.2 * span), accuracy: 1)
        XCTAssertEqual(try number(up, "pageY"), try number(down, "pageY"), accuracy: 1)
        let requests = rows.filter { $0["kind"] as? String == "request" }
        let ends = rows.filter { $0["kind"] as? String == "change-end" }
        try exact(result["requests"], requests.count)
        XCTAssertEqual(ends.count, 1)
        try exact(requests.last?["value"], 0.7)
        try exact(ends.first?["value"], 0.7)
        XCTAssertGreaterThan(try number(try XCTUnwrap(ends.first), "sequence"),
                             try number(try XCTUnwrap(requests.last), "sequence"))
        try mark("CODON_SLIDER_FINAL_OUTCOME", ["owner": result, "events": rows,
                 "scope": "iOS P01 translated slice; independent held capture and remaining G01 matrix required"])
    }

    func testP01RepositionedOriginalThumbHoldThenDrag() throws {
        tap("Prepare scalar layout witness")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        revealScalarSetup()
        let baseline = try measure()
        tap("Use scalar layout repositioned")
        let repositioned = try measure()
        try exact(repositioned["tags"], try XCTUnwrap(baseline["tags"]))
        try exact(repositioned["targetID"], try XCTUnwrap(baseline["targetID"]))
        let before = try XCTUnwrap(baseline["window"] as? [String: Any])
        let current = try XCTUnwrap(repositioned["window"] as? [String: Any])
        sameFrame(try rect(repositioned, "rootWindow"), try rect(baseline, "rootWindow"))
        let track = try rect(current, "track")
        sameFrame(track, try rect(before, "track"))
        for key in ["target", "paint"] {
            let original = try rect(before, key)
            let positioned = CGRect(x: track.minX + 0.35 * track.width - original.width / 2,
                                    y: track.midY - original.height / 2,
                                    width: original.width, height: original.height)
            sameFrame(try rect(current, key), positioned)
            XCTAssertGreaterThan(abs(positioned.midX - original.midX), 1)
        }
        let target = try rect(current, "target")
        let paint = try rect(current, "paint")
        let rootWindow = try rect(repositioned, "rootWindow")
        let viewport = try XCTUnwrap(repositioned["viewport"] as? [String: Any])
        let rootViewport = try rect(viewport, "root")
        let pageOffset = CGPoint(x: rootWindow.minX - rootViewport.minX, y: rootWindow.minY - rootViewport.minY)
        sameFrame(node("slider-scalar").frame, rootWindow)
        sameFrame(node("slider-scalar-thumb-1-target").frame, target)
        let start = CGPoint(x: paint.midX, y: paint.midY)
        XCTAssertTrue(target.contains(start))
        let inset: CGFloat = track.width > 44 ? 22 : 0
        let span = track.width - 2 * inset
        XCTAssertGreaterThan(span, 0)
        let end = CGPoint(x: start.x + 0.2 * span, y: start.y)
        let window = app.windows.firstMatch
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(start))
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(end))
        XCTAssertTrue(track.contains(start))
        XCTAssertTrue(track.contains(end))
        let hud = node("slider-layout-held-json")
        XCTAssertTrue(hud.exists, "The independent held-state capture needs the compact fixture receipt")
        XCTAssertTrue(window.frame.contains(hud.frame), "Held receipt must be visible without scrolling during input")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        XCTAssertTrue(try events().isEmpty)
        let origin = window.coordinate(withNormalizedOffset: .zero)
        let from = origin.withOffset(CGVector(dx: start.x - window.frame.minX, dy: start.y - window.frame.minY))
        let to = origin.withOffset(CGVector(dx: end.x - window.frame.minX, dy: end.y - window.frame.minY))
        try mark("CODON_SLIDER_GESTURE_BEGIN", [
            "admission": admission, "geometry": repositioned, "before": try state(),
            "startPoints": [start.x, start.y], "endPoints": [end.x, end.y], "holdSeconds": holdSeconds,
            "heldCheckpoint": "INDEPENDENT_CAPTURE_REQUIRED_NOT_ASSERTED_BY_THIS_METHOD"
        ])
        from.press(forDuration: holdSeconds, thenDragTo: to)
        try mark("CODON_SLIDER_GESTURE_RETURN", ["owner": try state(), "events": try events()])
        waitUntil("Original drag did not produce one end at 0.7") {
            guard let row = try? self.state() else { return false }
            return row["scalar"] as? Double == 0.7 && row["ends"] as? Int == 1
        }
        let result = try state()
        try exact(result["scalar"], 0.7)
        try exact(result["ends"], 1)
        XCTAssertGreaterThan(try XCTUnwrap(result["requests"] as? Int), 0)
        let rows = try events()
        try exact(result["preset"], "repositioned")
        let tags = try XCTUnwrap(repositioned["tags"] as? [Int])
        try exact(result["rootTag"], tags[0])
        for (index, row) in rows.enumerated() {
            try exact(row["rootTag"], tags[0])
            try exact(row["preset"], "repositioned")
            try exact(row["sequence"], index + 1)
        }
        let touches = rows.filter { $0["kind"] as? String == "touch" }
        let downs = touches.filter { $0["phase"] as? String == "start" }
        XCTAssertEqual(downs.count, 1)
        let down = try XCTUnwrap(downs.first, "Original DOWN was lost")
        let moves = touches.filter { $0["phase"] as? String == "move" }
        XCTAssertFalse(moves.isEmpty, "Actual native MOVE receipts are required")
        let ups = touches.filter { $0["phase"] as? String == "end" }
        XCTAssertEqual(ups.count, 1)
        XCTAssertFalse(touches.contains { $0["phase"] as? String == "cancel" })
        let up = try XCTUnwrap(ups.first)
        try exact(down["target"], tags[2])
        XCTAssertEqual(try number(down, "pageX") + Double(pageOffset.x), Double(start.x), accuracy: 1)
        XCTAssertEqual(try number(down, "pageY") + Double(pageOffset.y), Double(start.y), accuracy: 1)
        for row in moves + [up] {
            try exact(row["identifier"], try XCTUnwrap(down["identifier"]))
            try exact(row["target"], tags[2])
            XCTAssertGreaterThanOrEqual(try number(row, "timestamp"), try number(down, "timestamp"))
            XCTAssertLessThanOrEqual(try number(row, "timestamp"), try number(up, "timestamp"))
        }
        XCTAssertLessThan(try number(down, "sequence"), try number(try XCTUnwrap(moves.first), "sequence"))
        XCTAssertLessThan(try number(try XCTUnwrap(moves.last), "sequence"), try number(up, "sequence"))
        XCTAssertEqual(try number(up, "pageX") - number(down, "pageX"), Double(0.2 * span), accuracy: 1)
        XCTAssertEqual(try number(up, "pageY"), try number(down, "pageY"), accuracy: 1)
        let requests = rows.filter { $0["kind"] as? String == "request" }
        let ends = rows.filter { $0["kind"] as? String == "change-end" }
        try exact(result["requests"], requests.count)
        XCTAssertEqual(ends.count, 1)
        try exact(requests.last?["value"], 0.7)
        try exact(ends.first?["value"], 0.7)
        XCTAssertGreaterThan(try number(try XCTUnwrap(ends.first), "sequence"),
                             try number(try XCTUnwrap(requests.last), "sequence"))
        // The custom left percentage still owns visual placement after numeric owner echo.
        let after = try measure()
        try exact(after["tags"], tags)
        try exact(after["targetID"], try XCTUnwrap(repositioned["targetID"]))
        sameFrame(try rect(after, "rootWindow"), rootWindow)
        let afterWindow = try XCTUnwrap(after["window"] as? [String: Any])
        for key in ["track", "target", "paint"] {
            sameFrame(try rect(afterWindow, key), try rect(current, key))
        }
        try exact(try state()["scalar"], 0.7)
        try exact(try state()["ends"], 1)
        try exact(try state()["requests"], try XCTUnwrap(result["requests"]))
        try mark("CODON_SLIDER_FINAL_OUTCOME", ["owner": result, "events": rows, "geometryAfter": after,
                 "scope": "iOS P01 repositioned slice; independent held capture and remaining G01 matrix required"])
    }

    private func exerciseRotatedContact(atCorner: Bool) throws {
        tap("Prepare scalar layout witness")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        revealScalarSetup()
        let baseline = try measure()
        tap("Use scalar layout rotated-scaled")
        let rotated = try measure()
        try exact(rotated["tags"], try XCTUnwrap(baseline["tags"]))
        try exact(rotated["targetID"], try XCTUnwrap(baseline["targetID"]))
        let before = try XCTUnwrap(baseline["window"] as? [String: Any])
        let current = try XCTUnwrap(rotated["window"] as? [String: Any])
        sameFrame(try rect(rotated, "rootWindow"), try rect(baseline, "rootWindow"))
        let track = try rect(current, "track")
        sameFrame(track, try rect(before, "track"))
        for key in ["target", "paint"] {
            let original = try rect(before, key)
            let radians = 20 * Double.pi / 180
            let width = 1.25 * (original.width * CGFloat(cos(radians)) + original.height * CGFloat(sin(radians)))
            let height = 1.25 * (original.width * CGFloat(sin(radians)) + original.height * CGFloat(cos(radians)))
            let bounds = CGRect(x: original.midX + 48 - width / 2,
                                y: original.midY - height / 2, width: width, height: height)
            sameFrame(try rect(current, key), bounds)
            XCTAssertGreaterThan(width, original.width)
            XCTAssertGreaterThan(height, original.height)
        }
        let target = try rect(current, "target")
        let paint = try rect(current, "paint")
        let rootWindow = try rect(rotated, "rootWindow")
        let viewport = try XCTUnwrap(rotated["viewport"] as? [String: Any])
        let rootViewport = try rect(viewport, "root")
        let pageOffset = CGPoint(x: rootWindow.minX - rootViewport.minX, y: rootWindow.minY - rootViewport.minY)
        sameFrame(node("slider-scalar").frame, rootWindow)
        sameFrame(node("slider-scalar-thumb-1-target").frame, target)
        let start = atCorner ? CGPoint(x: paint.minX + 2, y: paint.minY + 2)
                             : CGPoint(x: paint.midX, y: paint.midY)
        XCTAssertTrue(target.contains(start))
        let inset: CGFloat = track.width > 44 ? 22 : 0
        let span = track.width - 2 * inset
        XCTAssertGreaterThan(span, 0)
        let snap: (Double) -> Double = { min(1, max(0, ($0 * 20).rounded() / 20)) }
        if atCorner {
            XCTAssertNotEqual(snap(Double((start.x - track.minX - inset) / span)), 0.5,
                              "The probe must distinguish track snapping from a thumb hold")
        }
        let end = CGPoint(x: start.x + 0.2 * span, y: start.y)
        let window = app.windows.firstMatch
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(start))
        XCTAssertTrue(window.frame.insetBy(dx: 1, dy: 1).contains(end))
        XCTAssertTrue(track.contains(start))
        XCTAssertTrue(track.contains(end))
        let hud = node("slider-layout-held-json")
        XCTAssertTrue(hud.exists, "The independent held-state capture needs the compact fixture receipt")
        XCTAssertTrue(window.frame.contains(hud.frame), "Held receipt must be visible without scrolling during input")
        try exact(try state()["scalar"], 0.5)
        try exact(try state()["requests"], 0)
        try exact(try state()["ends"], 0)
        XCTAssertTrue(try events().isEmpty)
        let origin = window.coordinate(withNormalizedOffset: .zero)
        let from = origin.withOffset(CGVector(dx: start.x - window.frame.minX, dy: start.y - window.frame.minY))
        let to = origin.withOffset(CGVector(dx: end.x - window.frame.minX, dy: end.y - window.frame.minY))
        try mark("CODON_SLIDER_GESTURE_BEGIN", [
            "admission": admission, "geometry": rotated, "before": try state(),
            "probe": atCorner ? "aabb-corner" : "measured-center",
            "startPoints": [start.x, start.y], "endPoints": [end.x, end.y], "holdSeconds": holdSeconds,
            "heldCheckpoint": "INDEPENDENT_CAPTURE_REQUIRED_NOT_ASSERTED_BY_THIS_METHOD"
        ])
        from.press(forDuration: holdSeconds, thenDragTo: to)
        try mark("CODON_SLIDER_GESTURE_RETURN", ["owner": try state(), "events": try events()])
        waitUntil("Original rotated contact did not produce one end") {
            (try? self.state()["ends"] as? Int) == 1
        }
        let result = try state()
        try exact(result["ends"], 1)
        XCTAssertGreaterThan(try XCTUnwrap(result["requests"] as? Int), 0)
        let rows = try events()
        try exact(result["preset"], "rotated-scaled")
        let tags = try XCTUnwrap(rotated["tags"] as? [Int])
        try exact(result["rootTag"], tags[0])
        for (index, row) in rows.enumerated() {
            try exact(row["rootTag"], tags[0])
            try exact(row["preset"], "rotated-scaled")
            try exact(row["sequence"], index + 1)
        }
        let touches = rows.filter { $0["kind"] as? String == "touch" }
        let downs = touches.filter { $0["phase"] as? String == "start" }
        XCTAssertEqual(downs.count, 1)
        let down = try XCTUnwrap(downs.first, "Original DOWN was lost")
        let moves = touches.filter { $0["phase"] as? String == "move" }
        XCTAssertFalse(moves.isEmpty, "Actual native MOVE receipts are required")
        let ups = touches.filter { $0["phase"] as? String == "end" }
        XCTAssertEqual(ups.count, 1)
        XCTAssertFalse(touches.contains { $0["phase"] as? String == "cancel" })
        let up = try XCTUnwrap(ups.first)
        let nativeTarget = try XCTUnwrap(down["target"] as? Int)
        XCTAssertTrue(nativeTarget == tags[1] || nativeTarget == tags[2], "Unrecognized original native receiver")
        if !atCorner { XCTAssertEqual(nativeTarget, tags[2], "Measured center must hit the original thumb") }
        let originalThumbHit = nativeTarget == tags[2]
        let actualDownX = try number(down, "pageX") + Double(pageOffset.x)
        let heldValue = originalThumbHit ? 0.5 : snap((actualDownX - Double(track.minX + inset)) / Double(span))
        let actualUpX = try number(up, "pageX") + Double(pageOffset.x)
        let expectedFinal = originalThumbHit
            ? snap(0.5 + (actualUpX - actualDownX) / Double(span))
            : snap((actualUpX - Double(track.minX + inset)) / Double(span))
        try exact(result["scalar"], expectedFinal)
        XCTAssertEqual(try number(down, "pageX") + Double(pageOffset.x), Double(start.x), accuracy: 1)
        XCTAssertEqual(try number(down, "pageY") + Double(pageOffset.y), Double(start.y), accuracy: 1)
        for row in moves + [up] {
            try exact(row["identifier"], try XCTUnwrap(down["identifier"]))
            try exact(row["target"], nativeTarget)
            XCTAssertGreaterThanOrEqual(try number(row, "timestamp"), try number(down, "timestamp"))
            XCTAssertLessThanOrEqual(try number(row, "timestamp"), try number(up, "timestamp"))
        }
        XCTAssertLessThan(try number(down, "sequence"), try number(try XCTUnwrap(moves.first), "sequence"))
        XCTAssertLessThan(try number(try XCTUnwrap(moves.last), "sequence"), try number(up, "sequence"))
        XCTAssertEqual(try number(up, "pageX") - number(down, "pageX"), Double(0.2 * span), accuracy: 1)
        XCTAssertEqual(try number(up, "pageY"), try number(down, "pageY"), accuracy: 1)
        let requests = rows.filter { $0["kind"] as? String == "request" }
        let ends = rows.filter { $0["kind"] as? String == "change-end" }
        try exact(result["requests"], requests.count)
        XCTAssertEqual(ends.count, 1)
        if !originalThumbHit {
            try exact(requests.first?["value"], heldValue)
            XCTAssertLessThan(try number(try XCTUnwrap(requests.first), "sequence"),
                              try number(try XCTUnwrap(moves.first), "sequence"))
        }
        try exact(requests.last?["value"], expectedFinal)
        try exact(ends.first?["value"], expectedFinal)
        XCTAssertGreaterThan(try number(try XCTUnwrap(ends.first), "sequence"),
                             try number(try XCTUnwrap(requests.last), "sequence"))
        // Bounds remain an axis-aligned measurement; actual native delivery supplies the hit oracle.
        let after = try measure()
        try exact(after["tags"], tags)
        try exact(after["targetID"], try XCTUnwrap(rotated["targetID"]))
        sameFrame(try rect(after, "rootWindow"), rootWindow)
        let afterWindow = try XCTUnwrap(after["window"] as? [String: Any])
        sameFrame(try rect(afterWindow, "track"), track)
        for key in ["target", "paint"] {
            sameFrame(try rect(afterWindow, key),
                      try rect(current, key).offsetBy(dx: CGFloat(expectedFinal - 0.5) * span, dy: 0))
        }
        try exact(try state()["scalar"], expectedFinal)
        try exact(try state()["ends"], 1)
        try exact(try state()["requests"], try XCTUnwrap(result["requests"]))
        try mark("CODON_SLIDER_FINAL_OUTCOME", ["owner": result, "events": rows, "geometryAfter": after,
                 "nativeReceiver": originalThumbHit ? "original-thumb" : "original-track", "expectedHeldValue": heldValue,
                 "expectedFinal": expectedFinal, "probe": atCorner ? "aabb-corner" : "measured-center",
                 "scope": "iOS P01 rotated point probe; no measured quad or wholeG01 claim"])
    }

    func testP01RotatedCenterOriginalThumbHoldThenDrag() throws {
        try exerciseRotatedContact(atCorner: false)
    }

    func testP01RotatedCornerFollowsOriginalNativeHit() throws {
        try exerciseRotatedContact(atCorner: true)
    }
}

private func switchNativeValueMatches(_ value:Any?,_ selected:Bool)->Bool {
    if let text=value as? String {return text == (selected ? "1":"0")}
    if let number=value as? NSNumber {return number.doubleValue.isFinite && number.doubleValue == (selected ? 1:0)}
    return false
}

private func switchTrackSamples(_ bytes:[UInt8])->([Int],[Int])? {
    guard !bytes.isEmpty,bytes.count%4==0 else{return nil}
    var best:[Int]=[],start:Int?=nil,palette:[String:Int]=[:],colors:[String:[Int]]=[:]
    for x in 0...bytes.count/4 {
        let white=x<bytes.count/4 && Array(bytes[(x*4)..<(x*4+4)]) == [255,255,255,255]
        if white {if start==nil {start=x}}else if let first=start {if best.isEmpty || x-first>best[1] {best=[first,x-first]};start=nil}
        if x<bytes.count/4 && !white {let rgba=Array(bytes[(x*4)..<(x*4+4)]).map(Int.init);let key=rgba.map(String.init).joined(separator:",");palette[key,default:0]+=1;colors[key]=rgba}
    }
    guard !best.isEmpty,let key=palette.max(by:{$0.value<$1.value})?.key,let color=colors[key] else{return nil}
    return (best,color)
}

private func switchThumbIntermediate(_ row:[String:Any])->Bool {
    guard let run=row["thumbRun"] as? [Int],run.count==2,let scale=row["scale"] as? Double,scale.isFinite,scale>0 else{return false}
    return run[0]>1 && Double(run[0])<15*scale-1
}

private func switchEndpointCoverage(_ samples:[[String:Any]],_ settle:Double,_ retire:Double,_ fresh:Double)->Bool {
    guard settle.isFinite,retire.isFinite,fresh.isFinite,settle+250<retire,retire<fresh else{return false}
    guard samples.allSatisfy({row in guard let start=row["captureStartedEpochMs"] as? Double,let end=row["captureEpochMs"] as? Double else{return false};return start.isFinite && end.isFinite && start<=end}) else{return false}
    let settled=samples.filter{($0["captureStartedEpochMs"] as? Double ?? -.infinity)>=settle+250 && ($0["captureEpochMs"] as? Double ?? .infinity)<retire}
    let current=samples.filter{($0["captureStartedEpochMs"] as? Double ?? -.infinity)>=fresh+250}
    return !settled.isEmpty && !current.isEmpty && (settled+current).allSatisfy{$0["referenceExact"] as? Bool==true}
}

private func switchRetirementCoverage(_ samples:[[String:Any]],_ retire:Double,_ fresh:Double)->Bool {
    guard retire.isFinite,fresh.isFinite,retire<fresh else{return false}
    guard samples.allSatisfy({row in guard let start=row["captureStartedEpochMs"] as? Double,let end=row["captureEpochMs"] as? Double else{return false};return start.isFinite && end.isFinite && start<=end}) else{return false}
    let candidates=samples.filter{($0["captureStartedEpochMs"] as? Double ?? -.infinity)>=retire && ($0["captureEpochMs"] as? Double ?? .infinity)<fresh}
    guard candidates.allSatisfy({row in guard let actual=row["inkPixels"] as? Int,let reference=row["referenceInkPixels"] as? Int else{return false};return actual>=0 && reference>=0}),let first=candidates.firstIndex(where:{$0["referenceInkPixels"] as? Int==0}) else{return false}
    return candidates[first...].allSatisfy{$0["referenceInkPixels"] as? Int==0 && $0["inkPixels"] as? Int==0 && $0["thumbRun"] as? [Int]==[] && $0["sampleRGBA"] as? [Int]==[]}
}

final class SwitchTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private var heldIntervals:[[String:Double]]=[]
    private let behavior=["baseline","echo","disabled","readonly","held-disabled","restored","renderer","replaced","retired","fresh","local","local-default-changed"]
    private let styles=["style-baseline","selected","border","inverted","primary","root-custom","final-style","parts-custom","authored-left","orthogonal","round","icons","long-narrow","fractional","percentage","track-small","root-small","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Basic controls scene");tap("Light theme");tap("Live window");tap("Prepare standalone Switch checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="switch-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="switch-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("switch-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual current Switch root/ref/layout") {guard let row=try? self.state(),let events=row["layouts"] as? [[String:Any]],let event=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (event["currentTarget"] as? NSNumber)?.doubleValue}}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot,prefix:String="SWITCH_NATIVE_OBSERVATION") throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data((prefix+" ").utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="switch-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="switch-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        let pair=node("switch-native-pair"),control=app.buttons["Show Switch reference"].firstMatch
        revealRegion(pair,control)
        XCTAssertTrue(control.isHittable && app.windows.firstMatch.frame.contains(control.frame),"Reference control must be visible before capture")
        let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("switch-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("switch-native-parent")).frame,reference=try XCTUnwrap(one("switch-native-reference-parent")).frame,root=one("switch-native-target"),raw=one("switch-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        control.tap();wait("Actual reference at original screen origin"){(try? self.state()["referenceAtOrigin"] as? Bool)==true}
        let frame=node("switch-native-reference-parent").frame
        XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(frame),Double(scale)))
        XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(node("switch-native-parent").frame),Double(scale)))
        let referenceShot=XCUIScreen.main.screenshot(),referenceImage=try XCTUnwrap(referenceShot.image.cgImage),expected=try pixels(referenceImage,frame,window,scale)
        let attachment=XCTAttachment(screenshot:referenceShot);attachment.name="switch-"+name+"-matched-reference";attachment.lifetime = .keepAlways;add(attachment)
        tap("Show Switch component");wait("Original Switch visible again"){(try? self.state()["referenceAtOrigin"] as? Bool)==false}
        XCTAssertEqual(try state()["rootTag"] as? NSNumber,row["rootTag"] as? NSNumber)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let exact=circularPixelsMatch(actual,expected)
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"matchedReferenceParent":rect(frame),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeValue":root?.value ?? NSNull(),"nativeSwitch":root?.elementType == .switch,"nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"heldContactIntervals":heldIntervals,"targetCount":all.filter{$0.identifier=="switch-native-target"}.count,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"inkPixels":ink,"scale":Double(scale),"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,observed,shot);XCTAssertTrue(exact,"Switch differs from independent raw native reference at the same physical position")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);return}
        let event=try XCTUnwrap((row["layouts"] as? [[String:Any]])?.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw)
        XCTAssertEqual(target.elementType,.switch);XCTAssertEqual(target.label,"Keep settings");XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false));XCTAssertTrue(switchNativeValueMatches(target.value,row["selected"] as? Bool==true))
        for (actual,expected) in zip([target.frame.minX-parent.minX,target.frame.minY-parent.minY,target.frame.width,target.frame.height],[nativeReference.frame.minX-reference.minX,nativeReference.frame.minY-reference.minY,nativeReference.frame.width,nativeReference.frame.height]){XCTAssertEqual(actual,expected,accuracy:1/scale)}
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        if let width=row["rootWidth"] as? NSNumber {XCTAssertEqual(target.frame.width,width.doubleValue,accuracy:1/scale)}
        if row["small"] as? Bool==true {XCTAssertEqual(target.frame.height,24,accuracy:1/scale)}else{XCTAssertGreaterThanOrEqual(target.frame.height,44-1/scale)}
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan(target.frame.height,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    func testSwitchActionsAndLifetimes() throws {
        tap("Switch behavior checks");var original=0.0
        for name in behavior {
            wait("Current Switch case "+name){(try? self.state()["case"] as? String)==name};if name != "retired" {ready()};try capture(name)
            if name=="baseline" {original=try number(state(),"rootTag");for count in 1...2 {let target=node("switch-native-target");reveal(target);target.tap();wait("Native vetoed Switch request"){((try? self.state()["actions"] as? NSNumber)?.intValue ?? 0)==count};XCTAssertEqual(try state()["selected"] as? Bool,false);try capture("vetoed-"+String(count))}}
            if ["echo","restored","local"].contains(name) {
                let count=name=="restored" ? 1:2
                for index in 0..<count {let before=try number(state(),"actions"),selected=try state()["selected"] as? Bool==true,target=node("switch-native-target");reveal(target);target.tap();wait("Original native Switch activation"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1};XCTAssertEqual(try state()["selected"] as? Bool,!selected);try capture(name+"-activated-"+String(index))}
            }
            if ["echo","disabled","readonly","held-disabled","restored","renderer"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if ["disabled","readonly","held-disabled"].contains(name) {
                let before=try number(state(),"actions"),target=node("switch-native-target");reveal(target);let began=Date().timeIntervalSince1970*1000;target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:name=="held-disabled" ? 1:0)
                Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)
                if name=="held-disabled" {let ended=Date().timeIntervalSince1970*1000,current=try state(),events=try XCTUnwrap(current["events"] as? [[String:Any]]),entry=try XCTUnwrap(events.last{$0["phase"] as? String=="in"});let epoch=try number(entry,"epochMs");XCTAssertGreaterThanOrEqual(epoch,began);XCTAssertLessThan(epoch,ended-400);heldIntervals.append(["beganEpochMs":began,"endedEpochMs":ended,"disabledOnPressInEpochMs":epoch]);XCTAssertEqual(current["canceled"] as? Bool,true);try capture("held-canceled")}
            }
            if name=="replaced" || name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="retired" {let before=try number(state(),"actions");Thread.sleep(forTimeInterval:0.5);XCTAssertEqual(try number(state(),"actions"),before)}
            if name=="local-default-changed" {XCTAssertEqual(try state()["selected"] as? Bool,false)}
            if name != behavior.last {tap("Next Switch check")}
        }
        let row=try state(),presses=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(presses.count,7);XCTAssertTrue(presses.prefix(5).allSatisfy{($0["currentTarget"] as? NSNumber)?.doubleValue==original && (($0["target"] as? NSNumber)?.doubleValue ?? 0)>0})
        XCTAssertEqual(row["requests"] as? [Bool],[true,true,true,false,true,true,false]);XCTAssertEqual(row["phases"] as? [String],(0..<7).flatMap{_ in ["change","press"]})
    }
    func testSwitchStylesAndConstraints() throws {
        tap("Switch styles checks")
        for name in styles {
            wait("Current Switch style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last {tap("Next Switch check")}
        }
    }
    private func motion(_ name:String,reduced:Bool) throws {
        revealRegion(node("switch-native-pair"),app.buttons["Arm Switch motion and retirement"].firstMatch);ready();let before=try state(),window=app.windows.firstMatch.frame,parent=node("switch-native-parent").frame,reference=node("switch-native-reference-parent").frame,root=node("switch-native-target").frame,raw=node("switch-native-reference").frame,arm=app.buttons["Arm Switch motion and retirement"].firstMatch
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));arm.tap();var samples:[[String:Any]]=[];let until=Date().timeIntervalSince1970+16.4
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),line=CGRect(x:root.midX-15,y:root.midY,width:30,height:1/scale),rawLine=CGRect(x:raw.midX-15,y:raw.midY,width:30,height:1/scale),track=try pixels(image,line,window,scale),rawTrack=try pixels(image,rawLine,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
            var referenceInk=0;for i in stride(from:0,to:expected.count,by:4){if expected[i] != 255 || expected[i+1] != 255 || expected[i+2] != 255{referenceInk+=1}}
            let observed=switchTrackSamples(track),endpoint=switchTrackSamples(rawTrack)
            let row:[String:Any]=["name":name+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"parent":rect(parent),"referenceParent":rect(reference),"sampleFrame":rect(line),"referenceSampleFrame":rect(rawLine),"referenceExact":circularPixelsMatch(actual,expected),"thumbRun":ink==0 ? []:observed?.0 ?? [],"referenceThumbRun":endpoint?.0 ?? [],"sampleRGBA":ink==0 ? []:observed?.1 ?? [],"referenceSampleRGBA":endpoint?.1 ?? [],"inkPixels":ink,"referenceInkPixels":referenceInk,"scale":Double(scale),"imageWidth":image.width,"imageHeight":image.height];samples.append(row);try mark(name+"-"+String(samples.count),row,shot,prefix:"SWITCH_NATIVE_MOTION_FRAME");Thread.sleep(forTimeInterval:0.10)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),trace=try XCTUnwrap(after["motionTrace"] as? [[String:Any]]),retired=try XCTUnwrap(trace.first{$0["name"] as? String=="retire"})
        let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=(trace[0]["epochMs"] as? Double ?? .infinity) && ($0["captureEpochMs"] as? Double ?? .infinity)<(retired["epochMs"] as? Double ?? 0)}
        let result:[String:Any]=["name":name,"reduced":reduced,"originalRootTag":try number(before,"rootTag"),"movingRows":moving.count,"state":after,"samples":samples];FileHandle.standardOutput.write(Data("SWITCH_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
        XCTAssertEqual(trace.compactMap{$0["name"] as? String},["select","interrupt","retarget"]+(3...31).map{"retarget-"+String($0)}+["settle","retire","fresh"]);XCTAssertGreaterThan(moving.count,1)
        if reduced {XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true})}else{
            XCTAssertTrue(moving.contains{row in guard let rgba=row["sampleRGBA"] as? [Int] else{return false};return listItemIntermediate(rgba)},"Real interrupted250ms track color")
            XCTAssertTrue(moving.contains{switchThumbIntermediate($0)},"Real interrupted225ms thumb position")
        }
        let settled=try XCTUnwrap(trace.first{$0["name"] as? String=="settle"}),fresh=try XCTUnwrap(trace.first{$0["name"] as? String=="fresh"})
        XCTAssertTrue(switchEndpointCoverage(samples,try number(settled,"epochMs"),try number(retired,"epochMs"),try number(fresh,"epochMs")),"Separate complete settled and fresh native endpoints")
        XCTAssertTrue(switchRetirementCoverage(samples,try number(retired,"epochMs"),try number(fresh,"epochMs")),"No component paint/work after confirmed native reference removal")
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Actual retired paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));ready()
        let snapshot=try app.snapshot();XCTAssertTrue(snapshot.children.count>0)
    }
    func testSwitchMotionAndRetirement() throws {
        tap("Switch motion checks");let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();reveal(node("switch-native-state"));wait("Real normal-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try motion("normal",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("switch-native-state"));wait("Real reduced-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try motion("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func revealRegion(_ first:XCUIElement,_ second:XCUIElement) {
        XCTAssertTrue(first.waitForExistence(timeout:nativeWorkRemaining()));XCTAssertTrue(second.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2),frame=first.frame.union(second.frame)
            if !frame.isEmpty && viewport.contains(frame){return}
            guard let distance=galleryScrollFraction(Double(frame.minY),Double(frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Switch canvas and its control cannot fit the actual viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Switch canvas/control unreachable")
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Switch target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("SWITCH_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable Switch control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected Switch scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}


private func checkboxColorIntermediate(_ rgba:[Int],_ from:[Int],_ to:[Int])->Bool {
    guard rgba.count==4 && from.count==4 && to.count==4 && rgba[3]==255 && from[3]==255 && to[3]==255 && from != to else{return false}
    return (0..<3).allSatisfy{min(from[$0],to[$0])<=rgba[$0] && rgba[$0]<=max(from[$0],to[$0])} && (0..<3).contains{min(from[$0],to[$0])<rgba[$0] && rgba[$0]<max(from[$0],to[$0])}
}
private func checkboxWhitePixels(_ data:[UInt8])->Int {
    guard data.count % 4 == 0 else{return -1}
    var count=0,index=0
    while index<data.count {
        if data[index]==255 && data[index+1]==255 && data[index+2]==255 && data[index+3]==255 {count+=1}
        index+=4
    }
    return count
}
private func checkboxNativeValueMatches(_ value:Any?,_ selected:Bool,_ mixed:Bool)->Bool {
    guard let text=value as? String else{return false}
    return text.components(separatedBy:",").map{$0.trimmingCharacters(in:.whitespaces)} == ["checkbox",mixed ? "mixed":selected ? "checked":"unchecked"]
}
private func checkboxGlyphIntermediate(_ samples:[[String:Any]],_ full:Int)->Bool {
    full>0 && samples.contains{guard let count=$0["glyphPixels"] as? Int else{return false};return count>0 && count<full}
}
private func checkboxGlyphCoverage(_ moving:[[String:Any]],_ samples:[[String:Any]])->Bool {
    let selected=samples.filter{($0["referenceSampleRGBA"] as? [Int]) == [17,119,51,255]}
    let counts=Set(selected.compactMap{$0["referenceGlyphPixels"] as? Int})
    guard counts.count==1,let full=counts.first,full>0 else{return false}
    let candidates=moving.filter{guard let rgba=$0["sampleRGBA"] as? [Int] else{return false};return rgba.count==4 && rgba != [255,255,255,255]}
    return checkboxGlyphIntermediate(candidates,full)
}
private func checkboxEndpointCoverage(_ samples:[[String:Any]],_ settled:Double,_ retire:Double,_ fresh:Double)->Bool {
    let settledRows=samples.filter{($0["captureStartedEpochMs"] as? Double ?? -.infinity)>=settled+250 && ($0["captureEpochMs"] as? Double ?? .infinity)<retire}
    let freshRows=samples.filter{($0["captureStartedEpochMs"] as? Double ?? -.infinity)>=fresh+250}
    return !settledRows.isEmpty && !freshRows.isEmpty && (settledRows+freshRows).allSatisfy{$0["referenceExact"] as? Bool==true}
}
private func checkboxRetirementCoverage(_ samples:[[String:Any]],_ retire:Double,_ fresh:Double)->Bool {
    guard retire.isFinite && fresh.isFinite && retire<fresh && samples.allSatisfy({row in guard let start=row["captureStartedEpochMs"] as? Double,let end=row["captureEpochMs"] as? Double else{return false};return start.isFinite && end.isFinite && start<=end}) else{return false}
    let rows=samples.filter{($0["captureStartedEpochMs"] as? Double ?? -.infinity)>=retire && ($0["captureEpochMs"] as? Double ?? .infinity)<fresh}
    guard rows.allSatisfy({($0["referenceInkPixels"] as? Int ?? -1)>=0 && ($0["inkPixels"] as? Int ?? -1)>=0}),let first=rows.firstIndex(where:{$0["referenceInkPixels"] as? Int==0}) else{return false}
    return rows[first...].allSatisfy{$0["referenceInkPixels"] as? Int==0 && $0["inkPixels"] as? Int==0 && ($0["sampleRGBA"] as? [Int])==[] && $0["glyphPixels"] as? Int==0}
}

final class CheckboxTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private var heldIntervals:[[String:Double]]=[]
    private let behavior=["baseline","echo","disabled","readonly","held-disabled","restored","renderer","mixed","group-veto","group-echo","group-disabled","group-readonly","replaced","retired","fresh","local","local-default-changed"]
    private let styles=["style-baseline","selected","mixed-style","no-icon","mixed-no-icon","primary","raised","root-custom","final-style","explicit-child","orthogonal","round","long-narrow","fractional","percentage","root-small","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Basic controls scene");tap("Light theme");tap("Live window");tap("Prepare standalone Checkbox checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="checkbox-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="checkbox-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("checkbox-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual current Checkbox root/ref/layout") {guard let row=try? self.state(),let events=row["layouts"] as? [[String:Any]],let event=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (event["currentTarget"] as? NSNumber)?.doubleValue}}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot,prefix:String="CHECKBOX_NATIVE_OBSERVATION") throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data((prefix+" ").utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="checkbox-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="checkbox-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        let pair=node("checkbox-native-pair"),control=app.buttons["Show Checkbox reference"].firstMatch
        revealRegion(pair,control)
        XCTAssertTrue(control.isHittable && app.windows.firstMatch.frame.contains(control.frame),"Reference control must be visible before capture")
        let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("checkbox-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("checkbox-native-parent")).frame,reference=try XCTUnwrap(one("checkbox-native-reference-parent")).frame,root=one("checkbox-native-target"),raw=one("checkbox-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        control.tap();wait("Actual reference at original screen origin"){(try? self.state()["referenceAtOrigin"] as? Bool)==true}
        let frame=node("checkbox-native-reference-parent").frame
        XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(frame),Double(scale)))
        XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(node("checkbox-native-parent").frame),Double(scale)))
        let referenceShot=XCUIScreen.main.screenshot(),referenceImage=try XCTUnwrap(referenceShot.image.cgImage),expected=try pixels(referenceImage,frame,window,scale)
        let attachment=XCTAttachment(screenshot:referenceShot);attachment.name="checkbox-"+name+"-matched-reference";attachment.lifetime = .keepAlways;add(attachment)
        tap("Show Checkbox component");wait("Original Checkbox visible again"){(try? self.state()["referenceAtOrigin"] as? Bool)==false}
        XCTAssertEqual(try state()["rootTag"] as? NSNumber,row["rootTag"] as? NSNumber)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let exact=circularPixelsMatch(actual,expected)
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"matchedReferenceParent":rect(frame),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeValue":root?.value ?? NSNull(),"nativeCheckbox":(root?.value as? String)?.hasPrefix("checkbox, ") ?? false,"nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"heldContactIntervals":heldIntervals,"targetCount":all.filter{$0.identifier=="checkbox-native-target"}.count,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"inkPixels":ink,"scale":Double(scale),"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,observed,shot);XCTAssertTrue(exact,"Checkbox differs from independent raw native reference at the same physical position")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);return}
        let event=try XCTUnwrap((row["layouts"] as? [[String:Any]])?.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw)
        XCTAssertEqual(target.label,"Keep settings");XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false));XCTAssertTrue(checkboxNativeValueMatches(target.value,row["selected"] as? Bool==true,row["mixed"] as? Bool==true))
        for (actual,expected) in zip([target.frame.minX-parent.minX,target.frame.minY-parent.minY,target.frame.width,target.frame.height],[nativeReference.frame.minX-reference.minX,nativeReference.frame.minY-reference.minY,nativeReference.frame.width,nativeReference.frame.height]){XCTAssertEqual(actual,expected,accuracy:1/scale)}
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        if let width=row["rootWidth"] as? NSNumber {XCTAssertEqual(target.frame.width,width.doubleValue,accuracy:1/scale)}
        if row["small"] as? Bool==true {XCTAssertEqual(target.frame.height,24,accuracy:1/scale)}else{XCTAssertGreaterThanOrEqual(target.frame.height,44-1/scale)}
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan(target.frame.height,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    func testCheckboxActionsAndLifetimes() throws {
        tap("Checkbox behavior checks");var original=0.0
        for name in behavior {
            wait("Current Checkbox case "+name){(try? self.state()["case"] as? String)==name};if name != "retired" {ready()};try capture(name)
            if name=="baseline" {original=try number(state(),"rootTag");for count in 1...2 {let target=node("checkbox-native-target");reveal(target);target.tap();wait("Native vetoed Checkbox request"){((try? self.state()["actions"] as? NSNumber)?.intValue ?? 0)==count};XCTAssertEqual(try state()["selected"] as? Bool,false);try capture("vetoed-"+String(count))}}
            if ["echo","restored","local","mixed","group-veto","group-echo"].contains(name) {
                let count=["restored","mixed","group-veto","group-echo"].contains(name) ? 1:2
                for index in 0..<count {let before=try number(state(),"actions"),selected=try state()["selected"] as? Bool==true,target=node("checkbox-native-target");reveal(target);target.tap();wait("Original native Checkbox activation"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1};XCTAssertEqual(try state()["selected"] as? Bool,name=="group-veto" ? selected:!selected);try capture(name+"-activated-"+String(index))}
            }
            if ["echo","disabled","readonly","held-disabled","restored","renderer"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if ["disabled","readonly","held-disabled","group-disabled","group-readonly"].contains(name) {
                let before=try number(state(),"actions"),target=node("checkbox-native-target");reveal(target);let began=Date().timeIntervalSince1970*1000;target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:name=="held-disabled" ? 1:0)
                Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)
                if name=="held-disabled" {let ended=Date().timeIntervalSince1970*1000,current=try state(),events=try XCTUnwrap(current["events"] as? [[String:Any]]),entry=try XCTUnwrap(events.last{$0["phase"] as? String=="in"});let epoch=try number(entry,"epochMs");XCTAssertGreaterThanOrEqual(epoch,began);XCTAssertLessThan(epoch,ended-400);heldIntervals.append(["beganEpochMs":began,"endedEpochMs":ended,"disabledOnPressInEpochMs":epoch]);XCTAssertEqual(current["canceled"] as? Bool,true);try capture("held-canceled")}
            }
            if name=="replaced" || name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="retired" {let before=try number(state(),"actions");Thread.sleep(forTimeInterval:0.5);XCTAssertEqual(try number(state(),"actions"),before)}
            if name=="local-default-changed" {XCTAssertEqual(try state()["selected"] as? Bool,false)}
            if name != behavior.last {tap("Next Checkbox check")}
        }
        let row=try state(),presses=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(presses.count,10);XCTAssertTrue(presses.prefix(5).allSatisfy{($0["currentTarget"] as? NSNumber)?.doubleValue==original && (($0["target"] as? NSNumber)?.doubleValue ?? 0)>0})
        let expectedRequests:[Bool]=[true,true,true,false,true,false,true,true,true,false]
        let standalonePhases:[String]=(0..<6).flatMap{_ in ["change","press"]}
        let groupedPhases:[String]=["group","change","press","group","change","press"]
        let localPhases:[String]=(0..<2).flatMap{_ in ["change","press"]}
        XCTAssertEqual(row["requests"] as? [Bool],expectedRequests);XCTAssertEqual(row["phases"] as? [String],standalonePhases+groupedPhases+localPhases)
    }
    func testCheckboxStylesAndConstraints() throws {
        tap("Checkbox styles checks")
        for name in styles {
            wait("Current Checkbox style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last {tap("Next Checkbox check")}
        }
    }
    private func motion(_ name:String,reduced:Bool) throws {
        revealRegion(node("checkbox-native-pair"),app.buttons["Arm Checkbox motion and retirement"].firstMatch);ready();let before=try state(),window=app.windows.firstMatch.frame,parent=node("checkbox-native-parent").frame,reference=node("checkbox-native-reference-parent").frame,root=node("checkbox-native-target").frame,raw=node("checkbox-native-reference").frame,arm=app.buttons["Arm Checkbox motion and retirement"].firstMatch
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));arm.tap();var samples:[[String:Any]]=[];let until=Date().timeIntervalSince1970+16.4
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),line=CGRect(x:root.minX+3,y:root.midY-7,width:1/scale,height:1/scale),rawLine=CGRect(x:raw.minX+3,y:raw.midY-7,width:1/scale,height:1/scale),track=try pixels(image,line,window,scale),rawTrack=try pixels(image,rawLine,window,scale)
            let glyphFrame=CGRect(x:root.minX+2,y:root.midY-8,width:16,height:16),rawGlyphFrame=CGRect(x:raw.minX+2,y:raw.midY-8,width:16,height:16),glyph=try pixels(image,glyphFrame,window,scale),rawGlyph=try pixels(image,rawGlyphFrame,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
            var referenceInk=0;for i in stride(from:0,to:expected.count,by:4){if expected[i] != 255 || expected[i+1] != 255 || expected[i+2] != 255{referenceInk+=1}}
            let sampleRGBA:[Int]=ink==0 ? []:track.map{Int($0)}
            let referenceRGBA:[Int]=referenceInk==0 ? []:rawTrack.map{Int($0)}
            let glyphPixels:Int=ink==0 ? 0:checkboxWhitePixels(glyph)
            let referenceGlyphPixels:Int=referenceInk==0 ? 0:checkboxWhitePixels(rawGlyph)
            var row:[String:Any]=["name":name+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000]
            row["parent"]=rect(parent);row["referenceParent"]=rect(reference)
            row["sampleFrame"]=rect(line);row["referenceSampleFrame"]=rect(rawLine)
            row["glyphFrame"]=rect(glyphFrame);row["referenceGlyphFrame"]=rect(rawGlyphFrame)
            row["referenceExact"]=circularPixelsMatch(actual,expected)
            row["sampleRGBA"]=sampleRGBA;row["referenceSampleRGBA"]=referenceRGBA
            row["glyphPixels"]=glyphPixels;row["referenceGlyphPixels"]=referenceGlyphPixels
            row["inkPixels"]=ink;row["referenceInkPixels"]=referenceInk
            row["scale"]=Double(scale);row["imageWidth"]=image.width;row["imageHeight"]=image.height
            samples.append(row);try mark(name+"-"+String(samples.count),row,shot,prefix:"CHECKBOX_NATIVE_MOTION_FRAME");Thread.sleep(forTimeInterval:0.10)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),trace=try XCTUnwrap(after["motionTrace"] as? [[String:Any]]),retired=try XCTUnwrap(trace.first{$0["name"] as? String=="retire"})
        let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=(trace[0]["epochMs"] as? Double ?? .infinity) && ($0["captureEpochMs"] as? Double ?? .infinity)<(retired["epochMs"] as? Double ?? 0)}
        let result:[String:Any]=["name":name,"reduced":reduced,"originalRootTag":try number(before,"rootTag"),"movingRows":moving.count,"state":after,"samples":samples];FileHandle.standardOutput.write(Data("CHECKBOX_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
        XCTAssertEqual(trace.compactMap{$0["name"] as? String},["select","interrupt","retarget"]+(3...31).map{"retarget-"+String($0)}+["settle","retire","fresh"]);XCTAssertGreaterThan(moving.count,1)
        if reduced {XCTAssertTrue(moving.allSatisfy{$0["referenceExact"] as? Bool==true})}else{
            let colors=samples.compactMap{$0["referenceSampleRGBA"] as? [Int]}.filter{$0.count==4};let from=try XCTUnwrap(colors.first),to=try XCTUnwrap(colors.first{$0 != from});XCTAssertTrue(moving.contains{row in guard let rgba=row["sampleRGBA"] as? [Int] else{return false};return checkboxColorIntermediate(rgba,from,to)},"Real interrupted175ms shape color")
            XCTAssertTrue(checkboxGlyphCoverage(moving,samples),"Real interrupted250ms glyph reveal/reversal, excluding the white background")
        }
        let settled=try XCTUnwrap(trace.first{$0["name"] as? String=="settle"}),fresh=try XCTUnwrap(trace.first{$0["name"] as? String=="fresh"})
        XCTAssertTrue(checkboxEndpointCoverage(samples,try number(settled,"epochMs"),try number(retired,"epochMs"),try number(fresh,"epochMs")),"Separate complete settled and fresh native endpoints")
        XCTAssertTrue(checkboxRetirementCoverage(samples,try number(retired,"epochMs"),try number(fresh,"epochMs")),"No component paint/work after confirmed native reference removal")
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Actual retired paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));ready()
        let snapshot=try app.snapshot();XCTAssertTrue(snapshot.children.count>0)
    }
    func testCheckboxMotionAndRetirement() throws {
        tap("Checkbox motion checks");let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionCheckbox(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionCheckbox(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();reveal(node("checkbox-native-state"));wait("Real normal-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try motion("normal",reduced:false)
        setMotion(motionCheckbox(settings),"1");app.activate();reveal(node("checkbox-native-state"));wait("Real reduced-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try motion("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func revealRegion(_ first:XCUIElement,_ second:XCUIElement) {
        XCTAssertTrue(first.waitForExistence(timeout:nativeWorkRemaining()));XCTAssertTrue(second.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2),frame=first.frame.union(second.frame)
            if !frame.isEmpty && viewport.contains(frame){return}
            guard let distance=galleryScrollFraction(Double(frame.minY),Double(frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Checkbox canvas and its control cannot fit the actual viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Checkbox canvas/control unreachable")
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Checkbox target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("SWITCH_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable Checkbox control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected Checkbox scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func motionCheckbox(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-checkbox-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}



private func checkboxGroupMemberTag(_ value:Any?,_ id:String)->NSNumber? {
    guard let map=value as? [String:Any],let tag=map[id] as? NSNumber,tag.doubleValue.isFinite,tag.doubleValue>0 else{return nil}
    return tag
}

private func checkboxGroupMembersMatch(_ rows:[[String:Any]],_ expected:[String:Bool],_ labels:[String:String],_ disabled:Bool,_ scale:Double)->Bool {
    guard scale.isFinite && scale>0,rows.count==expected.count else{return false}
    var seen=Set<String>()
    for row in rows {
        guard let id=row["id"] as? String,seen.insert(id).inserted,let selected=expected[id],
              row["label"] as? String==labels[id],row["enabled"] as? Bool == !(disabled && id != "nested"),
              checkboxNativeValueMatches(row["value"],selected,false),
              let frame=row["relativeFrame"] as? [Double],let reference=row["referenceRelativeFrame"] as? [Double],
              frame.count==4,frame[2]>0,frame[3]>=44-1/scale,toggleButtonMatchedFrame(frame,reference,scale) else{return false}
    }
    return seen==Set(expected.keys)
}


final class CheckboxGroupTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private let behavior=["baseline","echo","disabled","readonly","renderer","nested","replacement","retired","fresh","local","default-changed"]
    private let styles=["style-baseline","horizontal","wrap","custom","final","registered","fractional","percentage","long-narrow","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Basic controls scene");tap("Light theme");tap("Live window");tap("Prepare CheckboxGroup checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="cgroup-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="cgroup-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("cgroup-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual CheckboxGroup root/ref/layout") {guard let row=try? self.state(),let event=(row["layouts"] as? [[String:Any]])?.last,let tag=row["rootTag"] as? NSNumber else{return false};return tag.doubleValue>0 && tag == event["currentTarget"] as? NSNumber}}
    private func capture(_ name:String) throws {
        revealRegion(node("cgroup-native-pair"),app.buttons["Show CheckboxGroup reference"].firstMatch)
        let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("cgroup-native-state")).label.utf8)) as? [String:Any])
        let window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("cgroup-native-parent")).frame,reference=try XCTUnwrap(one("cgroup-native-reference-parent")).frame
        let root=one("cgroup-native-root"),raw=one("cgroup-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        tap("Show CheckboxGroup reference");wait("Native reference at matched origin"){(try? self.state()["referenceAtOrigin"] as? Bool)==true}
        let frame=node("cgroup-native-reference-parent").frame;XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(frame),Double(scale)))
        let referenceShot=XCUIScreen.main.screenshot(),expected=try pixels(try XCTUnwrap(referenceShot.image.cgImage),frame,window,scale)
        let matched=XCTAttachment(screenshot:referenceShot);matched.name="cgroup-"+name+"-matched-reference";matched.lifetime = .keepAlways;add(matched)
        tap("Show CheckboxGroup component");wait("Original CheckboxGroup shown again"){(try? self.state()["referenceAtOrigin"] as? Bool)==false}
        XCTAssertEqual(try state()["rootTag"] as? NSNumber,row["rootTag"] as? NSNumber)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        var members:[[String:Any]]=[]
        let ids=(row["nested"] as? Bool==true) ? ["alpha","nested","loose"]:["alpha","beta"]
        for id in ids {
            guard let target=one("cgroup-native-"+id),let item=one("cgroup-reference-"+id) else{continue}
            members.append(["id":id,"label":target.label,"value":target.value ?? NSNull(),"enabled":target.isEnabled,"relativeFrame":[Double(target.frame.minX-parent.minX),Double(target.frame.minY-parent.minY),Double(target.frame.width),Double(target.frame.height)],"referenceRelativeFrame":[Double(item.frame.minX-reference.minX),Double(item.frame.minY-reference.minY),Double(item.frame.width),Double(item.frame.height)]])
        }
        let exact=circularPixelsMatch(actual,expected)
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"matchedReferenceParent":rect(frame),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeRootLabel":root?.label ?? "","nativeRootType":root.map{Int($0.elementType.rawValue)} ?? -1,"members":members,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"inkPixels":ink,"scale":Double(scale),"imageWidth":image.width,"imageHeight":image.height]
        let data=try JSONSerialization.data(withJSONObject:observed,options:.sortedKeys);FileHandle.standardOutput.write(Data("CHECKBOX_GROUP_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="cgroup-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment)
        let png=XCTAttachment(screenshot:shot);png.name="cgroup-"+name;png.lifetime = .keepAlways;add(png)
        XCTAssertTrue(exact,"CheckboxGroup differs from independent raw native reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);XCTAssertTrue(members.isEmpty);return}
        let event=try XCTUnwrap((row["layouts"] as? [[String:Any]])?.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {
            XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0)
            for element in [root,raw].compactMap({$0}){XCTAssertEqual(element.frame.width,0);XCTAssertEqual(element.frame.height,0)}
            return
        }
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw)
        XCTAssertTrue(toggleButtonMatchedFrame([Double(target.frame.minX-parent.minX),Double(target.frame.minY-parent.minY),Double(target.frame.width),Double(target.frame.height)],[Double(nativeReference.frame.minX-reference.minX),Double(nativeReference.frame.minY-reference.minY),Double(nativeReference.frame.width),Double(nativeReference.frame.height)],Double(scale)))
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        let selected=try XCTUnwrap(row["value"] as? [String]);var states:[String:Bool]=["alpha":selected.contains("alpha"),"beta":selected.contains("beta")]
        if row["nested"] as? Bool==true {states=["alpha":selected.contains("alpha"),"nested":(row["nestedValue"] as? [String])?.contains("nested")==true,"loose":row["looseValue"] as? Bool==true]}
        let labels=try XCTUnwrap(row["labels"] as? [String:String]);XCTAssertTrue(checkboxGroupMembersMatch(members,states,labels,row["disabled"] as? Bool==true,Double(scale)))
        XCTAssertEqual(all.filter{($0.value as? String)?.hasPrefix("checkbox, ")==true}.count,ids.count,"Only members own checkbox targets")
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan((members.first?["relativeFrame"] as? [Double])?[3] ?? 0,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    private func activate(_ id:String,_ name:String) throws {
        let before=try XCTUnwrap(state()["phases"] as? [String]).count,tag=try XCTUnwrap(checkboxGroupMemberTag(try state()["memberTags"],id)),target=node("cgroup-native-"+id);reveal(target);target.tap()
        wait("Actual native grouped member callback"){((try? self.state()["phases"] as? [String]) ?? []).count>before};let event=try XCTUnwrap((state()["events"] as? [[String:Any]])?.last);XCTAssertEqual(event["currentTarget"] as? NSNumber,tag);XCTAssertGreaterThan(try number(event,"target"),0);try capture(name)
    }
    func testCheckboxGroupActionsAndLifetimes() throws {
        tap("CheckboxGroup behavior checks");var original=0.0
        for name in behavior {
            wait("Current CheckboxGroup case "+name){(try? self.state()["case"] as? String)==name};if name != "retired"{ready()};try capture(name)
            if name=="baseline" {original=try number(state(),"rootTag");try activate("alpha","veto-1");try activate("alpha","veto-2");XCTAssertEqual(try state()["value"] as? [String],[])}
            if name=="echo" {try activate("beta","echo-beta");try activate("alpha","echo-alpha");try activate("beta","echo-remove-beta");XCTAssertEqual(try state()["value"] as? [String],["alpha"])}
            if ["disabled","readonly"].contains(name) {let before=try XCTUnwrap(state()["phases"] as? [String]);for id in ["alpha","beta"]{let target=node("cgroup-native-"+id);reveal(target);target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap();Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try state()["phases"] as? [String],before)}}
            if ["echo","disabled","readonly","renderer","nested"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if name=="nested" {let before=try state()["requests"] as? [[String]];try activate("nested","nested-changed");try activate("loose","loose-changed");XCTAssertEqual(try state()["requests"] as? [[String]],before);XCTAssertEqual(try state()["nestedValue"] as? [String],[]);XCTAssertEqual(try state()["looseValue"] as? Bool,false)}
            if ["replacement","fresh"].contains(name){XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="local" {try activate("beta","local-remove-beta");try activate("alpha","local-add-alpha")}
            if name=="default-changed" {XCTAssertEqual(try state()["value"] as? [String],["alpha"])}
            if name != behavior.last {tap("Next CheckboxGroup check")}
        }
        let row=try state();XCTAssertEqual(row["requests"] as? [[String]],[["alpha"],["alpha"],["beta"],["beta","alpha"],["alpha"],[],["alpha"]])
        let ids=["alpha","alpha","beta","alpha","beta"];let before=ids.flatMap{["group:root","member:"+$0,"press:"+$0]}
        let isolated=["nested:nested","member:nested","press:nested","member:loose","press:loose"]
        let local=["beta","alpha"].flatMap{["group:root","member:"+$0,"press:"+$0]};XCTAssertEqual(row["phases"] as? [String],before+isolated+local)
        let events=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(events.count,9);XCTAssertTrue(events.allSatisfy{(($0["target"] as? NSNumber)?.doubleValue ?? 0)>0 && (($0["currentTarget"] as? NSNumber)?.doubleValue ?? 0)>0})
    }
    func testCheckboxGroupStylesAndConstraints() throws {
        tap("CheckboxGroup styles checks")
        for name in styles {
            wait("Current CheckboxGroup style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark"{tap("Dark theme");wait("Current dark group provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored"{tap("Light theme");wait("Restored light group provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last{tap("Next CheckboxGroup check")}
        }
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func revealRegion(_ first:XCUIElement,_ second:XCUIElement) {
        XCTAssertTrue(first.waitForExistence(timeout:nativeWorkRemaining()));XCTAssertTrue(second.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2),frame=first.frame.union(second.frame)
            if !frame.isEmpty && viewport.contains(frame){return}
            guard let distance=galleryScrollFraction(Double(frame.minY),Double(frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("CheckboxGroup canvas and its control cannot fit the actual viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("CheckboxGroup canvas/control unreachable")
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("CheckboxGroup target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("SWITCH_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable CheckboxGroup control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected CheckboxGroup scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
}

private func radioGroupMembersMatch(_ rows:[[String:Any]],_ expected:[String:Bool],_ labels:[String:String],_ disabled:Bool,_ scale:Double)->Bool {
    guard scale.isFinite && scale>0,rows.count==expected.count else{return false}
    var seen=Set<String>()
    for row in rows {
        guard let id=row["id"] as? String,seen.insert(id).inserted,let selected=expected[id],
              row["label"] as? String==labels[id],row["enabled"] as? Bool == !(disabled && id != "nested" && id != "other"),
              let nativeValue=row["value"] as? String,listItemValueMatches(nativeValue,selected),
              let frame=row["relativeFrame"] as? [Double],let reference=row["referenceRelativeFrame"] as? [Double],
              frame.count==4,frame[2]>0,frame[3]>=44-1/scale,toggleButtonMatchedFrame(frame,reference,scale) else{return false}
    }
    return seen==Set(expected.keys)
}
final class RadioGroupTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private let behavior=["baseline","echo","reselected","disabled","readonly","renderer","nested","replacement","retired","fresh","local","default-changed","empty-value"]
    private let styles=["style-baseline","horizontal","wrap","custom","final-style","registered","fractional","percentage","long-narrow","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Basic controls scene");tap("Light theme");tap("Live window");tap("Prepare RadioGroup checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="rgroup-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="rgroup-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("rgroup-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual RadioGroup root/ref/layout") {guard let row=try? self.state(),let event=(row["layouts"] as? [[String:Any]])?.last,let tag=row["rootTag"] as? NSNumber else{return false};return tag.doubleValue>0 && tag == event["currentTarget"] as? NSNumber}}
    private func capture(_ name:String) throws {
        revealRegion(node("rgroup-native-pair"),app.buttons["Show RadioGroup reference"].firstMatch)
        let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("rgroup-native-state")).label.utf8)) as? [String:Any])
        let window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("rgroup-native-parent")).frame,reference=try XCTUnwrap(one("rgroup-native-reference-parent")).frame
        let root=one("rgroup-native-root"),raw=one("rgroup-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        tap("Show RadioGroup reference");wait("Native reference at matched origin"){(try? self.state()["referenceAtOrigin"] as? Bool)==true}
        let frame=node("rgroup-native-reference-parent").frame;XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(frame),Double(scale)))
        let referenceShot=XCUIScreen.main.screenshot(),expected=try pixels(try XCTUnwrap(referenceShot.image.cgImage),frame,window,scale)
        let matched=XCTAttachment(screenshot:referenceShot);matched.name="rgroup-"+name+"-matched-reference";matched.lifetime = .keepAlways;add(matched)
        tap("Show RadioGroup component");wait("Original RadioGroup shown again"){(try? self.state()["referenceAtOrigin"] as? Bool)==false}
        XCTAssertEqual(try state()["rootTag"] as? NSNumber,row["rootTag"] as? NSNumber)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        var members:[[String:Any]]=[]
        let ids=(row["nested"] as? Bool==true) ? ["alpha","nested","other"]:["alpha","beta"]
        for id in ids {
            guard let target=one("rgroup-native-"+id),let item=one("rgroup-reference-"+id) else{continue}
            members.append(["id":id,"label":target.label,"value":target.value ?? NSNull(),"enabled":target.isEnabled,"relativeFrame":[Double(target.frame.minX-parent.minX),Double(target.frame.minY-parent.minY),Double(target.frame.width),Double(target.frame.height)],"referenceRelativeFrame":[Double(item.frame.minX-reference.minX),Double(item.frame.minY-reference.minY),Double(item.frame.width),Double(item.frame.height)]])
        }
        let exact=circularPixelsMatch(actual,expected)
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"matchedReferenceParent":rect(frame),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeRootLabel":root?.label ?? "","nativeRootValue":root?.value ?? NSNull(),"nativeRootEnabled":root?.isEnabled ?? false,"nativeRootType":root.map{Int($0.elementType.rawValue)} ?? -1,"members":members,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"inkPixels":ink,"scale":Double(scale),"imageWidth":image.width,"imageHeight":image.height]
        let data=try JSONSerialization.data(withJSONObject:observed,options:.sortedKeys);FileHandle.standardOutput.write(Data("RADIO_GROUP_NATIVE_OBSERVATION ".utf8)+data+Data("\n".utf8))
        let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="rgroup-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment)
        let png=XCTAttachment(screenshot:shot);png.name="rgroup-"+name;png.lifetime = .keepAlways;add(png)
        XCTAssertTrue(exact,"RadioGroup differs from independent raw native reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);XCTAssertTrue(members.isEmpty);return}
        let event=try XCTUnwrap((row["layouts"] as? [[String:Any]])?.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {
            XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0)
            for element in [root,raw].compactMap({$0}){XCTAssertEqual(element.frame.width,0);XCTAssertEqual(element.frame.height,0)}
            return
        }
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw)
        XCTAssertTrue(toggleButtonMatchedFrame([Double(target.frame.minX-parent.minX),Double(target.frame.minY-parent.minY),Double(target.frame.width),Double(target.frame.height)],[Double(nativeReference.frame.minX-reference.minX),Double(nativeReference.frame.minY-reference.minY),Double(nativeReference.frame.width),Double(nativeReference.frame.height)],Double(scale)))
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        let selected=row["value"] as? String,values=try XCTUnwrap(row["values"] as? [String:String])
        var states:[String:Bool]=["alpha":selected != nil && selected==values["alpha"],"beta":selected=="beta"]
        if row["nested"] as? Bool==true {states=["alpha":selected != nil && selected==values["alpha"],"nested":row["nestedValue"] as? String=="nested","other":row["nestedValue"] as? String=="other"]}
        let labels=try XCTUnwrap(row["labels"] as? [String:String]);XCTAssertTrue(radioGroupMembersMatch(members,states,labels,row["disabled"] as? Bool==true,Double(scale)))
        XCTAssertEqual(all.filter{($0.value as? String)?.hasPrefix("radio button, ")==true}.count,ids.count,"Only members own checkbox targets")
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan((members.first?["relativeFrame"] as? [Double])?[3] ?? 0,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    private func activate(_ id:String,_ name:String) throws {
        let before=try XCTUnwrap(state()["phases"] as? [String]).count,tag=try XCTUnwrap(checkboxGroupMemberTag(try state()["memberTags"],id)),target=node("rgroup-native-"+id);reveal(target);target.tap()
        wait("Actual native radio group callback"){((try? self.state()["phases"] as? [String]) ?? []).count>before};let event=try XCTUnwrap((state()["events"] as? [[String:Any]])?.last);XCTAssertEqual(event["currentTarget"] as? NSNumber,tag);XCTAssertGreaterThan(try number(event,"target"),0);try capture(name)
    }
    func testRadioGroupActionsAndLifetimes() throws {
        tap("RadioGroup behavior checks");var original=0.0
        for name in behavior {
            wait("Current RadioGroup case "+name){(try? self.state()["case"] as? String)==name};if name != "retired"{ready()};try capture(name)
            if name=="baseline" {original=try number(state(),"rootTag");try activate("alpha","veto-1");try activate("alpha","veto-2");XCTAssertTrue(try state()["value"] is NSNull)}
            if name=="echo" {try activate("beta","echo-beta");try activate("alpha","echo-alpha");XCTAssertEqual(try state()["value"] as? String,"alpha")}
            if name=="reselected" {let before=try state()["requests"] as? [String];try activate("alpha","reselected-alpha");XCTAssertEqual(try state()["requests"] as? [String],before)}
            if ["disabled","readonly"].contains(name) {let before=try XCTUnwrap(state()["phases"] as? [String]);for id in ["alpha","beta"]{let target=node("rgroup-native-"+id);reveal(target);target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).tap();Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try state()["phases"] as? [String],before)}}
            if ["echo","reselected","disabled","readonly","renderer","nested"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if name=="nested" {let before=try state()["requests"] as? [String];try activate("other","nested-other");XCTAssertEqual(try state()["requests"] as? [String],before);XCTAssertEqual(try state()["nestedValue"] as? String,"other");XCTAssertEqual(try state()["value"] as? String,"alpha")}
            if ["replacement","fresh"].contains(name){XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name=="local" {try activate("alpha","local-alpha")}
            if name=="default-changed" {XCTAssertEqual(try state()["value"] as? String,"alpha")}
            if name=="empty-value" {try activate("alpha","empty-selected");XCTAssertEqual(try state()["value"] as? String,"");let before=try state()["requests"] as? [String];try activate("alpha","empty-reselected");XCTAssertEqual(try state()["requests"] as? [String],before)}
            if name != behavior.last {tap("Next RadioGroup check")}
        }
        let row=try state();XCTAssertEqual(row["requests"] as? [String],["alpha","alpha","beta","alpha","alpha",""])
        let expected=["group:root","press:alpha","group:root","press:alpha","group:root","press:beta","group:root","press:alpha","press:alpha","nested:other","press:other","group:root","press:alpha","group:root","press:alpha","press:alpha"]
        XCTAssertEqual(row["phases"] as? [String],expected);let events=try XCTUnwrap(row["events"] as? [[String:Any]]).filter{$0["phase"] as? String=="press"};XCTAssertEqual(events.count,9);XCTAssertTrue(events.allSatisfy{(($0["target"] as? NSNumber)?.doubleValue ?? 0)>0 && (($0["currentTarget"] as? NSNumber)?.doubleValue ?? 0)>0})
    }
    func testRadioGroupStylesAndConstraints() throws {
        tap("RadioGroup styles checks")
        for name in styles {
            wait("Current RadioGroup style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark"{tap("Dark theme");wait("Current dark group provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored"{tap("Light theme");wait("Restored light group provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last{tap("Next RadioGroup check")}
        }
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func revealRegion(_ first:XCUIElement,_ second:XCUIElement) {
        XCTAssertTrue(first.waitForExistence(timeout:nativeWorkRemaining()));XCTAssertTrue(second.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2),frame=first.frame.union(second.frame)
            if !frame.isEmpty && viewport.contains(frame){return}
            guard let distance=galleryScrollFraction(Double(frame.minY),Double(frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("RadioGroup canvas and its control cannot fit the actual viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("RadioGroup canvas/control unreachable")
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("RadioGroup target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("SWITCH_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable RadioGroup control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected RadioGroup scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
}

private func buttonShadowIntermediate(_ rgba:[Int])->Bool {
    rgba.count==4 && rgba[0]>153 && rgba[0]<255 && rgba[0]==rgba[1] && rgba[1]==rgba[2] && rgba[3]==255
}

private func buttonMotionReferenceIndex(_ rgba:[Int],_ ink:Int)->Int? {
    if rgba==[187,51,34,255] {return 0}
    if rgba==[17,119,51,255] {return 1}
    if rgba==[255,255,255,255] && ink==0 {return 0}
    return nil
}

final class ButtonTrialTests: XCTestCase {
    private var app:XCUIApplication!
    private var heldIntervals:[[String:Double]]=[]
    private let behavior=["baseline","repeated","disabled","held-disabled","restored","pending","held-pending","pending-restored","renderer","replaced","retired","fresh","focus-excluded","long-press"]
    private let styles=["style-baseline","flat","outline","primary","secondary","transparent","root-custom","final-style","foreground","explicit-child","square","round","long-narrow","fractional","percentage","auto","small-target","zero","dark","light-restored"]
    override func setUpWithError() throws {
        continueAfterFailure=false;app=XCUIApplication(bundleIdentifier:"dev.codonui.showcase");app.launch();XCTAssertEqual(app.state,.runningForeground);XCUIDevice.shared.orientation = .portrait
        tap("Reset scene");tap("Basic controls scene");tap("Light theme");tap("Live window");tap("Prepare standalone Button checks")
    }
    override func tearDownWithError() throws {
        let png=XCTAttachment(screenshot:XCUIScreen.main.screenshot());png.name="button-final";png.lifetime = .keepAlways;add(png)
        let tree=XCTAttachment(string:app.debugDescription);tree.name="button-final-hierarchy";tree.lifetime = .keepAlways;add(tree)
    }
    private func state() throws->[String:Any] {try XCTUnwrap(JSONSerialization.jsonObject(with:Data(node("button-native-state").label.utf8)) as? [String:Any])}
    private func number(_ row:[String:Any],_ key:String)throws->Double {let value=try XCTUnwrap(row[key] as? NSNumber,key).doubleValue;XCTAssertTrue(value.isFinite);return value}
    private func rect(_ value:CGRect)->[Double] {[value.minX,value.minY,value.width,value.height].map(Double.init)}
    private func ready() {wait("Actual current Button root/ref/layout") {guard let row=try? self.state(),let events=row["layouts"] as? [[String:Any]],let event=events.last else{return false};return (row["rootTag"] as? NSNumber)?.doubleValue == (event["currentTarget"] as? NSNumber)?.doubleValue}}
    private func mark(_ name:String,_ row:[String:Any],_ shot:XCUIScreenshot,prefix:String="BUTTON_NATIVE_OBSERVATION") throws {
        let data=try JSONSerialization.data(withJSONObject:row,options:.sortedKeys);FileHandle.standardOutput.write(Data((prefix+" ").utf8)+data+Data("\n".utf8));let attachment=XCTAttachment(data:data,uniformTypeIdentifier:"public.json");attachment.name="button-"+name+"-receipt";attachment.lifetime = .keepAlways;add(attachment);let png=XCTAttachment(screenshot:shot);png.name="button-"+name;png.lifetime = .keepAlways;add(png)
    }
    private func capture(_ name:String) throws {
        reveal(node("button-native-pair"));let snapshot=try app.snapshot();var all:[XCUIElementSnapshot]=[]
        func visit(_ value:XCUIElementSnapshot){all.append(value);for child in value.children{visit(child)}};visit(snapshot)
        func one(_ id:String)->XCUIElementSnapshot? {let values=all.filter{$0.identifier==id};XCTAssertLessThanOrEqual(values.count,1,id);return values.first}
        let row=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(try XCTUnwrap(one("button-native-state")).label.utf8)) as? [String:Any]),window=try XCTUnwrap(all.first{$0.elementType == .window}).frame,parent=try XCTUnwrap(one("button-native-parent")).frame,reference=try XCTUnwrap(one("button-native-reference-parent")).frame,root=one("button-native-target"),raw=one("button-native-reference"),shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width
        XCTAssertEqual(shot.image.imageOrientation,.up);XCTAssertEqual(scale,CGFloat(image.height)/window.height,accuracy:0.01)
        let actual=try pixels(image,parent,window,scale),separated=try pixels(image,reference,window,scale)
        var expected=separated,matchedReferenceParent:[Double]=[]
        if row["hasShadow"] as? Bool==true {
            let control=app.buttons[row["mode"] as? String=="motion" ? "Reference" : "Match raised reference position"].firstMatch;XCTAssertTrue(control.isHittable && window.contains(control.frame));control.tap()
            wait("Reference uses original physical origin"){(try? self.state()["referenceAtOrigin"] as? Bool)==true}
            let frame=node("button-native-reference-parent").frame,referenceShot=XCUIScreen.main.screenshot(),referenceImage=try XCTUnwrap(referenceShot.image.cgImage)
            XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(frame),Double(scale)),"Shadow reference must use the same physical origin and dimensions")
            XCTAssertEqual(referenceImage.width,image.width);XCTAssertEqual(referenceImage.height,image.height)
            expected=try pixels(referenceImage,frame,window,scale);matchedReferenceParent=rect(frame)
            let attachment=XCTAttachment(screenshot:referenceShot);attachment.name="button-"+name+"-matched-reference";attachment.lifetime = .keepAlways;add(attachment)
        }
        let exact=circularPixelsMatch(actual,expected)
        var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
        let observed:[String:Any]=["name":name,"state":row,"parent":rect(parent),"referenceParent":rect(reference),"root":root.map{rect($0.frame)} ?? [],"referenceRoot":raw.map{rect($0.frame)} ?? [],"nativeLabel":root?.label ?? "","nativeValue":root?.value ?? NSNull(),"nativeButton":root?.elementType == .button,"nativeType":root.map{Int($0.elementType.rawValue)} ?? -1,"nativeEnabled":root?.isEnabled ?? false,"heldContactIntervals":heldIntervals,"targetCount":all.filter{$0.identifier=="button-native-target"}.count,"referenceExact":exact,"separatedReferenceExact":circularPixelsMatch(actual,separated),"rawReferencePositionDiffers":!circularPixelsMatch(separated,expected),"matchedReferenceParent":matchedReferenceParent,"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height]
        try mark(name,observed,shot);XCTAssertEqual(parent.size,reference.size);XCTAssertEqual(parent.height,224);XCTAssertTrue(exact,"Button paint differs from independent core-native reference")
        if row["visible"] as? Bool==false {XCTAssertNil(root);XCTAssertTrue(row["rootTag"] is NSNull);XCTAssertEqual(ink,0);return}
        let events=try XCTUnwrap(row["layouts"] as? [[String:Any]]),event=try XCTUnwrap(events.last),layout=try XCTUnwrap(event["layout"] as? [String:Any]),tag=try number(row,"rootTag")
        XCTAssertGreaterThan(tag,0);XCTAssertEqual(try number(event,"target"),tag);XCTAssertEqual(try number(event,"currentTarget"),tag)
        if row["zero"] as? Bool==true {XCTAssertEqual(try number(layout,"width"),0);XCTAssertEqual(try number(layout,"height"),0);XCTAssertEqual(ink,0);return}
        let target=try XCTUnwrap(root),nativeReference=try XCTUnwrap(raw);XCTAssertEqual(target.label,row["label"] as? String);XCTAssertEqual(target.isEnabled,!(row["disabled"] as? Bool ?? false))
        XCTAssertEqual(target.elementType,.button)
        XCTAssertEqual(target.value as? String ?? "", row["pending"] as? Bool==true ? "busy" : "", "Original native busy metadata and restoration")
        XCTAssertEqual(target.frame.width,try number(layout,"width"),accuracy:1/scale);XCTAssertEqual(target.frame.height,try number(layout,"height"),accuracy:1/scale)
        for (actual,expected) in zip([target.frame.minX-parent.minX,target.frame.minY-parent.minY,target.frame.width,target.frame.height],[nativeReference.frame.minX-reference.minX,nativeReference.frame.minY-reference.minY,nativeReference.frame.width,nativeReference.frame.height]) {XCTAssertEqual(actual,expected,accuracy:1/scale)}
        if let width=row["width"] as? NSNumber {XCTAssertEqual(target.frame.width,width.doubleValue,accuracy:1/scale)}
        if row["small"] as? Bool==true {XCTAssertEqual(target.frame.height,24,accuracy:1/scale)}else{XCTAssertGreaterThanOrEqual(target.frame.height,44-1/scale)}
        if row["narrow"] as? Bool==true {XCTAssertGreaterThan(target.frame.height,44);XCTAssertLessThanOrEqual(target.frame.maxY,parent.maxY-12+1/scale)}
    }
    func testButtonActionsAndLifetimes() throws {
        tap("Button behavior checks");var original=0.0
        for name in behavior {
            wait("Current Button case "+name){(try? self.state()["case"] as? String)==name};if name != "retired"{ready()};try capture(name)
            if name=="baseline"{original=try number(state(),"rootTag")}
            if ["repeated","disabled","held-disabled","restored","pending","held-pending","pending-restored","renderer"].contains(name){XCTAssertEqual(try number(state(),"rootTag"),original)}
            if ["baseline","repeated","disabled","held-disabled","restored","pending","held-pending","pending-restored","renderer","long-press"].contains(name){
                let before=try number(state(),"actions"),target=node("button-native-target");reveal(target);let began=Date().timeIntervalSince1970*1000,held=name.hasPrefix("held-") || name=="long-press"
                target.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:held ? 1:0)
                let blocked=["disabled","pending","held-disabled","held-pending","long-press"].contains(name)
                if blocked{Thread.sleep(forTimeInterval:0.4);XCTAssertEqual(try number(state(),"actions"),before)}else{wait("One actual current Button action"){((try? self.state()["actions"] as? NSNumber)?.doubleValue ?? -1)==before+1}}
                if name.hasPrefix("held-"){let ended=Date().timeIntervalSince1970*1000,current=try state(),events=try XCTUnwrap(current["events"] as? [[String:Any]]),entry=try XCTUnwrap(events.last{$0["phase"] as? String=="in"}),epoch=try number(entry,"epochMs");XCTAssertGreaterThanOrEqual(epoch,began);XCTAssertLessThan(epoch,ended-400);heldIntervals.append(["beganEpochMs":began,"endedEpochMs":ended,"disabledOnPressInEpochMs":epoch]);XCTAssertEqual(current["canceled"] as? Bool,true)}
                if name=="long-press"{let events=try XCTUnwrap(state()["events"] as? [[String:Any]]);XCTAssertEqual(events.filter{$0["phase"] as? String=="long"}.count,1)}
                try capture(name+"-activated")
            }
            if name=="replaced" || name=="fresh" {XCTAssertNotEqual(try number(state(),"rootTag"),original)}
            if name != behavior.last {tap("Next Button check")}
        }
        let row=try state(),events=try XCTUnwrap(row["events"] as? [[String:Any]]),presses=events.filter{$0["phase"] as? String=="press"};XCTAssertEqual(presses.count,5);XCTAssertEqual(try number(row,"actions"),5)
        XCTAssertTrue(presses.allSatisfy{($0["currentTarget"] as? NSNumber)?.doubleValue==original && (($0["target"] as? NSNumber)?.doubleValue ?? 0)>0})
        let phases=try XCTUnwrap(row["phases"] as? [String]);XCTAssertEqual(phases.filter{$0=="start"}.count,phases.filter{$0=="end"}.count);XCTAssertEqual(phases.filter{$0=="change:true"}.count,phases.filter{$0=="change:false"}.count)
    }
    func testButtonStylesAndConstraints() throws {
        tap("Button styles checks")
        for name in styles {
            wait("Current Button style "+name){(try? self.state()["case"] as? String)==name};ready()
            if name=="dark" {tap("Dark theme");wait("Actual dark provider"){(try? self.state()["themeMode"] as? String)=="dark"}}
            if name=="light-restored" {tap("Light theme");wait("Actual light provider"){(try? self.state()["themeMode"] as? String)=="light"}}
            try capture(name);if name != styles.last {tap("Next Button check")}
        }
    }
    private func motion(_ name:String,reduced:Bool) throws {
        tap("Button motion checks");reveal(node("button-native-pair"));ready()
        var referencePaints:[[UInt8]]=[];var referenceFrames:[[Double]]=[]
        for (index,control) in ["First","Second"].enumerated() {
            tap(control);tap("Reference");reveal(node("button-native-pair"));let shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),window=app.windows.firstMatch.frame,parent=node("button-native-parent").frame,reference=node("button-native-reference-parent").frame,scale=CGFloat(image.width)/window.width
            XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),rect(reference),Double(scale)),"Motion raw reference must use component physical origin")
            referencePaints.append(try pixels(image,reference,window,scale));referenceFrames.append(rect(parent))
            try mark(name+"-reference-"+String(index),["name":name+"-reference-"+String(index),"parent":rect(parent),"referenceParent":rect(reference),"scale":scale,"imageWidth":image.width,"imageHeight":image.height],shot,prefix:"BUTTON_NATIVE_MOTION_REFERENCE")
        }
        tap("Component");reveal(node("button-native-pair"));ready();let before=try state(),window=app.windows.firstMatch.frame,parent=node("button-native-parent").frame,reference=node("button-native-reference-parent").frame,root=node("button-native-target").frame,raw=node("button-native-reference").frame,arm=app.buttons["Arm Button motion and retirement"].firstMatch
        XCTAssertTrue(arm.isHittable && window.contains(arm.frame));arm.tap();var samples:[[String:Any]]=[];let until=Date().timeIntervalSince1970+11.4
        repeat {
            let started=Date().timeIntervalSince1970*1000,shot=XCUIScreen.main.screenshot(),image=try XCTUnwrap(shot.image.cgImage),scale=CGFloat(image.width)/window.width,actual=try pixels(image,parent,window,scale),expected=try pixels(image,reference,window,scale),point=CGRect(x:root.maxX-10,y:root.minY+4,width:2,height:2),referencePoint=CGRect(x:raw.maxX-10,y:raw.minY+4,width:2,height:2),paint=try pixels(image,point,window,scale),referencePaint=try pixels(image,referencePoint,window,scale)
            let shadowPoint=CGRect(x:root.midX-1,y:root.maxY+2,width:2,height:2),rawShadowPoint=CGRect(x:raw.midX-1,y:raw.maxY+2,width:2,height:2),shadow=try pixels(image,shadowPoint,window,scale),referenceShadow=try pixels(image,rawShadowPoint,window,scale)
            var ink=0;for i in stride(from:0,to:actual.count,by:4){if actual[i] != 255 || actual[i+1] != 255 || actual[i+2] != 255{ink+=1}}
            let referenceIndex=try XCTUnwrap(buttonMotionReferenceIndex(listItemSampleRGBA(referencePaint),ink),"Native reference target or real blank retirement")
            XCTAssertTrue(toggleButtonMatchedFrame(rect(parent),referenceFrames[referenceIndex],Double(scale)),"Motion calibration origin changed")
            let row:[String:Any]=["name":name+"-"+String(samples.count),"captureStartedEpochMs":started,"captureEpochMs":Date().timeIntervalSince1970*1000,"parent":rect(parent),"referenceParent":rect(reference),"sampleFrame":rect(point),"referenceSampleFrame":rect(referencePoint),"shadowFrame":rect(shadowPoint),"referenceShadowFrame":rect(rawShadowPoint),"shadowRGBA":listItemSampleRGBA(shadow),"referenceShadowRGBA":listItemSampleRGBA(referenceShadow),"calibratedReferenceName":name+"-reference-"+String(referenceIndex),"calibratedReferenceParent":referenceFrames[referenceIndex],"calibratedReferenceExact":circularPixelsMatch(actual,referencePaints[referenceIndex]),"referenceExact":circularPixelsMatch(actual,expected),"sampleRGBA":listItemSampleRGBA(paint),"referenceSampleRGBA":listItemSampleRGBA(referencePaint),"inkPixels":ink,"scale":scale,"imageWidth":image.width,"imageHeight":image.height];samples.append(row);try mark(name+"-"+String(samples.count),row,shot,prefix:"BUTTON_NATIVE_MOTION_FRAME");Thread.sleep(forTimeInterval:0.10)
        } while Date().timeIntervalSince1970<until && nativeWorkRemaining()>0
        let after=try state(),trace=try XCTUnwrap(after["motionTrace"] as? [[String:Any]]),retired=try XCTUnwrap(trace.first{$0["name"] as? String=="retire"})
        let moving=samples.filter{($0["captureStartedEpochMs"] as? Double ?? 0)>=(trace[0]["epochMs"] as? Double ?? .infinity) && ($0["captureEpochMs"] as? Double ?? .infinity)<(retired["epochMs"] as? Double ?? 0)}
        let result:[String:Any]=["name":name,"reduced":reduced,"movingRows":moving.count,"state":after,"samples":samples];FileHandle.standardOutput.write(Data("BUTTON_NATIVE_MOTION ".utf8)+(try JSONSerialization.data(withJSONObject:result,options:.sortedKeys))+Data("\n".utf8))
        XCTAssertEqual(trace.compactMap{$0["name"] as? String},(0..<20).map{"retarget-"+String($0)}+["settle","retire","fresh"])
        XCTAssertGreaterThan(moving.count,1);if reduced{XCTAssertTrue(moving.allSatisfy{$0["calibratedReferenceExact"] as? Bool==true},"Reduced full paint matches exact same-origin native reference")}else{XCTAssertTrue(moving.contains{row in guard let rgba=row["sampleRGBA"] as? [Int] else{return false};return listItemIntermediate(rgba)},"Real interrupted background interpolation")}
        if !reduced {XCTAssertTrue(moving.contains{row in guard let rgba=row["shadowRGBA"] as? [Int] else{return false};return buttonShadowIntermediate(rgba)},"Actual450ms shadow opacity interpolation")}
        XCTAssertTrue(samples.contains{($0["inkPixels"] as? Int)==0},"Real retired paint");XCTAssertNotEqual(try number(after,"rootTag"),try number(before,"rootTag"));ready();try capture(name+"-fresh")

    }
    func testButtonMotionAndRetirement() throws {
        tap("Button motion checks");let settings=XCUIApplication(bundleIdentifier:"com.apple.Preferences");settings.launch();let toggle=motionSwitch(settings),original=try XCTUnwrap(toggle.value as? String);XCTAssertTrue(["0","1"].contains(original));FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_ORIGINAL "+original+"\n").utf8))
        addTeardownBlock{[self] in let current=self.motionSwitch(settings);self.setMotion(current,original);XCTAssertEqual(current.value as? String,original);self.app.activate();FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_RESTORED "+original+"\n").utf8))}
        setMotion(toggle,"0");app.activate();reveal(node("button-native-state"));wait("Real normal-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==false};try motion("normal",reduced:false)
        setMotion(motionSwitch(settings),"1");app.activate();reveal(node("button-native-state"));wait("Real reduced-motion event"){((try? self.state()["motionEvents"] as? [Bool]) ?? []).last==true};try motion("reduced",reduced:true)
    }
    private func node(_ id:String)->XCUIElement {app.descendants(matching:.any).matching(identifier:id).firstMatch}

    private func wait(_ message:String,_ predicate:@escaping()->Bool) {
        let expectation=XCTNSPredicateExpectation(predicate:NSPredicate{_,_ in predicate()},object:nil)
        XCTAssertEqual(XCTWaiter.wait(for:[expectation],timeout:nativeWorkRemaining()),.completed,message)
    }

    private func reveal(_ element:XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout:nativeWorkRemaining()));let scroll=app.scrollViews.firstMatch;XCTAssertTrue(scroll.exists)
        for _ in 0..<24 {
            let viewport=app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx:2,dy:2)
            if !element.frame.isEmpty && viewport.contains(element.frame){return}
            guard let distance=galleryScrollFraction(Double(element.frame.minY),Double(element.frame.height),Double(viewport.minY),Double(viewport.height)),distance != 0 else{XCTFail("Button target cannot fit measured viewport");return}
            let start:CGFloat=distance>0 ? 0.75:0.30
            let trace:[String:Any]=["target":element.identifier,"frame":rect(element.frame),"viewport":rect(viewport),"requestedFraction":distance]
            if let data=try? JSONSerialization.data(withJSONObject:trace,options:.sortedKeys){FileHandle.standardOutput.write(Data("BUTTON_SCROLL ".utf8)+data+Data("\n".utf8))}
            scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start)).press(forDuration:0.05,thenDragTo:scroll.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:start-CGFloat(distance))),withVelocity:.slow,thenHoldForDuration:0.25)
        };XCTFail("Unreachable Button control/canvas "+element.identifier)
    }

    private func tap(_ name:String) {
        let control=app.buttons.matching(NSPredicate(format:"label == %@",name)).firstMatch;reveal(control);XCTAssertTrue(control.isHittable);control.tap()
        if name=="Select scene"{wait("Actual selected Button scene"){control.isSelected}}
    }

    private func pixels(_ image:CGImage,_ frame:CGRect,_ window:CGRect,_ scale:CGFloat) throws -> [UInt8] {
        XCTAssertTrue(window.contains(frame));let rect=CGRect(x:((frame.minX-window.minX)*scale).rounded(),y:((frame.minY-window.minY)*scale).rounded(),width:(frame.width*scale).rounded(),height:(frame.height*scale).rounded())
        let crop=try XCTUnwrap(image.cropping(to:rect));var bytes=[UInt8](repeating:0,count:crop.width*crop.height*4)
        let result=bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(crop,in:CGRect(x:0,y:0,width:CGFloat(crop.width),height:CGFloat(crop.height)));return true
        };XCTAssertTrue(result);return bytes
    }
    private func motionSwitch(_ settings: XCUIApplication) -> XCUIElement {
        settings.activate()
        let toggle = settings.switches["Reduce Motion"].firstMatch
        if toggle.exists { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:nativeWorkRemaining()));return toggle
    }

    private func setMotion(_ toggle: XCUIElement, _ expected: String) {
        if toggle.value as? String != expected {
            XCTAssertTrue(toggle.isHittable)
            toggle.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)).tap()
        }
        wait("Actual Reduce Motion switch "+expected) { toggle.value as? String == expected }
        let shot = XCTAttachment(screenshot:XCUIScreen.main.screenshot());shot.name="meter-motion-switch-"+expected;shot.lifetime = .keepAlways;add(shot)
        FileHandle.standardOutput.write(Data(("METER_STYLE_MOTION_SWITCH "+expected+"\n").utf8))
    }
}
