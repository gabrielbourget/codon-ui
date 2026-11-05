import Foundation
import CoreGraphics
import ImageIO

// One stdin JSON request; native zero/full/current PNGs, no package dependency.
struct Observation: Decodable {
    let png: String
    let rootRect: [Double]
    let screenRect: [Double]
}
struct Request: Decodable {
    let zero: Observation
    let full: Observation
    let current: Observation
    let pixelsPerLogicalPoint: Double
    let expectedFraction: Double?
    let expectedPresentation: String?
    let quantizationPixels: Int
}
struct Paint {
    let width: Int
    let height: Int
    let bytes: [UInt8]
    let crop: CGRect
}
enum Invalid: Error { case observation(String) }
func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw Invalid.observation(message) }
}
func paint(_ observation: Observation) throws -> Paint {
    try require(observation.rootRect.count == 4 && observation.screenRect.count == 4, "Rects are actual native x,y,width,height")
    let r = observation.rootRect, s = observation.screenRect
    try require((r + s).allSatisfy { $0.isFinite } && r[2] > 0 && r[3] > 0 && s[2] > 0 && s[3] > 0, "Positive finite native rects required")
    let root = CGRect(x: r[0], y: r[1], width: r[2], height: r[3]), screen = CGRect(x: s[0], y: s[1], width: s[2], height: s[3])
    try require(screen.contains(root), "Actual root must be wholly on actual screen")
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: observation.png) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw Invalid.observation("Unreadable native PNG") }
    let sx = Double(image.width) / s[2], sy = Double(image.height) / s[3]
    try require(abs(sx - sy) < 0.01, "Native screenshot scale mismatch")
    let rectangle = CGRect(x: ((r[0] - s[0]) * sx).rounded(), y: ((r[1] - s[1]) * sy).rounded(), width: (r[2] * sx).rounded(), height: (r[3] * sy).rounded())
    guard let cropped = image.cropping(to: rectangle) else { throw Invalid.observation("Native crop unavailable") }
    var bytes = [UInt8](repeating: 0, count: cropped.width * cropped.height * 4)
    let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: cropped.width, height: cropped.height, bitsPerComponent: 8, bytesPerRow: cropped.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
        context.draw(cropped, in: CGRect(x: 0, y: 0, width: CGFloat(cropped.width), height: CGFloat(cropped.height)))
        return true
    }
    try require(drawn, "Native image decode failed")
    return Paint(width: cropped.width, height: cropped.height, bytes: bytes, crop: rectangle)
}
func output(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: .sortedKeys) {
        FileHandle.standardOutput.write(data + Data("\n".utf8))
    }
}
do {
    let request = try JSONDecoder().decode(Request.self, from: FileHandle.standardInput.readDataToEndOfFile())
    try require(request.quantizationPixels == 2 && request.pixelsPerLogicalPoint.isFinite && request.pixelsPerLogicalPoint > 0, "Fixed two-pixel quantization and actual display scale required")
    let zero = try paint(request.zero), full = try paint(request.full), current = try paint(request.current)
    try require(zero.width == full.width && zero.height == full.height && zero.width == current.width && zero.height == current.height, "Actual native crop dimensions changed")
    var best: [Int] = [], row = 0
    for y in 0..<zero.height {
        let contrast = (0..<zero.width).map { x -> Int in
            let offset = (y * zero.width + x) * 4
            return (0..<3).reduce(0) { $0 + abs(Int(full.bytes[offset + $1]) - Int(zero.bytes[offset + $1])) }
        }
        let peak = contrast.max() ?? 0
        let xs = contrast.indices.filter { peak > 0 && contrast[$0] * 4 >= peak }
        if xs.count > best.count { best = xs; row = y }
    }
    guard let first = best.first, let last = best.last else { throw Invalid.observation("Native zero/full paint has no measurable contrast") }
    try require(best.count == last - first + 1, "Native full interior paint span is not contiguous")
    try require(Double(first) <= request.pixelsPerLogicalPoint * 2 + 2 && Double(full.width - 1 - last) <= request.pixelsPerLogicalPoint * 2 + 2, "Full native paint does not approach actual root edges")
    func painted(_ x: Int, _ y: Int, _ cutoff: Double) -> Bool {
        let offset = (y * zero.width + x) * 4
        var dot = 0.0, length = 0.0
        for channel in 0..<3 {
            let delta = Double(full.bytes[offset + channel]) - Double(zero.bytes[offset + channel])
            dot += (Double(current.bytes[offset + channel]) - Double(zero.bytes[offset + channel])) * delta
            length += delta * delta
        }
        return length > 0 && dot / length >= cutoff
    }
    var result: [String: Any] = ["row": row, "firstPixel": first, "lastPixel": last, "baselinePixels": best.count, "cropPixels": [current.width, current.height], "nativePixelCrops": [zero.crop.debugDescription, full.crop.debugDescription, current.crop.debugDescription]]
    if request.expectedPresentation == "unknown" {
        let xs = (0..<current.height).flatMap { y in best.filter { painted($0, y, 0.25) } }
        guard let low = xs.min(), let high = xs.max() else { throw Invalid.observation("Actual centered unknown paint is absent") }
        try require(Double(low - first) / Double(best.count) > 0.25 && Double(high - first) / Double(best.count) < 0.75, "Unknown native paint is anchored or outside the actual center")
        result.merge(["status": "PASS", "expectedPresentation": "unknown", "firstPaintPixel": low, "lastPaintPixel": high, "observedPaintPixels": xs.count]) { _, value in value }
    } else {
        guard let expected = request.expectedFraction else { throw Invalid.observation("Expected fraction or unknown presentation required") }
        try require(expected.isFinite && expected >= 0 && expected <= 1, "Bounded expected fraction required")
        let count = best.filter { painted($0, row, 0.5) }.count
        let observed = Double(count) / Double(best.count), tolerance = Double(request.quantizationPixels) / Double(best.count)
        result.merge(["status": abs(observed - expected) <= tolerance ? "PASS" : "FAIL", "expectedFraction": expected, "observedFraction": observed, "filledPixels": count, "tolerance": tolerance]) { _, value in value }
        output(result)
        exit(abs(observed - expected) <= tolerance ? 0 : 1)
    }
    output(result)
} catch {
    output(["status": "ERROR", "error": String(describing: error)])
    exit(2)
}
