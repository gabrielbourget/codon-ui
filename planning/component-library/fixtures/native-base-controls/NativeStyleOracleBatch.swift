import Foundation
import CoreGraphics
import ImageIO

// Draft, not compiled. One stdin JSON request, one stdout JSON result; no SDK/device action.
// {png,mode,screenRect,pixelsPerLogicalPoint,coordinatesPerLogicalPoint,
//  targetParentRect,referenceParentRect,targetLayout,referenceLayout}
// All rects are [x,y,width,height]. Parents/screen use the SAME actual screen units.
// Layouts are ORIGINAL native onLayout coordinates in logical points relative to each parent.
// Android: coordinatesPerLogicalPoint=density, pixelsPerLogicalPoint=density.
// iOS: coordinatesPerLogicalPoint=1, pixelsPerLogicalPoint=actual screenshot scale.
// Both parents must be measured 120x120, entirely visible, padding/border zero.
// Modes: center-rgba (positive visible root), absent-paint (zero/auto/opacity0).
// Geometry's one-physical-pixel rule belongs to the inspector; no color fuzz is added.
// Usage after separately authorized compilation: NativeStyleOracle < request.json > result.json
struct Request: Decodable {
    let png: String
    let mode: String
    let screenRect: [Double]
    let pixelsPerLogicalPoint: Double
    let coordinatesPerLogicalPoint: Double
    let targetParentRect: [Double]
    let referenceParentRect: [Double]
    let targetLayout: [Double]
    let referenceLayout: [Double]
}
struct Paint {
    let width: Int
    let height: Int
    let bytes: [UInt8]
    let crop: CGRect
    func rgba(_ x: Int, _ y: Int) -> [Int] {
        let offset = (y * width + x) * 4
        return (0..<4).map { Int(bytes[offset + $0]) }
    }
}
enum Invalid: Error { case observation(String) }
func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw Invalid.observation(message) }
}
func rect(_ values: [Double], positive: Bool) throws -> CGRect {
    try require(values.count == 4 && values.allSatisfy { $0.isFinite }, "Finite native [x,y,width,height] required")
    try require(positive ? values[2] > 0 && values[3] > 0 : values[2] >= 0 && values[3] >= 0, "Invalid native extent")
    return CGRect(x: values[0], y: values[1], width: values[2], height: values[3])
}
func array(_ r: CGRect) -> [Double] { [Double(r.minX), Double(r.minY), Double(r.width), Double(r.height)] }

// Same CGImage crop / DeviceRGB premultiplied RGBA decoding as maintained NativePaintOracle.swift.
func paint(_ image: CGImage, _ r: CGRect, _ screen: CGRect, _ sx: Double, _ sy: Double) throws -> Paint {
    try require(screen.contains(r) && r.width > 0 && r.height > 0, "Positive crop must be wholly on actual screen")
    let crop = CGRect(x: ((Double(r.minX) - Double(screen.minX)) * sx).rounded(),
                      y: ((Double(r.minY) - Double(screen.minY)) * sy).rounded(),
                      width: (Double(r.width) * sx).rounded(), height: (Double(r.height) * sy).rounded())
    try require(crop.width > 0 && crop.height > 0 && crop.minX >= 0 && crop.minY >= 0 && crop.maxX <= CGFloat(image.width) && crop.maxY <= CGFloat(image.height), "Rounded native crop must remain inside PNG")
    guard let cropped = image.cropping(to: crop) else { throw Invalid.observation("Native crop unavailable") }
    var bytes = [UInt8](repeating: 0, count: cropped.width * cropped.height * 4)
    let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
        guard let context = CGContext(data: buffer.baseAddress, width: cropped.width, height: cropped.height,
                                      bitsPerComponent: 8, bytesPerRow: cropped.width * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return false }
        context.draw(cropped, in: CGRect(x: 0, y: 0, width: CGFloat(cropped.width), height: CGFloat(cropped.height)))
        return true
    }
    try require(drawn, "Native image decode failed")
    return Paint(width: cropped.width, height: cropped.height, bytes: bytes, crop: crop)
}
func centers(_ length: Int) -> [Int] {
    length % 2 == 0 ? [length / 2 - 1, length / 2] : [length / 2]
}
func samples(_ p: Paint, _ root: CGRect, _ screen: CGRect, _ sx: Double, _ sy: Double, _ units: Double) -> [[String: Any]] {
    centers(p.height).flatMap { y in centers(p.width).map { x in
        let nativeX = (Double(p.crop.minX) + Double(x) + 0.5) / sx + Double(screen.minX)
        let nativeY = (Double(p.crop.minY) + Double(y) + 0.5) / sy + Double(screen.minY)
        return ["cropPixel": [x, y], "rgba": p.rgba(x, y),
                "logicalOffsetFromRootOrigin": [(nativeX - Double(root.minX)) / units, (nativeY - Double(root.minY)) / units]]
    } }
}
func plateau(_ p: Paint) -> [String: Any] {
    let horizontal = p.width >= p.height, longCenter = horizontal ? p.width / 2 : p.height / 2
    let shortLength = horizontal ? p.height : p.width, middle = shortLength / 2
    func color(_ n: Int) -> [Int] { horizontal ? p.rgba(longCenter, n) : p.rgba(n, longCenter) }
    let value = color(middle)
    var low = middle, high = middle
    while low > 0 && color(low - 1) == value { low -= 1 }
    while high + 1 < shortLength && color(high + 1) == value { high += 1 }
    return ["shortAxis": horizontal ? "y" : "x", "longAxisPixel": longCenter,
            "firstPixel": low, "lastPixel": high, "matchingCenterPixels": high - low + 1, "rgba": value]
}
func root(_ parent: CGRect, _ layout: CGRect, _ units: Double) throws -> CGRect {
    let r = CGRect(x: Double(parent.minX) + Double(layout.minX) * units,
                   y: Double(parent.minY) + Double(layout.minY) * units,
                   width: Double(layout.width) * units, height: Double(layout.height) * units)
    try require(r.minX >= parent.minX && r.minY >= parent.minY && r.maxX <= parent.maxX && r.maxY <= parent.maxY, "Measured root must fit measured parent, including zero extents")
    return r
}
func background(_ p: Paint, _ root: CGRect, _ screen: CGRect, _ sx: Double, _ sy: Double) throws -> (Int, Int) {
    try require(p.width > 4 && p.height > 4, "Parent interior unavailable")
    let candidates = [(p.width - 2, p.height - 2), (1, p.height - 2), (p.width - 2, 1), (1, 1)]
    for (x, y) in candidates {
        let point = CGPoint(x: (Double(p.crop.minX) + Double(x) + 0.5) / sx + Double(screen.minX),
                            y: (Double(p.crop.minY) + Double(y) + 0.5) / sy + Double(screen.minY))
        if !root.contains(point) { return (x, y) }
    }
    throw Invalid.observation("No actual parent-background corner outside native root")
}
func absence(_ p: Paint, _ background: (Int, Int)) -> [String: Any] {
    let rgba = p.rgba(background.0, background.1)
    var unexpected = 0
    for y in 1..<(p.height - 1) {
        for x in 1..<(p.width - 1) { if p.rgba(x, y) != rgba { unexpected += 1 } }
    }
    return ["parentPixelCrop": array(p.crop), "cropPixels": [p.width, p.height],
            "excludedPhysicalEdgePixels": 1, "backgroundSamplePixel": [background.0, background.1],
            "backgroundRGBA": rgba, "interiorPixels": (p.width - 2) * (p.height - 2), "unexpectedPaintPixels": unexpected]
}
func output(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: .sortedKeys) {
        FileHandle.standardOutput.write(data + Data("\n".utf8))
    }
}
struct PixelRequest: Decodable {
    let png: String
    let points: [[Int]]
}
struct BatchItem: Decodable { let id: String; let requestJSON: String }
struct BatchInput: Decodable { let batch: [BatchItem] }

func evaluate(_ requestData: Data) -> ([String: Any], Int) {
    let fields = (try? JSONSerialization.jsonObject(with: requestData)) as? [String: Any]
    let pointRequest = fields?["points"] != nil
    do {
        if pointRequest {
            let request = try JSONDecoder().decode(PixelRequest.self, from: requestData)
            try require(!request.points.isEmpty && request.points.count <= 8192, "Require1to8192 actual integer pixel points")
            guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: request.png) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw Invalid.observation("Unreadable original PNG") }
            let screen = CGRect(x: 0, y: 0, width: image.width, height: image.height)
            var samples: [[String: Any]] = []
            for point in request.points {
                try require(point.count == 2 && point[0] >= 0 && point[1] >= 0 && point[0] < image.width && point[1] < image.height, "Actual integer sample outside original PNG")
                let crop = CGRect(x: point[0], y: point[1], width: 1, height: 1)
                let decoded = try paint(image, crop, screen, 1, 1)
                samples.append(["point": point, "crop": [Int(decoded.crop.minX), Int(decoded.crop.minY), decoded.width, decoded.height], "rgba": decoded.rgba(0, 0)])
            }
            let result: [String: Any] = ["status": "PASS", "png": request.png, "width": image.width, "height": image.height, "decoder": "Unchanged NativeStyleOracle paint: DeviceRGB premultipliedLast byteOrder32Big", "samples": samples]
            return (result, 0)
        }
        let q = try JSONDecoder().decode(Request.self, from: requestData)
        try require(["center-rgba", "absent-paint"].contains(q.mode), "Explicit center-rgba or absent-paint mode required")
        try require(q.pixelsPerLogicalPoint.isFinite && q.pixelsPerLogicalPoint > 0 && q.coordinatesPerLogicalPoint.isFinite && q.coordinatesPerLogicalPoint > 0, "Actual positive OS/screenshot scales required")
        let screen = try rect(q.screenRect, positive: true), targetParent = try rect(q.targetParentRect, positive: true), referenceParent = try rect(q.referenceParentRect, positive: true)
        let targetLayout = try rect(q.targetLayout, positive: false), referenceLayout = try rect(q.referenceLayout, positive: false)
        try require(screen.contains(targetParent) && screen.contains(referenceParent), "Both actual 120 parents must be wholly on screen")
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: q.png) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw Invalid.observation("Unreadable native PNG") }
        let sx = Double(image.width) / Double(screen.width), sy = Double(image.height) / Double(screen.height)
        try require(abs(sx - sy) < 0.000001 && abs(sx * q.coordinatesPerLogicalPoint - q.pixelsPerLogicalPoint) < 0.000001, "Actual PNG/native coordinate/OS scales disagree")
        for parent in [targetParent, referenceParent] {
            try require(abs(Double(parent.width) * sx - 120 * q.pixelsPerLogicalPoint) <= 1 && abs(Double(parent.height) * sy - 120 * q.pixelsPerLogicalPoint) <= 1, "Actual parent must be 120x120 within inspector one-physical-pixel geometry rule")
        }
        let targetRoot = try root(targetParent, targetLayout, q.coordinatesPerLogicalPoint), referenceRoot = try root(referenceParent, referenceLayout, q.coordinatesPerLogicalPoint)
        let tp = try paint(image, targetParent, screen, sx, sy), rp = try paint(image, referenceParent, screen, sx, sy)
        let tb = try background(tp, targetRoot, screen, sx, sy), rb = try background(rp, referenceRoot, screen, sx, sy)
        let backgroundsEqual = tp.rgba(tb.0, tb.1) == rp.rgba(rb.0, rb.1)
        var result: [String: Any] = ["mode": q.mode, "png": q.png, "pngPixels": [image.width, image.height],
            "screenRect": q.screenRect, "pixelsPerLogicalPoint": q.pixelsPerLogicalPoint, "coordinatesPerLogicalPoint": q.coordinatesPerLogicalPoint,
            "targetParentRect": q.targetParentRect, "referenceParentRect": q.referenceParentRect,
            "targetLayout": q.targetLayout, "referenceLayout": q.referenceLayout,
            "targetRootRect": array(targetRoot), "referenceRootRect": array(referenceRoot),
            "rounding": "PNG crop x,y,width,height each rounded to nearest physical pixel",
            "decoder": "DeviceRGB premultipliedLast byteOrder32Big RGBA; comparisons share one native PNG",
            "edgeRadiusReview": "Raw native PNG retained; no edge/radius equivalence inferred from center samples"]
        var failures: [String] = []
        if q.mode == "absent-paint" {
            let target = absence(tp, tb), reference = absence(rp, rb)
            if (target["unexpectedPaintPixels"] as? Int) != 0 { failures.append("Target parent interior contains pixels unequal to its actual background sample") }
            if (reference["unexpectedPaintPixels"] as? Int) != 0 { failures.append("Raw reference parent interior contains pixels unequal to its actual background sample") }
            result.merge(["target": target, "reference": reference, "backgroundsExactRGBAEqual": backgroundsEqual]) { _, value in value }
        } else {
            let target = try paint(image, targetRoot, screen, sx, sy), reference = try paint(image, referenceRoot, screen, sx, sy)
            let a = samples(target, targetRoot, screen, sx, sy, q.coordinatesPerLogicalPoint), b = samples(reference, referenceRoot, screen, sx, sy, q.coordinatesPerLogicalPoint)
            let referenceColor = b[0]["rgba"] as! [Int]
            let deltas = a.map { sample -> [Int] in
                zip(sample["rgba"] as! [Int], referenceColor).map { $0 - $1 }
            }
            let referenceDeltas = b.map { sample -> [Int] in
                zip(sample["rgba"] as! [Int], referenceColor).map { $0 - $1 }
            }
            let targetVisible = a.contains { ($0["rgba"] as! [Int]) != tp.rgba(tb.0, tb.1) }
            let referenceVisible = b.contains { ($0["rgba"] as! [Int]) != rp.rgba(rb.0, rb.1) }
            if !deltas.allSatisfy({ $0.allSatisfy { $0 == 0 } }) { failures.append("Actual target/reference center RGBA differ") }
            if !referenceDeltas.allSatisfy({ $0.allSatisfy { $0 == 0 } }) { failures.append("Raw reference center samples are not uniform RGBA") }
            if !targetVisible { failures.append("Target center does not contrast with its actual parent background") }
            if !referenceVisible { failures.append("Raw reference center does not contrast with its actual parent background") }
            result.merge(["targetPixelCrop": array(target.crop), "referencePixelCrop": array(reference.crop),
                          "targetCenterSamples": a, "referenceCenterSamples": b, "signedRGBADeltas": deltas,
                          "targetCenterSampleCount": a.count, "referenceCenterSampleCount": b.count,
                          "chosenReferenceCenterRGBA": referenceColor, "chosenReferenceCenterSampleIndex": 0,
                          "referenceCenterSignedRGBADeltas": referenceDeltas,
                          "targetCenterPlateau": plateau(target), "referenceCenterPlateau": plateau(reference),
                          "targetContrastsBackground": targetVisible, "referenceContrastsBackground": referenceVisible,
                          "targetBackgroundRGBA": tp.rgba(tb.0, tb.1), "referenceBackgroundRGBA": rp.rgba(rb.0, rb.1),
                          "colorTolerance": 0]) { _, value in value }
        }
        if !backgroundsEqual { failures.append("Actual target/reference parent background RGBA differ") }
        let passed = failures.isEmpty
        result["failureReasons"] = failures
        result["status"] = passed ? "PASS" : "FAIL"
        return (result, passed ? 0 : 1)
    } catch {
        return (["status": pointRequest ? "FAIL" : "ERROR", "error": String(describing: error)], pointRequest ? 1 : 2)
    }
}

do {
    let input = FileHandle.standardInput.readDataToEndOfFile()
    let fields = try JSONSerialization.jsonObject(with: input) as? [String: Any]
    if fields?["batch"] != nil {
        let request = try JSONDecoder().decode(BatchInput.self, from: input)
        try require(!request.batch.isEmpty && request.batch.count <= 128, "Finite batch requires1to128 existing requests")
        try require(Set(request.batch.map { $0.id }).count == request.batch.count, "Unique request IDs required")
        var results: [[String: Any]] = []
        var failures = 0
        for item in request.batch {
            try require(!item.id.isEmpty && item.requestJSON.utf8.count <= 4_000_000, "Bounded named request required")
            let started = ProcessInfo.processInfo.systemUptime
            let (result, code) = evaluate(Data(item.requestJSON.utf8))
            if code != 0 { failures += 1 }
            results.append(["id": item.id, "exitCode": code, "result": result,
                            "seconds": ProcessInfo.processInfo.systemUptime - started])
        }
        output(["status": "DECODE_BATCH_COMPLETE", "requestCount": request.batch.count,
                "errorCount": failures, "results": results, "sequential": true])
        exit(0) // Transport completion only. Every item retains its own original PASS/FAIL/ERROR and exit code.
    }
    let (result, code) = evaluate(input)
    output(result)
    exit(Int32(code))
} catch {
    output(["status": "ERROR", "error": String(describing: error)])
    exit(2)
}
