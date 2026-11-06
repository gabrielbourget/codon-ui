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
        continueAfterFailure = false; executionTimeAllowance = 180
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
        XCTAssertEqual(XCTWaiter.wait(for: [gate], timeout: 10), .completed, message)
    }
    private func reveal(_ element: XCUIElement, blocked: Bool = false) {
        XCTAssertTrue(element.waitForExistence(timeout: 10))
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
        if toggle.waitForExistence(timeout:2) { return toggle }
        for label in ["Accessibility","Motion"] {
            let entry = settings.staticTexts[label].firstMatch
            for _ in 0..<12 { if entry.exists && entry.isHittable { break };settings.swipeUp() }
            XCTAssertTrue(entry.exists && entry.isHittable,"Standard Settings navigation "+label);entry.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout:10));return toggle
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
