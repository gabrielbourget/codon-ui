import XCTest
import UIKit

private func nativeWorkRemaining() -> TimeInterval {
    guard let text = ProcessInfo.processInfo.environment["CODON_NATIVE_WORK_DEADLINE_UNIX"],
          let deadline = Double(text), deadline.isFinite else {
        preconditionFailure("Missing admitted native work deadline")
    }
    return max(0, deadline - Date().timeIntervalSince1970)
}

// Actual native layout receipts and same-frame stock View pixels; no authored JS geometry oracle.
final class IndicatorG04TrialTests: XCTestCase {
    private lazy var app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
    private let prefix = "indicator-g04-"
    private var original: [String: Any] = [:]
    private let cases: [(String, Double, Double)] = [
        ("default", 10, 10), ("activity-border", 20, 20), ("shape-fractional", 14.5, 14.5),
        ("zero", 0, 0), ("percent", 60, 60), ("auto", 0, 0),
        ("registered-callback", 24, 10), ("native-color", 20, 20),
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
        for key in ["CODON_INDICATOR_FIXTURE_SHA256", "CODON_INDICATOR_SCENE_SHA256",
                    "CODON_INDICATOR_PRODUCT_SHA256", "CODON_INDICATOR_OBSERVER_MANIFEST_SHA256"] {
            let value = try XCTUnwrap(ProcessInfo.processInfo.environment[key], "Missing " + key)
            XCTAssertNotNil(value.range(of: "^[0-9a-f]{64}$", options: .regularExpression))
        }
        XCTAssertEqual(app.state, .runningForeground, "Root prelaunches the matched Display scene")
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        if !app.staticTexts["Indicators and segments"].exists { tap("Indicator/Segment scene") }
        XCTAssertTrue(app.staticTexts["Indicators and segments"].waitForExistence(timeout: nativeWorkRemaining()))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label == %@", "G04 prepare Indicator")).firstMatch.waitForExistence(timeout: nativeWorkRemaining()))
    }

    override func tearDownWithError() throws {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "indicator-final-screen"; shot.lifetime = .keepAlways; add(shot)
        let hierarchy = XCTAttachment(string: app.debugDescription)
        hierarchy.name = "indicator-final-hierarchy"; hierarchy.lifetime = .keepAlways; add(hierarchy)
        if let current = try? state() { try mark("indicator-final-state", current) }
    }

    private func node(_ suffix: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: prefix + suffix).firstMatch
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
            let viewport = app.windows.firstMatch.frame.intersection(scroll.frame).insetBy(dx: 2, dy: 2)
            if !frame.isEmpty && viewport.contains(frame) && (blocked || element.isHittable) { return }
            let upward = frame.minY < viewport.minY
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
        try XCTUnwrap(JSONSerialization.jsonObject(with: Data(node("state").label.utf8)) as? [String: Any])
    }
    private func number(_ row: [String: Any], _ key: String) throws -> Double {
        let value = try XCTUnwrap(row[key] as? NSNumber, key).doubleValue
        XCTAssertTrue(value.isFinite, key); return value
    }
    private func rectangle(_ value: [String: Any]) throws -> CGRect {
        try CGRect(x: number(value, "x"), y: number(value, "y"), width: number(value, "width"), height: number(value, "height"))
    }
    private func receipt(_ owner: String, _ current: [String: Any]) throws -> [String: Any] {
        let layouts = try XCTUnwrap(current["layouts"] as? [String: Any])
        return try XCTUnwrap(layouts[owner] as? [String: Any], owner)
    }
    private func sameRoot(_ current: [String: Any]) throws {
        for key in ["rootTag", "refIdentity", "attaches", "detaches"] {
            XCTAssertEqual(try number(current, key), try number(original, key), key)
        }
        XCTAssertGreaterThan(try number(current, "rootTag"), 0)
        let target = try receipt("target", current)
        XCTAssertEqual(try number(target, "currentTarget"), try number(current, "rootTag"))
        if let native = target["nativeTarget"] as? NSNumber {
            XCTAssertEqual(native.doubleValue, try number(current, "rootTag"))
        }
    }
    private func mark(_ name: String, _ value: [String: Any]) throws {
        var row = value; row["epochSeconds"] = Date().timeIntervalSince1970
        let data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys, .prettyPrinted])
        FileHandle.standardOutput.write(Data((name + " ").utf8) + data + Data("\n".utf8))
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func frameValues(_ frame: CGRect) -> [CGFloat] { [frame.minX, frame.minY, frame.width, frame.height] }

    private struct Paint {
        let width: Int
        let height: Int
        let rgba: [UInt8]
    }
    private func pixels(_ crop: CGImage) throws -> Paint {
        var bytes = [UInt8](repeating: 0, count: crop.width * crop.height * 4)
        let drawn = bytes.withUnsafeMutableBytes { data -> Bool in
            guard let context = CGContext(data: data.baseAddress, width: crop.width, height: crop.height,
                bitsPerComponent: 8, bytesPerRow: crop.width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
            context.draw(crop, in: CGRect(x: 0, y: 0, width: CGFloat(crop.width), height: CGFloat(crop.height))); return true
        }
        XCTAssertTrue(drawn)
        return Paint(width: crop.width, height: crop.height, rgba: bytes)
    }
    private func crop(_ image: CGImage, _ frame: CGRect, _ window: CGRect, _ scale: CGFloat, _ name: String) throws -> Paint {
        let rect = CGRect(x: ((frame.minX - window.minX) * scale).rounded(),
                          y: ((frame.minY - window.minY) * scale).rounded(),
                          width: (frame.width * scale).rounded(), height: (frame.height * scale).rounded())
        let cut = try XCTUnwrap(image.cropping(to: rect))
        let attachment = XCTAttachment(image: UIImage(cgImage: cut))
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
        return try pixels(cut)
    }
    private func centerRGB(_ image: CGImage, _ frame: CGRect, _ window: CGRect, _ scale: CGFloat) throws -> [UInt8] {
        let point = CGRect(x: floor((frame.midX - window.minX) * scale), y: floor((frame.midY - window.minY) * scale), width: 1, height: 1)
        let pixel = try pixels(XCTUnwrap(image.cropping(to: point)))
        return Array(pixel.rgba.prefix(3))
    }
    private enum RasterOrientation: String, CaseIterable {
        case up, upMirrored, down, downMirrored, left, leftMirrored, right, rightMirrored
    }
    private func windowOrientedRaster(_ raw: CGImage, _ orientation: RasterOrientation) throws -> CGImage {
        if orientation == .up { return raw }
        let width = CGFloat(raw.width), height = CGFloat(raw.height)
        let transform: CGAffineTransform
        switch orientation {
        case .up: transform = CGAffineTransform(a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0)
        case .upMirrored: transform = CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: width, ty: 0)
        case .down: transform = CGAffineTransform(a: -1, b: 0, c: 0, d: -1, tx: width, ty: height)
        case .downMirrored: transform = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: 0, ty: height)
        case .left: transform = CGAffineTransform(a: 0, b: 1, c: -1, d: 0, tx: height, ty: 0)
        case .leftMirrored: transform = CGAffineTransform(a: 0, b: -1, c: -1, d: 0, tx: height, ty: width)
        case .right: transform = CGAffineTransform(a: 0, b: -1, c: 1, d: 0, tx: 0, ty: width)
        case .rightMirrored: transform = CGAffineTransform(a: 0, b: 1, c: 1, d: 0, tx: 0, ty: 0)
        }
        let swapped = [.left, .leftMirrored, .right, .rightMirrored].contains(orientation)
        let outputWidth = swapped ? raw.height : raw.width
        let outputHeight = swapped ? raw.width : raw.height
        guard let colorSpace = raw.colorSpace,
              let context = CGContext(data: nil, width: outputWidth, height: outputHeight,
                bitsPerComponent: 8, bytesPerRow: outputWidth * 4, space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else {
            throw NSError(domain: "LineSegmentG04Screenshot", code: 1)
        }
        context.interpolationQuality = .none
        context.setBlendMode(.copy)
        context.concatenate(transform)
        context.draw(raw, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let normalized = context.makeImage() else {
            throw NSError(domain: "LineSegmentG04Screenshot", code: 2)
        }
        return normalized
    }
    private func windowOrientedImage(_ input: UIImage) throws -> (CGImage, RasterOrientation) {
        let orientation: RasterOrientation
        switch input.imageOrientation {
        case .up: orientation = .up
        case .upMirrored: orientation = .upMirrored
        case .down: orientation = .down
        case .downMirrored: orientation = .downMirrored
        case .left: orientation = .left
        case .leftMirrored: orientation = .leftMirrored
        case .right: orientation = .right
        case .rightMirrored: orientation = .rightMirrored
        @unknown default:
            XCTFail("Unrecognized actual UIImage orientation")
            throw NSError(domain: "LineSegmentG04Screenshot", code: 3)
        }
        return (try windowOrientedRaster(XCTUnwrap(input.cgImage), orientation), orientation)
    }

    private func orient(_ orientation: UIDeviceOrientation) throws {
        XCUIDevice.shared.orientation = orientation
        wait("Actual window and native Dimensions orientation") {
            let frame = self.app.windows.firstMatch.frame
            guard let current = try? self.state(), let row = current["window"] as? [String: Any],
                  let scale = row["scale"] as? NSNumber, let width = row["width"] as? NSNumber,
                  let height = row["height"] as? NSNumber, scale.doubleValue > 0 else { return false }
            let oriented = orientation.isLandscape ? frame.width > frame.height : frame.height > frame.width
            let pixel = 1 / scale.doubleValue
            return oriented && abs(width.doubleValue - Double(frame.width)) <= pixel
                && abs(height.doubleValue - Double(frame.height)) <= pixel
        }
        let row = try XCTUnwrap(state()["window"] as? [String: Any])
        let frame = app.windows.firstMatch.frame, onePixel = 1 / (try number(row, "scale"))
        XCTAssertEqual(try number(row, "width"), Double(frame.width), accuracy: onePixel)
        XCTAssertEqual(try number(row, "height"), Double(frame.height), accuracy: onePixel)
    }

    private func readableParagraph(_ element: XCUIElement, _ label: String) throws {
        XCTAssertTrue(element.waitForExistence(timeout: nativeWorkRemaining()))
        let fullText = element.label
        let scroll = app.scrollViews.firstMatch
        let window = app.windows.firstMatch.frame
        let viewport = window.intersection(scroll.frame).insetBy(dx: 2, dy: 2)
        if element.frame.height <= viewport.height {
            reveal(element, blocked: true)
            XCTAssertTrue(viewport.contains(element.frame))
            try mark(label, ["nativeFullText": fullText, "actualParagraphFrame": frameValues(element.frame),
                "actualWindow": frameValues(window), "actualScrollViewport": frameValues(viewport),
                "visibleIntersection": frameValues(viewport.intersection(element.frame)), "topAndTailObservedTogether": true])
            return
        }
        var observed: [String: Any] = [:]
        for (name, tail) in [("top", false), ("tail", true)] {
            var found = false
            for _ in 0..<16 {
                let frame = element.frame
                let point = tail ? frame.maxY : frame.minY
                let horizontallyInside = frame.minX >= viewport.minX && frame.maxX <= viewport.maxX
                if horizontallyInside && point >= viewport.minY && point <= viewport.maxY {
                    let visible = viewport.intersection(frame)
                    if visible.height >= min(frame.height, viewport.height * 0.25) { found = true; break }
                }
                let upward = point < viewport.minY
                scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.30 : 0.75))
                    .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.70 : 0.35)))
            }
            XCTAssertTrue(found, "Actual paragraph " + name + " must become visibly reachable without requiring the whole paragraph to fit")
            let frame = element.frame
            XCTAssertEqual(element.label, fullText)
            observed[name] = ["actualFullParagraphFrame": frameValues(frame),
                "actualVisibleIntersection": frameValues(viewport.intersection(frame)),
                "observedEdgeY": tail ? frame.maxY : frame.minY]
            let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            shot.name = label + "-" + name; shot.lifetime = .keepAlways; add(shot)
        }
        try mark(label, ["nativeFullText": fullText, "actualWindow": frameValues(window),
            "actualScrollViewport": frameValues(viewport), "nativeTopAndTailObservations": observed,
            "topAndTailObservedTogether": false, "scope": "Actual native scrolling and visible paragraph slices; full paragraph is retained as text and measured bounds"])
    }

    private func endReachable(_ label: String, adaptiveText: Bool = false) throws {
        let copy = node("long-copy")
        if adaptiveText { try readableParagraph(copy, label + "-paragraph") }
        else { reveal(copy, blocked: true) }
        XCTAssertTrue(copy.label.contains("English")); XCTAssertTrue(copy.label.contains("française"))
        let before = try number(state(), "actions")
        tap("G04 IND final action")
        wait("Actual final action") { (try? self.number(self.state(), "actions")) == before + 1 }
        let end = node("end"); reveal(end, blocked: true)
        let window = app.windows.firstMatch.frame, viewport = window.intersection(app.scrollViews.firstMatch.frame)
        XCTAssertTrue(viewport.contains(end.frame))
        let tail = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Long descriptive copy:")).firstMatch
        if adaptiveText && tail.frame.height > viewport.height { try readableParagraph(tail, label + "-scene-tail") }
        else { reveal(tail, blocked: true); XCTAssertTrue(viewport.contains(tail.frame)) }
        try sameRoot(state())
        try mark(label, ["state": state(), "actualWindow": frameValues(window), "actualScrollViewport": frameValues(viewport),
            "endFrame": frameValues(end.frame), "actualSceneLastCopyFrame": frameValues(tail.frame), "lastCopy": tail.label])
    }


    private func currentExpected(_ index: Int, _ row: [String: Any]) throws -> (Double, Double) {
        if index == 6 { return (row["active"] as? Bool == true ? 24 : 28, 10) }
        return (cases[index].1, cases[index].2)
    }
    private func sameOwnedRoot(_ row: [String: Any]) throws {
        let current = try XCTUnwrap(row["ownedBinding"] as? [String: Any])
        let before = try XCTUnwrap(original["ownedBinding"] as? [String: Any])
        for key in ["rootTag", "refIdentity", "attaches", "detaches"] {
            XCTAssertEqual(try number(current, key), try number(before, key), "Original owned Indicator " + key)
        }
        let target = try receipt("ownedTarget", row)
        XCTAssertGreaterThan(try number(current, "rootTag"), 0)
        XCTAssertEqual(try number(target, "currentTarget"), try number(current, "rootTag"))
        XCTAssertEqual(try number(target, "nativeTarget"), try number(current, "rootTag"))
    }
    private func screenshotRaster(_ label: String, _ retained: XCUIScreenshot? = nil) throws -> CGImage {
        let shot = retained ?? XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = label + "-screen"; attachment.lifetime = .keepAlways; add(attachment)
        let input = shot.image, raw = try XCTUnwrap(input.cgImage)
        let (image, logical) = try windowOrientedImage(input)
        try mark(label + "-screenshot-raster-orientation", [
            "rawCGImageAxes": [raw.width, raw.height], "windowOrientedCGImageAxes": [image.width, image.height],
            "uiImageOrientationName": String(describing: input.imageOrientation),
            "uiImageOrientationRawValue": input.imageOrientation.rawValue,
            "rasterOrientationLogicalCase": logical.rawValue, "originalScreenshotAttachmentUnchanged": true,
            "rotationInterpolation": "none", "orientationScope": "Actual UIImage enum, not EXIF raw number",
        ])
        return image
    }
    private func pixelRGB(_ image: CGImage, _ point: CGPoint, _ window: CGRect, _ scale: CGFloat) throws -> [UInt8] {
        let rect = CGRect(x: floor((point.x - window.minX) * scale),
                          y: floor((point.y - window.minY) * scale), width: 1, height: 1)
        return Array(try pixels(XCTUnwrap(image.cropping(to: rect))).rgba.prefix(3))
    }
    private func unpaintedCount(_ paint: Paint) -> Int {
        let background = Array(paint.rgba.suffix(4))
        var changed = 0
        for y in 1..<(paint.height - 1) {
            for x in 1..<(paint.width - 1) {
                let offset = (y * paint.width + x) * 4
                if Array(paint.rgba[offset..<(offset + 4)]) != background { changed += 1 }
            }
        }
        return changed
    }
    private func assertUnpainted(_ paint: Paint) -> Int {
        let changed = unpaintedCount(paint)
        XCTAssertEqual(changed, 0, "Zero/auto/opacity0/transparent native interior is unpainted")
        return changed
    }
    // Fresh public XCTest snapshot, local only to one observation; never retained across actions.
    private struct FocusedObservation {
        let stateLabel: String
        let row: [String: Any]
        let window: CGRect
        let scroll: CGRect
        let parent: CGRect
        let referenceParent: CGRect
        let target: CGRect?
    }
    private func focusedObservation() throws -> FocusedObservation {
        let root = try app.snapshot()
        var elements: [XCUIElementSnapshot] = []
        func visit(_ item: XCUIElementSnapshot) {
            elements.append(item)
            for child in item.children { visit(child) }
        }
        visit(root)
        func identified(_ suffix: String, required: Bool = true) throws -> XCUIElementSnapshot? {
            let matches = elements.filter { $0.identifier == prefix + suffix }
            XCTAssertLessThanOrEqual(matches.count, 1, "Unique actual snapshot target " + suffix)
            if required { XCTAssertEqual(matches.count, 1, "Required actual snapshot target " + suffix) }
            return matches.first
        }
        let stateLabel = try XCTUnwrap(identified("state")).label
        let row = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(stateLabel.utf8)) as? [String: Any])
        let window = try XCTUnwrap(elements.first { $0.elementType == .window }).frame
        let scroll = try XCTUnwrap(elements.first { $0.elementType == .scrollView }).frame
        return try FocusedObservation(stateLabel: stateLabel, row: row, window: window, scroll: scroll,
            parent: XCTUnwrap(identified("parent")).frame,
            referenceParent: XCTUnwrap(identified("reference-parent")).frame,
            target: identified("target", required: false)?.frame)
    }

    private func verify(_ index: Int, _ label: String, focused: Bool = false) throws {
        wait("Current case and actual native Indicator geometry") {
            guard let row = try? self.state(), row["case"] as? String == self.cases[index].0,
                  let layout = row["layout"] as? [String: Any],
                  let width = layout["width"] as? NSNumber, let height = layout["height"] as? NSNumber,
                  let window = row["window"] as? [String: Any], let scale = window["scale"] as? NSNumber,
                  let expected = try? self.currentExpected(index, row) else { return false }
            return abs(width.doubleValue - expected.0) <= 1 / scale.doubleValue
                && abs(height.doubleValue - expected.1) <= 1 / scale.doubleValue
        }
        var observation: FocusedObservation?
        if focused {
            observation = try focusedObservation()
            let current = try XCTUnwrap(observation)
            let viewport = current.scroll.intersection(current.window)
            if !viewport.contains(current.parent) || !viewport.contains(current.referenceParent) {
                reveal(node("parent"), blocked: true); reveal(node("reference-parent"), blocked: true)
                observation = try focusedObservation()
            }
        } else {
            reveal(node("parent"), blocked: true); reveal(node("reference-parent"), blocked: true)
        }
        let row = try observation?.row ?? state(); try sameRoot(row); try sameOwnedRoot(row)
        let expected = try currentExpected(index, row)
        let window = observation?.window ?? app.windows.firstMatch.frame
        let parent = observation?.parent ?? node("parent").frame
        let referenceParent = observation?.referenceParent ?? node("reference-parent").frame
        let viewport = (observation?.scroll ?? app.scrollViews.firstMatch.frame).intersection(window)
        XCTAssertTrue(viewport.contains(parent)); XCTAssertTrue(viewport.contains(referenceParent))
        let image = try screenshotRaster(label)
        let scale = CGFloat(image.width) / window.width
        XCTAssertEqual(scale, CGFloat(image.height) / window.height, accuracy: 0.0001)
        XCTAssertEqual(try number(XCTUnwrap(row["window"] as? [String: Any]), "scale"), Double(scale), accuracy: 0.0001)
        let onePixel = 1 / scale
        for frame in [parent, referenceParent] {
            XCTAssertEqual(frame.width, 120, accuracy: onePixel); XCTAssertEqual(frame.height, 120, accuracy: onePixel)
        }
        let target = try receipt("target", row), reference = try receipt("reference", row)
        let local = try rectangle(XCTUnwrap(target["layout"] as? [String: Any]))
        let raw = try rectangle(XCTUnwrap(reference["layout"] as? [String: Any]))
        for frame in [local, raw] {
            XCTAssertEqual(frame.width, CGFloat(expected.0), accuracy: onePixel)
            XCTAssertEqual(frame.height, CGFloat(expected.1), accuracy: onePixel)
            XCTAssertEqual(frame.minX, 0, accuracy: onePixel)
            XCTAssertEqual(frame.minY, index == 6 ? 5 : 0, accuracy: onePixel)
        }
        for owner in ["parent", "referenceParent"] {
            let native = try receipt(owner, row), frame = try rectangle(XCTUnwrap(native["layout"] as? [String: Any]))
            XCTAssertEqual(frame.width, 120, accuracy: onePixel); XCTAssertEqual(frame.height, 120, accuracy: onePixel)
            XCTAssertGreaterThan(try number(native, "currentTarget"), 0)
        }
        let actualTarget = focused ? observation?.target : (node("target").exists ? node("target").frame : nil)
        if expected.0 > 0 && expected.1 > 0, let actual = actualTarget {
            XCTAssertEqual(actual.width, local.width, accuracy: onePixel); XCTAssertEqual(actual.height, local.height, accuracy: onePixel)
            XCTAssertEqual(actual.minX, parent.minX + local.minX, accuracy: onePixel)
            XCTAssertEqual(actual.minY, parent.minY + local.minY, accuracy: onePixel)
        }
        if let before = observation {
            let after = try focusedObservation()
            XCTAssertEqual(after.stateLabel, before.stateLabel, "No state/layout/ref change during native capture")
            XCTAssertEqual(after.window, before.window); XCTAssertEqual(after.scroll, before.scroll)
            XCTAssertEqual(after.parent, before.parent); XCTAssertEqual(after.referenceParent, before.referenceParent)
            XCTAssertEqual(after.target, before.target, "No stale target-frame reuse")
            try sameRoot(after.row); try sameOwnedRoot(after.row)
            try mark(label + "-public-snapshot-acquisition", ["freshSnapshots": 2,
                "stateAndFramesStableAcrossScreenshot": true, "source": "XCUIElement.snapshot()",
                "snapshotRetainedAcrossActions": false])
        }
        let actualPaint = try crop(image, parent, window, scale, label + "-component-parent")
        let referencePaint = try crop(image, referenceParent, window, scale, label + "-raw-reference-parent")
        let active = row["active"] as? Bool == true
        let absent = expected.0 == 0 || expected.1 == 0 || (index == 6 && row["zeroOpacity"] as? Bool == true)
            || (!active && [0, 4].contains(index))
        var center: [UInt8] = [], rawCenter: [UInt8] = [], border: [UInt8] = [], rawBorder: [UInt8] = []
        var absence: [Int] = []
        if absent { absence = [assertUnpainted(actualPaint), assertUnpainted(referencePaint)] }
        else {
            let frame = CGRect(x: parent.minX + local.minX, y: parent.minY + local.minY, width: local.width, height: local.height)
            let rawFrame = CGRect(x: referenceParent.minX + raw.minX, y: referenceParent.minY + raw.minY, width: raw.width, height: raw.height)
            center = try centerRGB(image, frame, window, scale); rawCenter = try centerRGB(image, rawFrame, window, scale)
            XCTAssertEqual(center, rawCenter, "Exact same-screen native center RGB")
            if index == 0 || index == 4 {
                let expectedColor: [UInt8] = row["override"] as? Bool == true ? [255, 136, 0]
                    : row["mode"] as? String == "dark" ? [255, 255, 255] : [23, 23, 23]
                XCTAssertEqual(center, expectedColor)
            } else if index == 1 { XCTAssertEqual(center, active ? [0, 255, 0] : [128, 128, 128]) }
            else if index == 2 { XCTAssertEqual(center, active ? [255, 99, 71] : [128, 128, 128]) }
            else if index == 7 && !active { XCTAssertEqual(center, [128, 128, 128]) }
            if [1, 2, 7].contains(index) {
                border = try pixelRGB(image, CGPoint(x: frame.midX, y: frame.minY + 1), window, scale)
                rawBorder = try pixelRGB(image, CGPoint(x: rawFrame.midX, y: rawFrame.minY + 1), window, scale)
                XCTAssertEqual(border, rawBorder, "Actual native 2pt border, sampled1pt inward at top-center")
                if index == 1 { XCTAssertEqual(border, row["borderOverride"] as? Bool == true ? [23, 78, 166] : [0, 255, 0]) }
                else if index == 2 { XCTAssertEqual(border, [0, 0, 0]) }
            }
        }
        try mark(label, ["state": row, "actualWindow": frameValues(window), "actualScrollViewport": frameValues(viewport),
            "actualParent": frameValues(parent), "actualReferenceParent": frameValues(referenceParent),
            "nativeRootLayout": target, "nativeReferenceLayout": reference, "actualPixelScale": scale,
            "geometryTolerancePhysicalPixels": 1, "componentCenterRGB": center, "referenceCenterRGB": rawCenter,
            "componentBorderRGB": border, "referenceBorderRGB": rawBorder, "paintAbsenceExpected": absent,
            "unexpectedPaintPixels": absence, "rawParentCropsPreservedForEdgeRadiusOpacityReview": true])
    }
    private func ownedEndpointShot(_ label: String, _ row: [String: Any], _ actualRow: CGRect,
                                   _ component: CGRect, _ reference: CGRect, _ window: CGRect) throws -> XCUIScreenshot {
        let active = row["active"] as? Bool == true
        let expected: [UInt8] = row["override"] as? Bool == true ? [8, 127, 140] : [255, 255, 255]
        var observations: [[String: Any]] = [], consecutive = 0
        var stable: XCUIScreenshot?, last: XCUIScreenshot?
        let predicate = NSPredicate { _, _ in
            let shot = XCUIScreen.main.screenshot(); last = shot
            do {
                let (image, _) = try self.windowOrientedImage(shot.image)
                let scale = CGFloat(image.width) / window.width
                guard abs(scale - CGFloat(image.height) / window.height) <= 0.0001 else { return false }
                var sample: [String: Any] = ["epochSeconds": Date().timeIntervalSince1970]
                let matches: Bool
                if active {
                    let actual = try self.centerRGB(image, component, window, scale)
                    let raw = try self.centerRGB(image, reference, window, scale)
                    matches = actual == expected && raw == expected
                    sample["componentCenterRGB"] = actual; sample["referenceCenterRGB"] = raw
                    sample["expectedEndpointRGB"] = expected
                } else {
                    let rect = CGRect(x: ((actualRow.minX - window.minX) * scale).rounded(),
                        y: ((actualRow.minY - window.minY) * scale).rounded(),
                        width: (actualRow.width * scale).rounded(), height: (actualRow.height * scale).rounded())
                    let count = self.unpaintedCount(try self.pixels(XCTUnwrap(image.cropping(to: rect))))
                    matches = count == 0; sample["unexpectedPaintPixels"] = count
                }
                consecutive = matches ? consecutive + 1 : 0
                sample["exactEndpoint"] = matches; sample["consecutive"] = consecutive; observations.append(sample)
                if consecutive >= 2 { stable = shot; return true }
                return false
            } catch {
                consecutive = 0
                observations.append(["epochSeconds": Date().timeIntervalSince1970, "error": String(describing: error)])
                return false
            }
        }
        let result = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: predicate, object: nil)], timeout: nativeWorkRemaining())
        try mark(label + "-native-endpoint-observations", ["state": row, "samples": observations,
            "requiredConsecutiveExactNativeSnapshots": 2, "endpointReached": result == .completed,
            "scope": "Wait for actual declared Button foreground endpoint; no color tolerance or fixed sleep"])
        if result != .completed, let last {
            let attachment = XCTAttachment(screenshot: last)
            attachment.name = label + "-endpoint-failure-screen"; attachment.lifetime = .keepAlways; add(attachment)
        }
        XCTAssertEqual(result, .completed, "Actual native paint must reach and retain its exact endpoint")
        return try XCTUnwrap(stable)
    }
    private func verifyOwned(_ label: String) throws {
        XCTAssertTrue(node("owned-row").exists, "Actual owned row AXframe is required; no guessed Button padding")
        reveal(node("owned-row"), blocked: true)
        let row = try state(); try sameRoot(row); try sameOwnedRoot(row)
        let window = app.windows.firstMatch.frame, actualRow = node("owned-row").frame
        let viewport = window.intersection(app.scrollViews.firstMatch.frame)
        XCTAssertTrue(viewport.contains(actualRow))
        let target = try receipt("ownedTarget", row), reference = try receipt("ownedReference", row)
        let local = try rectangle(XCTUnwrap(target["layout"] as? [String: Any]))
        let raw = try rectangle(XCTUnwrap(reference["layout"] as? [String: Any]))
        let nativeRow = try rectangle(XCTUnwrap(receipt("ownedRow", row)["layout"] as? [String: Any]))
        let scale = CGFloat(try number(XCTUnwrap(row["window"] as? [String: Any]), "scale")), onePixel = 1 / scale
        XCTAssertEqual(actualRow.width, nativeRow.width, accuracy: onePixel)
        XCTAssertEqual(actualRow.height, nativeRow.height, accuracy: onePixel)
        for frame in [local, raw] {
            XCTAssertEqual(frame.width, 10, accuracy: onePixel); XCTAssertEqual(frame.height, 10, accuracy: onePixel)
            XCTAssertEqual(frame.minY, 0, accuracy: onePixel)
        }
        XCTAssertEqual(local.minX, 0, accuracy: onePixel); XCTAssertEqual(raw.minX, 20, accuracy: onePixel)
        let component = CGRect(x: actualRow.minX + local.minX, y: actualRow.minY + local.minY, width: local.width, height: local.height)
        let referenceFrame = CGRect(x: actualRow.minX + raw.minX, y: actualRow.minY + raw.minY, width: raw.width, height: raw.height)
        XCTAssertTrue(actualRow.contains(component)); XCTAssertTrue(actualRow.contains(referenceFrame))
        let stable = try ownedEndpointShot(label, row, actualRow, component, referenceFrame, window)
        try sameRoot(state()); try sameOwnedRoot(state())
        let image = try screenshotRaster(label, stable)
        XCTAssertEqual(CGFloat(image.width) / window.width, scale, accuracy: 0.0001)
        XCTAssertEqual(CGFloat(image.height) / window.height, scale, accuracy: 0.0001)
        let captured = try crop(image, actualRow, window, scale, label + "-owned-row")
        var center: [UInt8] = [], rawCenter: [UInt8] = [], absence: [Int] = []
        if row["active"] as? Bool == true {
            center = try centerRGB(image, component, window, scale); rawCenter = try centerRGB(image, referenceFrame, window, scale)
            XCTAssertEqual(center, rawCenter)
            XCTAssertEqual(center, row["override"] as? Bool == true ? [8, 127, 140] : [255, 255, 255], "Actual Button-owned foreground")
        } else { absence = [assertUnpainted(captured)] }
        try mark(label, ["state": row, "actualWindow": frameValues(window), "actualScrollViewport": frameValues(viewport),
            "actualOwnedRow": frameValues(actualRow), "nativeOwnedRow": receipt("ownedRow", row),
            "nativeOwnedTarget": target, "nativeOwnedReference": reference, "actualPixelScale": scale,
            "geometryTolerancePhysicalPixels": 1, "componentCenterRGB": center, "referenceCenterRGB": rawCenter,
            "paintAbsenceExpected": row["active"] as? Bool != true, "unexpectedPaintPixels": absence])
    }
    private func seek(_ wanted: Int) throws {
        for _ in 0..<cases.count {
            if try number(state(), "index") == Double(wanted) { return }
            tap("G04 IND next case")
        }
        XCTFail("Unable to select finite Indicator case")
    }
    private func setFlag(_ key: String, _ expected: Bool, _ label: String) throws {
        if try state()[key] as? Bool != expected { tap(label) }
        wait("Actual control acknowledgment " + key) { (try? self.state()[key] as? Bool) == expected }
        try sameRoot(state())
    }
    private func prepare(_ mode: String = "light") throws {
        XCUIDevice.shared.orientation = .portrait
        wait("Actual portrait window before prepare") {
            self.app.windows.firstMatch.frame.height > self.app.windows.firstMatch.frame.width
        }
        tap("Light theme"); tap("Live window"); tap("G04 prepare Indicator")
        wait("Actual original refs and all native layout owners") {
            guard let row = try? self.state(), let tag = row["rootTag"] as? NSNumber,
                  let owned = row["ownedBinding"] as? [String: Any], let ownedTag = owned["rootTag"] as? NSNumber,
                  let layouts = row["layouts"] as? [String: Any] else { return false }
            return tag.intValue > 0 && ownedTag.intValue > 0 && layouts.count == 7
                && row["case"] as? String == self.cases[0].0 && row["active"] as? Bool == true
        }
        original = try state(); try orient(.portrait)
        if mode == "dark" { tap("Dark theme") }
        wait("Actual theme acknowledgment") { (try? self.state()["mode"] as? String) == mode }
        try sameRoot(state()); try sameOwnedRoot(state())
    }
    private func hostState() -> String {
        app.descendants(matching: .any).matching(identifier: "display-state").firstMatch.label
    }
    private func normalizedHost() throws -> String {
        if hostState().contains("Indicator: active") { tap("Toggle indicator activity") }
        for _ in 0..<3 { if hostState().contains("Shape: square") { break }; tap("Next indicator shape") }
        if !hostState().contains("Size: 0.") { tap("Toggle zero dimensions") }
        let value = hostState()
        XCTAssertTrue(value.contains("Indicator: inactive")); XCTAssertTrue(value.contains("Shape: square"))
        XCTAssertTrue(value.contains("Size: 0.")); return value
    }
    private func matrix(_ indices: ClosedRange<Int>, _ mode: String) throws {
        try prepare(mode); let host = try normalizedHost()
        for index in indices { try seek(index); try verify(index, "IND-" + mode + "-" + cases[index].0) }
        XCTAssertEqual(hostState(), host)
    }
    private func shape(_ expected: String) throws {
        for _ in 0..<3 {
            if try state()["shape"] as? String == expected { return }
            tap("G04 IND shape")
        }
        XCTFail("Current shape was not acknowledged")
    }
    func testI01LightCases00To03() throws { try matrix(0...3, "light") }
    func testI02LightCases04To07() throws { try matrix(4...7, "light") }
    func testI03DarkCases00To03() throws { try matrix(0...3, "dark") }
    func testI04DarkCases04To07() throws { try matrix(4...7, "dark") }
    func testI05InactiveAndExplicitBorder() throws {
        try prepare(); try seek(1)
        try setFlag("active", false, "G04 IND activity"); try verify(1, "IND-inactive-retains-lime-border")
        try setFlag("borderOverride", true, "G04 IND explicit border"); try verify(1, "IND-inactive-explicit-blue-border")
        try setFlag("active", true, "G04 IND activity"); try verify(1, "IND-active-explicit-blue-border")
        try setFlag("borderOverride", false, "G04 IND explicit border"); try verify(1, "IND-active-restored-lime-border")
    }
    func testI06ShapeAndCallbackFinalStyle() throws {
        try prepare(); try seek(2)
        try shape("square"); try verify(2, "IND-fractional-square")
        try shape("circle"); try verify(2, "IND-fractional-circle")
        try shape("rounded"); try verify(2, "IND-fractional-rounded-restored")
        try seek(6); try setFlag("active", false, "G04 IND activity")
        try verify(6, "IND-callback-inactive-width28")
        try setFlag("zeroOpacity", true, "G04 IND zero opacity"); try verify(6, "IND-callback-zero-opacity")
        try setFlag("zeroOpacity", false, "G04 IND zero opacity"); try verify(6, "IND-callback-opacity-restored")
    }
    func testI07NativeNameAndProvider() throws {
        try prepare()
        XCTAssertEqual(app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "G04 indicator")).count, 0)
        try setFlag("named", true, "G04 IND named target")
        wait("One named generic original Indicator") {
            self.app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "G04 indicator")).count == 1
        }
        XCTAssertEqual(node("target").elementType, .other); XCTAssertEqual(node("target").label, "G04 indicator")
        try verify(0, "IND-native-named")
        try setFlag("named", false, "G04 IND named target")
        wait("Removed name is absent from actual native tree") {
            self.app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "G04 indicator")).count == 0
        }
        try mark("IND-native-decorative-restored", ["state": state(), "hierarchy": app.debugDescription])
        try setFlag("override", true, "G04 IND provider context"); try verify(0, "IND-provider-light")
        tap("Dark theme"); wait("Current dark theme") { (try? self.state()["mode"] as? String) == "dark" }
        try verify(0, "IND-provider-dark")
        tap("Light theme"); wait("Current light theme") { (try? self.state()["mode"] as? String) == "light" }
        try setFlag("override", false, "G04 IND provider context"); try verify(0, "IND-provider-restored")
        try seek(2); try shape("rounded")
        try setFlag("override", true, "G04 IND provider context"); try verify(2, "IND-provider-rounded-radius8")
        try setFlag("override", false, "G04 IND provider context"); try verify(2, "IND-provider-rounded-radius5-restored")
    }
    func testI08ButtonOwnedForeground() throws {
        try prepare(); try verifyOwned("IND-owned-default-white")
        try setFlag("override", true, "G04 IND provider context")
        try verify(0, "IND-owned-provider-admission"); try verifyOwned("IND-owned-provider-teal")
        try setFlag("active", false, "G04 IND activity"); try verifyOwned("IND-owned-transparent-inactive")
        try setFlag("active", true, "G04 IND activity"); try verifyOwned("IND-owned-teal-restored")
        try setFlag("override", false, "G04 IND provider context")
        try verify(0, "IND-owned-default-admission"); try verifyOwned("IND-owned-default-restored")
    }
    func testI09RotationEndAndReset() throws {
        try prepare(); let host = try normalizedHost(); try seek(3)
        try setFlag("active", false, "G04 IND activity")
        try orient(.landscapeLeft); try verify(3, "IND-rotated-inactive-zero")
        XCTAssertEqual(hostState(), host); XCTAssertEqual(try state()["active"] as? Bool, false)
        try orient(.portrait); try sameRoot(state()); try sameOwnedRoot(state())
        XCTAssertEqual(hostState(), host); try endReachable("IND-actual-end")
        let old = try number(state(), "rootTag")
        tap("Reset scene"); tap("Indicator/Segment scene")
        wait("Actual reset restores active circle size10 horizontal host defaults") {
            let current = self.hostState()
            return current.contains("Indicator: active") && current.contains("Shape: circle")
                && current.contains("Size: 10.") && current.contains("Segment token: horizontal")
        }
        tap("G04 prepare Indicator")
        wait("Fresh default Indicator root after explicit scene reset") {
            guard let row = try? self.state(), let tag = row["rootTag"] as? NSNumber else { return false }
            return tag.doubleValue > 0 && tag.doubleValue != old && row["case"] as? String == self.cases[0].0
                && row["active"] as? Bool == true && (row["actions"] as? NSNumber)?.intValue == 0
        }
        original = try state(); try verify(0, "IND-actual-reset-default")
    }
    func testI10ShapeGeometry() throws {
        try prepare(); try seek(2)
        try shape("square"); try verify(2, "IND-fractional-square", focused: true)
        try shape("circle"); try verify(2, "IND-fractional-circle", focused: true)
        try shape("rounded"); try verify(2, "IND-fractional-rounded-restored", focused: true)
    }
    func testI11CallbackFinalStyle() throws {
        try prepare(); try seek(6); try setFlag("active", false, "G04 IND activity")
        try verify(6, "IND-callback-inactive-width28", focused: true)
        try setFlag("zeroOpacity", true, "G04 IND zero opacity"); try verify(6, "IND-callback-zero-opacity", focused: true)
        try setFlag("zeroOpacity", false, "G04 IND zero opacity"); try verify(6, "IND-callback-opacity-restored", focused: true)
    }

}

// Infrastructure diagnostic only. Does not launch, navigate, mutate, or qualify Indicator.
final class IndicatorG04AXInitializationProbe: XCTestCase {
    func testAXInitializationOnly() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
        XCTAssertEqual(app.state, .runningForeground, "GUI admission must leave the existing app foreground")
        XCTAssertTrue(app.windows.firstMatch.waitForExistence(timeout: nativeWorkRemaining()))
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        let root = try app.snapshot()
        var elements: [XCUIElementSnapshot] = []
        func visit(_ item: XCUIElementSnapshot) {
            elements.append(item)
            for child in item.children { visit(child) }
        }
        visit(root)
        let window = try XCTUnwrap(elements.first { $0.elementType == .window })
        XCTAssertGreaterThan(window.frame.width, 0)
        XCTAssertGreaterThan(window.frame.height, 0)
        XCTAssertTrue(elements.contains { $0.elementType == .staticText && $0.label == "Codon native showcase" }, "Actual existing Display scene")
        XCTAssertTrue(elements.contains { $0.elementType == .button && $0.label == "Indicator/Segment scene" }, "Current fixture present without entering a component method")
        XCTAssertEqual(app.state, .runningForeground)
        let row: [String: Any] = [
            "diagnosticOnly": true, "componentQualificationClaim": false,
            "appBundleIdentifier": "dev.codonui.showcase", "foreground": true,
            "window": [window.frame.minX, window.frame.minY, window.frame.width, window.frame.height],
            "snapshotElementCount": elements.count,
            "sceneHeading": "Codon native showcase", "fixtureControl": "Indicator/Segment scene",
            "actionsPerformed": [], "epochSeconds": Date().timeIntervalSince1970,
        ]
        let data = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys, .prettyPrinted])
        FileHandle.standardOutput.write(Data("AX-INITIALIZATION-PROBE ".utf8) + data + Data("\n".utf8))
        let receipt = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        receipt.name = "AX-initialization-only-receipt"; receipt.lifetime = .keepAlways; add(receipt)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "AX-initialization-only-screen"; shot.lifetime = .keepAlways; add(shot)
    }
}
