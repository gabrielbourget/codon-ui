// Non-shipping, unmounted UIKit primitive reference. This is not mounted Card/GPU acceptance.
// Compile with the actual production Swift corner bridge; never substitute a host facade here.
import Foundation
import UIKit
import QuartzCore
import Darwin

let sourceProducer = "UNFROZEN"
let artifactDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let pixelScale: CGFloat = 3

struct PixelImage {
  let bytes: [UInt8]
  let width: Int
  let height: Int
  let image: CGImage
}

func raster(_ layer: CALayer, size: CGSize, transform: CGSize = CGSize(width: 1, height: 1)) -> PixelImage {
  let width = Int(ceil(size.width * pixelScale)), height = Int(ceil(size.height * pixelScale))
  var bytes = [UInt8](repeating: 0, count: width * height * 4)
  let image = bytes.withUnsafeMutableBytes { buffer -> CGImage in
    let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
    context.scaleBy(x: pixelScale * transform.width, y: pixelScale * transform.height)
    layer.render(in: context)
    return context.makeImage()!
  }
  return PixelImage(bytes: bytes, width: width, height: height, image: image)
}

func nativeLayer(size: CGSize, radius: CGFloat, continuous: Bool) -> CALayer {
  let layer = CALayer()
  layer.frame = CGRect(origin: .zero, size: size)
  layer.backgroundColor = UIColor.white.cgColor
  layer.cornerRadius = radius
  layer.cornerCurve = continuous ? .continuous : .circular
  layer.masksToBounds = true
  layer.contentsScale = pixelScale
  layer.displayIfNeeded()
  return layer
}

func differences(_ first: PixelImage, _ second: PixelImage) -> [String: Int] {
  precondition(first.width == second.width && first.height == second.height)
  var different = 0, significant = 0, binary = 0, total = 0, maximum = 0
  for index in stride(from: 3, to: first.bytes.count, by: 4) {
    let left = Int(first.bytes[index]), right = Int(second.bytes[index]), delta = abs(left - right)
    if delta > 0 { different += 1 }
    if delta > 16 { significant += 1 }
    if (left >= 128) != (right >= 128) { binary += 1 }
    total += delta
    maximum = max(maximum, delta)
  }
  return ["differentAlphaPixels": different, "significantAlphaPixels": significant,
    "binaryCoverageDifferences": binary, "totalAlphaDifference": total, "maximumAlphaDifference": maximum,
    "pixels": first.width * first.height]
}

func save(_ image: PixelImage, name: String) throws {
  try UIImage(cgImage: image.image, scale: pixelScale, orientation: .up).pngData()!
    .write(to: artifactDirectory.appendingPathComponent(name), options: .atomic)
}

func emit(_ value: [String: Any]) {
  let data = try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
  print("CUI_DRAWING_UIKIT " + String(data: data, encoding: .utf8)!)
  fflush(stdout)
}

precondition(Thread.isMainThread, "Actual UIKit reference requires the main thread")
CATransaction.begin()
CATransaction.setDisableActions(true)
emit(["kind": "begin", "producer": sourceProducer, "pid": ProcessInfo.processInfo.processIdentifier,
  "systemVersion": UIDevice.current.systemVersion, "scale": pixelScale,
  "scope": "Unmounted native CALayer CPU raster and exact production Swift path only"])

let controlSize = CGSize(width: 120, height: 80)
let continuousControl = raster(nativeLayer(size: controlSize, radius: 20, continuous: true), size: controlSize)
let circularControl = raster(nativeLayer(size: controlSize, radius: 20, continuous: false), size: controlSize)
let control = differences(continuousControl, circularControl)
try save(continuousControl, name: "control-native-continuous.png")
try save(circularControl, name: "control-native-circular.png")
emit(["kind": "reference-control", "producer": sourceProducer, "metrics": control])
if control["binaryCoverageDifferences"]! == 0 {
  emit(["kind": "terminal", "producer": sourceProducer, "outcome": "native-reference-capability-unavailable",
    "reason": "CALayer CPU raster did not expose a continuous-versus-circular coverage distinction",
    "fullCard": false, "fullGoal": false])
  CATransaction.commit()
  exit(2)
}

let guardMask = CUIProbeNativeContinuousMask(CGRect(origin: .zero, size: controlSize), CGSize(width: 10, height: 40), pixelScale)!
precondition(CUIProbeNativeContinuousMaskDescription(guardMask) != nil)
precondition(CUIProbeNativeContinuousMaskDescription(CALayer()) == nil, "Foreign native mask must not gain description authority")
guardMask.opacity = 0.5
precondition(CUIProbeNativeContinuousMaskDescription(guardMask) == nil, "Modified mask opacity must reject")
guardMask.opacity = 1
precondition(CUIProbeNativeContinuousMaskDescription(guardMask) != nil)
precondition(CUIProbeNativeContinuousMask(CGRect(x: 0, y: 0, width: -1, height: 80), CGSize(width: 10, height: 40), pixelScale) == nil)
precondition(CUIProbeNativeContinuousMask(CGRect(origin: .zero, size: controlSize), CGSize(width: CGFloat.nan, height: 40), pixelScale) == nil)
precondition(CUIProbeNativeContinuousMask(CGRect(origin: .zero, size: controlSize), CGSize(width: 10, height: 40), 0) == nil)
let emptyMask = CUIProbeNativeContinuousMask(.zero, CGSize(width: 10, height: 40), pixelScale)!
precondition(CUIProbeNativeContinuousMaskDescription(emptyMask) != nil, "Empty native bounds remain supported")
let squareMask = CUIProbeNativeContinuousMask(CGRect(origin: .zero, size: controlSize), CGSize(width: 0, height: 40), pixelScale)!
precondition(squareMask.cornerRadius == 0 && CUIProbeNativeContinuousMaskDescription(squareMask) != nil)
emit(["kind": "factory-guards", "producer": sourceProducer, "outcome": "guards-complete",
  "scope": "Actual private ObjC-to-Swift factory/describer only; no receiver or clipping admission"])

let receiverAssertions = CUIProbeRunDrawingReceiverAssertions()
emit(["kind": "receiver-assertions", "producer": sourceProducer, "result": receiverAssertions])
if receiverAssertions["outcome"] as? String != "receiver-assertions-complete" {
  emit(["kind": "terminal", "producer": sourceProducer, "outcome": "native-receiver-assertions-failed",
    "fullCard": false, "fullGoal": false])
  CATransaction.commit()
  exit(3)
}

struct DrawingProfile {
  let name: String
  let radius: CGFloat
  let projection: CGSize
}
let profiles = [
  DrawingProfile(name: "native-r4", radius: 4, projection: CGSize(width: 1, height: 1)),
  DrawingProfile(name: "native-r20", radius: 20, projection: CGSize(width: 1, height: 1)),
  DrawingProfile(name: "native-r30-overlap", radius: 30, projection: CGSize(width: 1, height: 1)),
  DrawingProfile(name: "native-r40-overlap", radius: 40, projection: CGSize(width: 1, height: 1)),
  DrawingProfile(name: "corrected-separate", radius: 20, projection: CGSize(width: 2, height: 0.8)),
  DrawingProfile(name: "corrected-horizontal-overlap", radius: 20, projection: CGSize(width: 56.0 / 120.0, height: 1)),
  DrawingProfile(name: "corrected-vertical-overlap", radius: 20, projection: CGSize(width: 1.5, height: 0.6)),
]
for profile in profiles {
  let size = CGSize(width: controlSize.width * profile.projection.width, height: controlSize.height * profile.projection.height)
  let reference = raster(nativeLayer(size: size, radius: profile.radius, continuous: true), size: size)
  let corrected = CGSize(width: profile.radius / profile.projection.width, height: profile.radius / profile.projection.height)
  let path = CUIMotionContinuousCorners.path(bounds: CGRect(origin: .zero, size: controlSize),
    topLeft: corrected, topRight: corrected, bottomLeft: corrected, bottomRight: corrected,
    continuousCorners: UIRectCorner.allCorners.rawValue)!
  let owned = CAShapeLayer()
  owned.frame = CGRect(origin: .zero, size: controlSize)
  owned.path = path.cgPath
  owned.fillColor = UIColor.white.cgColor
  owned.contentsScale = pixelScale
  let actual = raster(owned, size: size, transform: profile.projection)
  try save(reference, name: profile.name + "-native.png")
  try save(actual, name: profile.name + "-owned.png")
  emit(["kind": "profile", "producer": sourceProducer, "name": profile.name,
    "radius": profile.radius, "projection": [profile.projection.width, profile.projection.height],
    "metrics": differences(reference, actual), "scope": "Characterization only; no pixel tolerance or full drawing acceptance"])

  let circularReference = raster(nativeLayer(size: size, radius: profile.radius, continuous: false), size: size)
  let circularPath = CUIMotionContinuousCorners.path(bounds: CGRect(origin: .zero, size: controlSize),
    topLeft: corrected, topRight: corrected, bottomLeft: corrected, bottomRight: corrected, continuousCorners: 0)!
  let circularOwned = CAShapeLayer()
  circularOwned.frame = CGRect(origin: .zero, size: controlSize)
  circularOwned.path = circularPath.cgPath
  circularOwned.fillColor = UIColor.white.cgColor
  circularOwned.contentsScale = pixelScale
  let circularActual = raster(circularOwned, size: size, transform: profile.projection)
  let circularName = profile.name + "-circular"
  try save(circularReference, name: circularName + "-native.png")
  try save(circularActual, name: circularName + "-owned.png")
  emit(["kind": "raster-control", "producer": sourceProducer, "name": circularName,
    "metrics": differences(circularReference, circularActual), "scope": "Known circular geometry raster baseline only"])

  let normalizedSize = CGSize(width: controlSize.width / corrected.width, height: controlSize.height / corrected.height)
  let nativeCandidate = nativeLayer(size: normalizedSize, radius: 1, continuous: true)
  let candidateActual = raster(nativeCandidate, size: size,
    transform: CGSize(width: corrected.width * profile.projection.width, height: corrected.height * profile.projection.height))
  let candidateName = profile.name + "-native-layer"
  try save(candidateActual, name: candidateName + "-owned.png")
  emit(["kind": "native-layer-candidate", "producer": sourceProducer, "name": candidateName,
    "referenceImage": profile.name + "-native.png", "ownedImage": candidateName + "-owned.png",
    "metrics": differences(reference, candidateActual), "scope": "Unaccepted public CALayer normalization candidate only"])

  let maskCandidate = nativeLayer(size: normalizedSize, radius: 0, continuous: true)
  var holder = maskCandidate
  for corner in [CACornerMask.layerMinXMinYCorner, .layerMaxXMinYCorner, .layerMaxXMaxYCorner, .layerMinXMaxYCorner] {
    let mask = nativeLayer(size: normalizedSize, radius: 1, continuous: true)
    mask.maskedCorners = corner
    holder.mask = mask
    holder = mask
  }
  let maskActual = raster(maskCandidate, size: size,
    transform: CGSize(width: corrected.width * profile.projection.width, height: corrected.height * profile.projection.height))
  let maskName = profile.name + "-native-mask"
  try save(maskActual, name: maskName + "-owned.png")
  emit(["kind": "native-mask-candidate", "producer": sourceProducer, "name": maskName,
    "referenceImage": profile.name + "-native.png", "ownedImage": maskName + "-owned.png",
    "metrics": differences(reference, maskActual), "scope": "Unaccepted four public corner-mask composition candidate only"])

  let factoryRoot = nativeLayer(size: controlSize, radius: 0, continuous: true)
  let factoryMask = CUIProbeNativeContinuousMask(CGRect(origin: .zero, size: controlSize), corrected, pixelScale)!
  let factoryDescription = CUIProbeNativeContinuousMaskDescription(factoryMask)!
  factoryRoot.mask = factoryMask
  let factoryActual = raster(factoryRoot, size: size, transform: profile.projection)
  precondition((CUIProbeNativeContinuousMaskDescription(factoryMask)! as NSDictionary).isEqual(factoryDescription),
    "Native mask description must survive attachment and rasterization unchanged")
  let factoryName = profile.name + "-factory-mask"
  try save(factoryActual, name: factoryName + "-owned.png")
  emit(["kind": "factory-mask-candidate", "producer": sourceProducer, "name": factoryName,
    "referenceImage": profile.name + "-native.png", "ownedImage": factoryName + "-owned.png",
    "description": factoryDescription, "metrics": differences(reference, factoryActual),
    "scope": "Actual unwired private mask factory through its typed ObjC bridge only"])
}
CATransaction.commit()
emit(["kind": "terminal", "producer": sourceProducer, "outcome": "native-reference-characterization-complete",
  "profiles": profiles.count, "rasterControls": profiles.count, "nativeLayerCandidates": profiles.count, "nativeMaskCandidates": profiles.count, "factoryMaskCandidates": profiles.count,
  "fullCard": false, "fullGoal": false])
