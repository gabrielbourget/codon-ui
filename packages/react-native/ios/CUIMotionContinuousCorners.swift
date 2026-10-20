import SwiftUI
import UIKit

// System-generated curves are retained verbatim; no fitted control points or private drawing APIs.
@objc(CUIMotionContinuousCorners)
final class CUIMotionContinuousCorners: NSObject {
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

  private static func corner(_ size: CGSize, continuous: Bool) -> Corner? {
    guard size.width > 0, size.height > 0 else { return Corner(segments: []) }
    // A separate large rectangle keeps the requested corner away from the native
    // rounded rectangle's opposite-corner clamping. Only its first corner is used.
    let extent = max(1, max(size.width, size.height) * 8)
    let rect = CGRect(x: 0, y: 0, width: extent, height: extent)
    let edgeTolerance = extent * 1e-12
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
        $0.x >= -edgeTolerance && $0.y >= -edgeTolerance && $0.x <= rect.midX && $0.y <= rect.midY
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
    let allCorners = UIRectCorner.topLeft.rawValue | UIRectCorner.topRight.rawValue |
      UIRectCorner.bottomLeft.rawValue | UIRectCorner.bottomRight.rawValue
    if topLeft == topRight && topLeft == bottomLeft && topLeft == bottomRight &&
      (continuousCorners & allCorners == allCorners || continuousCorners == 0) {
      return UIBezierPath(cgPath: Path(roundedRect: bounds, cornerSize: topLeft,
        style: continuousCorners == 0 ? .circular : .continuous).cgPath)
    }
    let candidates = [
      corner(topLeft, continuous: continuousCorners & UIRectCorner.topLeft.rawValue != 0),
      corner(topRight, continuous: continuousCorners & UIRectCorner.topRight.rawValue != 0),
      corner(bottomRight, continuous: continuousCorners & UIRectCorner.bottomRight.rawValue != 0),
      corner(bottomLeft, continuous: continuousCorners & UIRectCorner.bottomLeft.rawValue != 0),
    ]
    let corners = candidates.compactMap { $0 }
    guard corners.count == 4 else { return nil }
    let sums = [corners[0].width + corners[1].width, corners[3].width + corners[2].width,
      corners[0].height + corners[3].height, corners[1].height + corners[2].height]
    let limits = [max(0, bounds.width), max(0, bounds.width), max(0, bounds.height), max(0, bounds.height)]
    // A native uniform rectangle changes its curve as adjacent continuous spans
    // meet. Affine shrinking of isolated corners does not reproduce that shape.
    // Keep this unsupported mixed-corner branch explicit until its exact native
    // path can be obtained; do not publish a fitted or circular substitute.
    guard zip(sums, limits).allSatisfy({ $0.0 <= $0.1 + 1e-10 }) else { return nil }
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
