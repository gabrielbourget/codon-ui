// Host SwiftUI reference-validity test only. No UIKit app, target pixels or drawing acceptance.
// Scaling scalar continuous paths cannot certify the public native elliptical path near overlap.
import SwiftUI
import Foundation

struct ReferenceProfile {
  let name: String
  let bounds: CGSize
  let radius: CGFloat
  let scale: CGSize
  let expectsAffineEquality: Bool
}

func curvePackets(_ path: CGPath) -> [[CGFloat]] {
  var current = CGPoint.zero
  var result: [[CGFloat]] = []
  path.applyWithBlock { pointer in
    let element = pointer.pointee
    switch element.type {
    case .moveToPoint, .addLineToPoint: current = element.points[0]
    case .addCurveToPoint:
      result.append([current.x, current.y, element.points[0].x, element.points[0].y,
        element.points[1].x, element.points[1].y, element.points[2].x, element.points[2].y])
      current = element.points[2]
    case .addQuadCurveToPoint: current = element.points[1]
    default: break
    }
  }
  return result
}

func curveDifference(_ first: CGPath, _ second: CGPath) -> CGFloat {
  let original = curvePackets(first), actual = curvePackets(second)
  guard original.count == actual.count else { return .infinity }
  return original.map { packet in
    actual.map { other in
      let reversed = [other[6], other[7], other[4], other[5], other[2], other[3], other[0], other[1]]
      return min(zip(packet, other).map { abs($0 - $1) }.max()!,
        zip(packet, reversed).map { abs($0 - $1) }.max()!)
    }.min()!
  }.max() ?? 0
}

let profiles = [
  ReferenceProfile(name: "both-spans-meet", bounds: CGSize(width: 120, height: 80), radius: 40,
    scale: CGSize(width: 0.2, height: 3), expectsAffineEquality: false),
  ReferenceProfile(name: "vertical-spans-meet", bounds: CGSize(width: 120, height: 80), radius: 30,
    scale: CGSize(width: 0.2, height: 3), expectsAffineEquality: false),
  ReferenceProfile(name: "horizontal-spans-meet", bounds: CGSize(width: 25, height: 100), radius: 10,
    scale: CGSize(width: 0.2, height: 3), expectsAffineEquality: false),
  ReferenceProfile(name: "separate-spans", bounds: CGSize(width: 120, height: 80), radius: 20,
    scale: CGSize(width: 0.4, height: 1), expectsAffineEquality: true),
]

var results: [[String: Any]] = []
for profile in profiles {
  let base = CGRect(origin: .zero, size: profile.bounds)
  let bounds = CGRect(x: 0, y: 0, width: base.width * profile.scale.width, height: base.height * profile.scale.height)
  let scalar = Path(roundedRect: base, cornerSize: CGSize(width: profile.radius, height: profile.radius), style: .continuous).cgPath
  var transform = CGAffineTransform(scaleX: profile.scale.width, y: profile.scale.height)
  let scaledScalar = scalar.copy(using: &transform)!
  let nativeEllipse = Path(roundedRect: bounds, cornerSize: CGSize(width: profile.radius * profile.scale.width,
    height: profile.radius * profile.scale.height), style: .continuous).cgPath
  let difference = curveDifference(scaledScalar, nativeEllipse)
  var occupancyDifferences = 0
  for x in 0..<192 { for y in 0..<192 {
    let point = CGPoint(x: (CGFloat(x) + 0.5) / 192 * bounds.width, y: (CGFloat(y) + 0.5) / 192 * bounds.height)
    if scaledScalar.contains(point) != nativeEllipse.contains(point) { occupancyDifferences += 1 }
  } }
  let tolerance = CGFloat(Float(max(bounds.width, bounds.height)).ulp) * 8
  if profile.expectsAffineEquality {
    precondition(difference <= tolerance && occupancyDifferences == 0, "Separated-span reference changed")
  } else {
    precondition(difference > tolerance && occupancyDifferences > 0, "Expected overlap counterexample no longer reproduces")
  }
  results.append(["name": profile.name, "maximumCurveDifference": difference,
    "occupancyDifferences": occupancyDifferences, "samples": 192 * 192,
    "affineReferenceValid": profile.expectsAffineEquality])
}
let data = try JSONSerialization.data(withJSONObject: ["scope": "Host reference-validity counterexamples only",
  "profiles": results, "fullCard": false, "fullGoal": false], options: [.sortedKeys])
print(String(data: data, encoding: .utf8)!)
