import XCTest
import CoreGraphics

final class PlaceholderG04TrialTests: XCTestCase {
    private var app: XCUIApplication!
    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 180
        app = XCUIApplication(bundleIdentifier: "dev.codonui.showcase")
        XCTAssertEqual(app.state, .runningForeground)
        XCUIDevice.shared.orientation = .portrait
        try tap("Live window")
        try tap("Light theme")
        try tap("Text/Button scene")
        XCTAssertTrue(node("placeholder-g02-state").waitForExistence(timeout: 5))
        try tap("Reset scene")
        try tap("G02 prepare placeholder")
        XCTAssertEqual(try state()["actions"] as? Int, 0)
    }
    private func node(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func reveal(_ element: XCUIElement) throws {
        XCTAssertTrue(element.waitForExistence(timeout: 5))
        let scroll = app.scrollViews.firstMatch
        for _ in 0..<20 {
            if scroll.frame.insetBy(dx: 1, dy: 8).contains(element.frame) && element.isHittable { return }
            let upward = element.frame.minY < scroll.frame.minY
            scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.3 : 0.75))
                .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: upward ? 0.7 : 0.35)))
        }
        XCTFail("Original visible control unreachable: " + element.identifier)
    }
    private func tap(_ label: String) throws {
        let button = app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
        try reveal(button)
        button.tap()
    }
    private func state() throws -> [String: Any] {
        let value = try XCTUnwrap(try JSONSerialization.jsonObject(with: Data(node("placeholder-g02-state").label.utf8)) as? [String: Any])
        XCTAssertEqual(value["dropped"] as? Int, 0)
        XCTAssertGreaterThan(try XCTUnwrap(value["rootTag"] as? Int), 0)
        return value
    }
    private func retain(_ original: [String: Any], _ current: [String: Any]) {
        for key in ["rootTag", "refIdentity", "attaches", "detaches"] { XCTAssertEqual(original[key] as? Int, current[key] as? Int, key) }
    }
    private func mark(_ name: String, _ value: [String: Any]) throws {
        let attachment = XCTAttachment(data: try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), uniformTypeIdentifier: "public.json")
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
        try mark(name + "-native", ["name": name, "text": text, "frame": [frame.minX, frame.minY, frame.width, frame.height], "screen": [screen.minX, screen.minY, screen.width, screen.height], "opaquePixels": count, "expectedRGBA": rgb + [255], "state": before])
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
        XCTAssertEqual(XCTWaiter.wait(for: [action], timeout: 5), .completed)
        let after = try state()
        retain(original, after)
        let rows = try XCTUnwrap(after["receipts"] as? [[String: Any]])
        XCTAssertEqual(rows.compactMap { $0["kind"] as? String }, ["pressIn", "pressOut", "press"])
        for row in rows { XCTAssertEqual((row["native"] as? [String: Any])?["target"] as? Int, original["rootTag"] as? Int) }
        _ = try observe("narrow-after-first-action", rgb: [126,34,206], text: "Deferred owner content", original: original)
        try tap("Live window")
        try tap("Reset scene")
        try tap("G02 prepare placeholder")
        let reset = try state()
        XCTAssertEqual(reset["actions"] as? Int, 0)
        _ = try observe("reset-default", rgb: [112,112,112], text: "Choose an item", original: reset)
    }
}
