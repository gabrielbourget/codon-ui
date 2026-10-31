// Non-shipping exploratory candidate. Scalar host correspondence does not admit mixed elliptical drawing.
// Exact system curves are sampled in virtual rectangles; no production receiver uses this class.
// The separate affine-reference audit proves scaled scalar paths are not a valid overlap oracle.
import SwiftUI
import Foundation
final class UIBezierPath: NSObject {
  let cgPath: CGPath
  init(cgPath: CGPath) { self.cgPath = cgPath }
}
struct UIRectCorner {
  let rawValue: UInt
  static let topLeft = UIRectCorner(rawValue: 1)
  static let topRight = UIRectCorner(rawValue: 2)
  static let bottomLeft = UIRectCorner(rawValue: 4)
  static let bottomRight = UIRectCorner(rawValue: 8)
}


// System-generated curves are retained verbatim; no fitted control points or private drawing APIs.
@objc(CandidateVirtualCorners)
final class CandidateVirtualCorners: NSObject {
  private struct Segment {
    let kind: CGPathElementType
    let start: CGPoint
    let points: [CGPoint]

    var end: CGPoint { points.last ?? start }

    var reversed: Segment {
      switch kind {
      case .addCurveToPoint:
        return Segment(kind: kind, start: end, points: [points[1], points[0], start])
      case .addQuadCurveToPoint:
        return Segment(kind: kind, start: end, points: [points[0], start])
      default:
        return Segment(kind: .addLineToPoint, start: end, points: [start])
      }
    }
  }

  private struct Corner {
    let segments: [Segment]
    var start: CGPoint { segments.first?.start ?? .zero }
    var end: CGPoint { segments.last?.end ?? .zero }
    var width: CGFloat { max(start.x, end.x) }
    var height: CGFloat { max(start.y, end.y) }
  }

  private static func corner(_ size: CGSize, continuous: Bool, available: CGSize? = nil) -> Corner? {
    guard size.width > 0, size.height > 0 else { return Corner(segments: []) }
    // A separate large rectangle keeps the requested corner away from the native
    // rounded rectangle's opposite-corner clamping. Only its first corner is used.
    let extent = max(1, max(size.width, size.height) * 8)
    let rect = CGRect(origin: .zero, size: available ?? CGSize(width: extent, height: extent))
    let edgeTolerance = min(size.width, size.height) * 1e-12
    let nativePath = Path(roundedRect: rect, cornerSize: size, style: continuous ? .continuous : .circular).cgPath
    var current = CGPoint.zero
    var subpathStart = CGPoint.zero
    var segments: [Segment] = []
    nativePath.applyWithBlock { pointer in
      let element = pointer.pointee
      if element.type == .moveToPoint {
        current = element.points[0]
        subpathStart = current
        return
      }
      let count: Int
      switch element.type {
      case .addCurveToPoint: count = 3
      case .addQuadCurveToPoint: count = 2
      case .addLineToPoint: count = 1
      case .closeSubpath: count = 0
      default: return
      }
      let points = count == 0 ? [subpathStart] : (0..<count).map { element.points[$0] }
      let segment = Segment(kind: element.type, start: current, points: points)
      current = segment.end
      let allPoints = [segment.start] + points
      let isFirstCorner = allPoints.allSatisfy {
        $0.x >= -edgeTolerance && $0.y >= -edgeTolerance && $0.x <= rect.midX + CGFloat(Float(rect.width).ulp) * 4 && $0.y <= rect.midY + CGFloat(Float(rect.height).ulp) * 4
      }
      let isStraightEdge = (abs(segment.start.x) <= edgeTolerance && abs(segment.end.x) <= edgeTolerance) ||
        (abs(segment.start.y) <= edgeTolerance && abs(segment.end.y) <= edgeTolerance)
      if isFirstCorner && !isStraightEdge { segments.append(segment) }
    }
    guard !segments.isEmpty else { return nil }
    // A path may begin in the middle of this corner. Rotate its exact segments
    // until the first endpoint lies on an edge, then orient left edge to top edge.
    if let first = segments.firstIndex(where: { abs($0.start.x) <= edgeTolerance || abs($0.start.y) <= edgeTolerance }), first != 0 {
      segments = Array(segments[first...]) + Array(segments[..<first])
    }
    if abs(segments[0].start.y) <= edgeTolerance { segments = segments.reversed().map { $0.reversed } }
    guard abs(segments[0].start.x) <= edgeTolerance && abs(segments.last!.end.y) <= edgeTolerance else { return nil }
    return Corner(segments: segments)
  }

  @objc(pathForBounds:topLeft:topRight:bottomLeft:bottomRight:continuousCorners:)
  static func path(
    bounds: CGRect,
    topLeft: CGSize,
    topRight: CGSize,
    bottomLeft: CGSize,
    bottomRight: CGSize,
    continuousCorners: UInt
  ) -> UIBezierPath? {
    let candidates = [
      corner(topLeft, continuous: continuousCorners & UIRectCorner.topLeft.rawValue != 0),
      corner(topRight, continuous: continuousCorners & UIRectCorner.topRight.rawValue != 0),
      corner(bottomRight, continuous: continuousCorners & UIRectCorner.bottomRight.rawValue != 0),
      corner(bottomLeft, continuous: continuousCorners & UIRectCorner.bottomLeft.rawValue != 0),
    ]
    var corners = candidates.compactMap { $0 }
    guard corners.count == 4 else { return nil }
    let sizes = [topLeft, topRight, bottomRight, bottomLeft]
    let masks = [UIRectCorner.topLeft, UIRectCorner.topRight, UIRectCorner.bottomRight, UIRectCorner.bottomLeft]
    var available = corners.map { CGSize(width: $0.width, height: $0.height) }
    func allocate(_ first: Int, _ second: Int, horizontal: Bool) -> Bool {
      let limit = horizontal ? bounds.width : bounds.height
      let spanA = horizontal ? available[first].width : available[first].height
      let spanB = horizontal ? available[second].width : available[second].height
      if spanA + spanB <= limit { return true }
      let radiusA = horizontal ? sizes[first].width : sizes[first].height
      let radiusB = horizontal ? sizes[second].width : sizes[second].height
      let free = limit - radiusA - radiusB
      let extraA = max(0, spanA - radiusA), extraB = max(0, spanB - radiusB)
      guard free >= -1e-10 && extraA + extraB > 0 else { return false }
      let resultA = radiusA + max(0, free) * extraA / (extraA + extraB)
      let resultB = radiusB + max(0, free) * extraB / (extraA + extraB)
      if horizontal { available[first].width = resultA; available[second].width = resultB }
      else { available[first].height = resultA; available[second].height = resultB }
      return true
    }
    guard allocate(0, 1, horizontal: true), allocate(3, 2, horizontal: true),
      allocate(0, 3, horizontal: false), allocate(1, 2, horizontal: false) else { return nil }
    var next: [Corner] = []
    for index in sizes.indices {
      let extent = max(1, max(sizes[index].width, sizes[index].height) * 8)
      let width = available[index].width < corners[index].width ? available[index].width * 2 : extent
      let height = available[index].height < corners[index].height ? available[index].height * 2 : extent
      guard let item = corner(sizes[index], continuous: continuousCorners & masks[index].rawValue != 0,
        available: CGSize(width: width, height: height)) else { return nil }
      next.append(item)
    }
    corners = next
    let scale: CGFloat = 1
    let transforms = [
      CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: bounds.minX, ty: bounds.minY),
      CGAffineTransform(a: -scale, b: 0, c: 0, d: scale, tx: bounds.maxX, ty: bounds.minY),
      CGAffineTransform(a: -scale, b: 0, c: 0, d: -scale, tx: bounds.maxX, ty: bounds.maxY),
      CGAffineTransform(a: scale, b: 0, c: 0, d: -scale, tx: bounds.minX, ty: bounds.maxY),
    ]
    let path = CGMutablePath()
    for index in corners.indices {
      let reverse = index == 1 || index == 3
      let segments = reverse ? corners[index].segments.reversed().map { $0.reversed } : corners[index].segments
      let transform = transforms[index]
      let start = (segments.first?.start ?? .zero).applying(transform)
      if index == 0 { path.move(to: start) } else { path.addLine(to: start) }
      for segment in segments {
        let points = segment.points.map { $0.applying(transform) }
        switch segment.kind {
        case .addCurveToPoint: path.addCurve(to: points[2], control1: points[0], control2: points[1])
        case .addQuadCurveToPoint: path.addQuadCurve(to: points[1], control: points[0])
        default: path.addLine(to: points[0])
        }
      }
    }
    path.closeSubpath()
    return UIBezierPath(cgPath: path)
  }
}

let bounds = CGRect(x: 0, y: 0, width: 120, height: 80)
let profiles: [[CGFloat]] = [[4,4,4,4], [20,20,20,20], [40,40,40,40], [20,10,40,30], [40,40,20,20], [0,60,0,20], [60,60,20,20], [35,45,35,35]]
for style in [RoundedCornerStyle.continuous, .circular] {
 for (index,r) in profiles.enumerated() {
  let sizes = r.map { CGSize(width: $0, height: $0) }
  let candidate = CandidateVirtualCorners.path(bounds:bounds, topLeft:sizes[0], topRight:sizes[1], bottomLeft:sizes[3], bottomRight:sizes[2], continuousCorners: style == .continuous ? 15 : 0)
  let native = Path(roundedRect: bounds, cornerRadii: RectangleCornerRadii(topLeading:r[0], bottomLeading:r[3], bottomTrailing:r[2], topTrailing:r[1]), style:style).cgPath
  var differences = 0
  if let candidate {
   for x in 0..<240 { for y in 0..<160 {
    let p = CGPoint(x:CGFloat(x)/2+0.25, y:CGFloat(y)/2+0.25)
    if candidate.cgPath.contains(p) != native.contains(p) { differences += 1 }
   }}
   precondition(differences == 0, "Sampled scalar native correspondence failed")
   print(style, index, r, "differences", differences)
  } else { preconditionFailure("Scalar candidate extraction failed") }
 }
}

func curves(_ path: CGPath) -> [[CGFloat]] {
 var result: [[CGFloat]] = [], current = CGPoint.zero, initial = CGPoint.zero
 path.applyWithBlock { element in
  let value = element.pointee
  switch value.type {
  case .moveToPoint: current = value.points[0]; initial = current
  case .addCurveToPoint:
   result.append([current.x,current.y,value.points[0].x,value.points[0].y,value.points[1].x,value.points[1].y,value.points[2].x,value.points[2].y]); current = value.points[2]
  case .addQuadCurveToPoint: current = value.points[1]
  case .addLineToPoint: current = value.points[0]
  case .closeSubpath: current = initial
  default: break
  }
 }
 return result.filter { values in stride(from:2,to:8,by:2).contains { abs(values[$0]-values[0])+abs(values[$0+1]-values[1]) > 1e-9 } }
}
func delta(_ first:CGPath,_ second:CGPath) -> CGFloat {
 let a = curves(first), b = curves(second)
 if a.count != b.count { return .infinity }
 func distance(_ x:[CGFloat],_ y:[CGFloat]) -> CGFloat {
  min(zip(x,y).map { abs($0-$1) }.max()!, zip(x,[y[6],y[7],y[4],y[5],y[2],y[3],y[0],y[1]]).map { abs($0-$1) }.max()!)
 }
 return max(a.map { x in b.map {distance(x,$0)}.min() ?? .infinity }.max() ?? 0,
   b.map { y in a.map {distance($0,y)}.min() ?? .infinity }.max() ?? 0)
}
var randomState: UInt64 = 0x50b98764
func random(_ maximum:CGFloat)->CGFloat {
 randomState = randomState &* 1664525 &+ 1013904223
 return CGFloat(randomState & 0xffffff) / CGFloat(0xffffff) * maximum
}
var failures=0, extractionFailures=0, cases=0, worst:CGFloat=0
for style in [RoundedCornerStyle.continuous, .circular] {
 for index in 0..<300 {
  let width = random(200) + 4, height = random(200) + 4
  let rect = CGRect(x:random(10),y:random(10),width:width,height:height)
  var r = (0..<4).map { _ in random(max(width,height)) }
  if index % 7 == 0 { r[index % 4] = 0 }
  let factor = min(1, width/max(r[0]+r[1],r[3]+r[2]), height/max(r[0]+r[3],r[1]+r[2]))
  r = r.map { $0 * factor }
  let sizes = r.map { CGSize(width:$0,height:$0) }
  let candidate = CandidateVirtualCorners.path(bounds:rect,topLeft:sizes[0],topRight:sizes[1],bottomLeft:sizes[3],bottomRight:sizes[2],continuousCorners:style == .continuous ? 15 : 0)
  let native = Path(roundedRect:rect,cornerRadii:RectangleCornerRadii(topLeading:r[0],bottomLeading:r[3],bottomTrailing:r[2],topTrailing:r[1]),style:style).cgPath
  cases += 1
  guard let candidate else { extractionFailures += 1; if extractionFailures<4 { print("FUZZ_EXTRACTION",style,index,rect,r) }; continue }
  let difference = delta(candidate.cgPath,native); worst=max(worst,difference)
  if difference > CGFloat(Float(max(rect.maxX, rect.maxY)).ulp) * 4 { failures += 1; if failures<6 { print("FUZZ_CURVE_DIFFERENCE",style,index,rect,r,difference,"curves",curves(candidate.cgPath).count,curves(native).count) } }
 }
}
print("HOST_SCALAR_CANDIDATE_ONLY", cases, "curve failures", failures, "extraction failures", extractionFailures, "worst", worst, "tolerance", "four Float-coordinate ULPs", "fullCard", false)

precondition(failures == 0 && extractionFailures == 0, "Scalar system-path correspondence failed; no broader geometry result is implied")
