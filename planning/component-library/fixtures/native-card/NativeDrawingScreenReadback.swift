// Original screenshot readback only. No image tolerance or native execution.
import Foundation
import ImageIO
import CoreGraphics
import CryptoKit

let arguments = CommandLine.arguments
func require(_ condition: @autoclosure () -> Bool, _ message: String = "Original screenshot metadata or pixel control failed") {
  if !condition() {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
  }
}
require(arguments.count == 4, "Screenshot, original ready record and result path required")
let row = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: arguments[2]))) as! [String: Any]
let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: arguments[1]) as CFURL, nil)!
let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
let width = image.width, height = image.height
let density = (row["density"] as! NSNumber).doubleValue
let screen = row["screen"] as! [String: NSNumber]
require(density > 0 && Double(width) == screen["width"]!.doubleValue * density && Double(height) == screen["height"]!.doubleValue * density)
let frames = row["frames"] as! [[NSNumber]]
require(frames.count == 3 && frames.allSatisfy { $0.count == 4 })
var bytes = [UInt8](repeating: 0, count: width * height * 4)
bytes.withUnsafeMutableBytes { buffer in
  let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
  context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
}
func pixel(_ x: Int, _ y: Int, flip: Bool) -> [UInt8] {
  require(x >= 0 && x < width && y >= 0 && y < height)
  let offset = ((flip ? height - 1 - y : y) * width + x) * 4
  return Array(bytes[offset..<offset + 4])
}
let marker = frames[2].map(\.doubleValue)
require(marker[2] == 32 && marker[3] == 8)
let step = (row["step"] as! NSNumber).intValue
func markerMatches(_ flip: Bool) -> Bool {
  for bit in 0..<8 {
    let value: UInt8 = ((step + 1) & (1 << bit)) != 0 ? 0 : 255
    if pixel(Int(((marker[0] + Double(bit * 4 + 2)) * density).rounded()),
      Int(((marker[1] + 4) * density).rounded()), flip: flip) != [value, value, value, 255] { return false }
  }
  return true
}
let orientations = [false, true].filter(markerMatches)
require(orientations.count == 1, "Original displayed phase marker missing or ambiguous")
let flip = orientations[0]
let cropWidth = Int(168 * density), cropHeight = Int(128 * density), margin = Int(24 * density)
func crop(_ frame: [NSNumber]) -> [UInt8] {
  let values = frame.map(\.doubleValue)
  require(values[2] == 120 && values[3] == 80)
  let pointX = (values[0] - 24) * density, pointY = (values[1] - 24) * density
  require(abs(pointX - pointX.rounded()) < 0.00001 && abs(pointY - pointY.rounded()) < 0.00001)
  let x = Int(pointX.rounded()), y = Int(pointY.rounded())
  require(x >= 0 && y >= 0 && x + cropWidth <= width && y + cropHeight <= height)
  var result = [UInt8](); result.reserveCapacity(cropWidth * cropHeight * 4)
  for row in 0..<cropHeight { for column in 0..<cropWidth { result.append(contentsOf: pixel(x + column, y + row, flip: flip)) } }
  return result
}
let native = crop(frames[0]), owned = crop(frames[1])
let center = ((margin + Int(40 * density)) * cropWidth + margin + Int(60 * density)) * 4
let centerRGB = Array(native[center..<center + 3])
require(centerRGB != [255, 255, 255] && native[center + 3] == 255, "Nonblank original reference required")
var changed = 0, maximum = 0, body = 0, accent = 0, outside = 0
for offset in native.indices {
  let delta = abs(Int(native[offset]) - Int(owned[offset]))
  if delta != 0 { changed += 1 }; maximum = max(maximum, delta)
  if offset % 4 != 0 { continue }
  let rgb = Array(native[offset..<offset + 3]), nonwhite = rgb != [255, 255, 255]
  if nonwhite { body += 1 }
  if nonwhite && zip(rgb, centerRGB).contains(where: { abs(Int($0.0) - Int($0.1)) > 32 }) { accent += 1 }
  let index = offset / 4, x = index % cropWidth, y = index / cropWidth
  if nonwhite && (x < margin - Int(density) || x >= margin + Int(121 * density) || y < margin - Int(density) || y >= margin + Int(81 * density)) { outside += 1 }
}
let control = row["control"] as! String
let controlPassed = body > Int(120 * 80 * density * density / 2) &&
  (!["border", "outline", "inset-shadow"].contains(control) || accent > 0) &&
  (!["outline", "outer-shadow"].contains(control) || outside > 0)
let result: [String: Any] = ["producer": row["producer"]!, "nonce": row["nonce"]!, "pairIndex": row["pairIndex"]!,
  "step": step, "profile": row["profile"]!, "mode": row["mode"]!, "kind": row["kind"]!,
  "markerMatched": true, "flipY": flip, "imageWidth": width, "imageHeight": height, "cropWidth": cropWidth, "cropHeight": cropHeight,
  "referenceCenter": centerRGB, "referencePaintPixels": body, "referenceStrongAccentPixels": accent, "referenceOutsideInkPixels": outside,
  "referenceControlPassed": controlPassed, "changedBytes": changed, "maximumChannelDifference": maximum,
  "nativeSHA256": SHA256.hash(data: Data(native)).map { String(format: "%02x", $0) }.joined(),
  "ownedSHA256": SHA256.hash(data: Data(owned)).map { String(format: "%02x", $0) }.joined(),
  "fullCard": false, "fullGoal": false]
try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: arguments[3]), options: .atomic)
