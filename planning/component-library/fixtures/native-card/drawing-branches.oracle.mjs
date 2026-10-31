import assert from "node:assert/strict"
import { log } from "node:console"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const upstreamPath =
  "packages/react-native/node_modules/react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm"
const receivedPath = "packages/react-native/ios/CUIMotionDrawingView.mm"
const [upstream, received, peer] = await Promise.all([
  readFile(path.join(repository, upstreamPath), "utf8"),
  readFile(path.join(repository, receivedPath), "utf8"),
  readFile(path.join(repository, "packages/react-native/node_modules/react-native/package.json"), "utf8"),
])
assert.equal(JSON.parse(peer).version, "0.86.3")
const between = (text, start, end) => {
  const first = text.indexOf(start)
  assert.notEqual(first, -1, start)
  const last = text.indexOf(end, first + start.length)
  assert.notEqual(last, -1, end)
  return text.slice(first, last)
}
const canonical = (text) => text.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "")
const predicate = (text, name) => between(text, `const bool ${name} =`, ";").split("=").slice(1).join("=")
assert.equal(
  canonical(
    predicate(received, "sourceUsesCoreAnimationBorderRendering").replaceAll("nativeBorderMetrics", "borderMetrics"),
  ),
  canonical(predicate(upstream, "useCoreAnimationBorderRendering")),
  "Authored/native border primitive selection must match the actual pinned predicate",
)
const sourceShadow = between(upstream, "  // Stage 1. Shadow Path", "  const bool useCoreAnimationBorderRendering")
const ownedShadow = between(
  received,
  "  // Stage 1. Shadow Path",
  "  const bool sourceUsesCoreAnimationBorderRendering",
)
assert.equal((sourceShadow.match(/RCTPathCreateWithRoundedRect\(/g) ?? []).length, 3)
assert.equal((ownedShadow.match(/RCTPathCreateWithRoundedRect\(/g) ?? []).length, 3)
assert.ok(
  !ownedShadow.includes("CUIPathCreateWithRoundedRect("),
  "Legacy shadow and hover remain circular for every radius correction",
)
const sourceOutline = between(upstream, "  // outline", "  // filter")
const ownedOutline = between(received, "  // outline", "  // filter")
assert.ok(sourceOutline.includes("RCTAddContourEffectToLayer("))
assert.ok(ownedOutline.includes("CUIMotionCornerCurves{}"))
assert.ok(!ownedOutline.includes("borderCurves"), "Outline does not inherit the background's continuous curve")
const sourceBoxShadow = between(upstream, "  // box shadow", "  // clipping")
const ownedBoxShadow = between(received, "  // box shadow", "  // clipping")
assert.ok(sourceBoxShadow.includes("RCTGetBoxShadowLayer("))
assert.ok(ownedBoxShadow.includes("RCTGetBoxShadowLayer("))
assert.ok(!ownedBoxShadow.includes("borderCurves"))
const sourceClip = between(upstream, "  // clipping", "// Shapes the given layer")
const ownedClip = between(received, "  // clipping", "// Shapes the given layer")
assert.ok(!/cornerCurve\s*=/.test(sourceClip))
assert.ok(!/cornerCurve\s*=/.test(ownedClip), "Clipping retains the actual container's inherited curve")
assert.ok(ownedClip.includes("containerLayer.cornerCurve"))
assert.ok(ownedClip.includes("cornerCurves:CUIUniformCornerCurve(curve)"))
assert.match(
  ownedClip,
  /subview\.layer\.mask\s*=\s*\[self createCuiMaskLayer:[\s\S]*?cornerCurves:CUIMotionCornerCurves\{\}/,
)
const sourceShape = between(upstream, "- (void)shapeLayerToMatchView:", "- (void)clearExistingBackgroundImageLayers")
const ownedShape = between(
  received,
  "- (void)shapeCuiLayerToMatchView:",
  "- (void)clearExistingCuiBackgroundImageLayers",
)
assert.ok(sourceShape.includes("if (borderMetrics.borderRadii.isUniform())"))
assert.ok(sourceShape.includes("layer.cornerCurve = CornerCurveFromBorderCurve(borderMetrics.borderCurves.topLeft)"))
assert.ok(ownedShape.includes("sourceUsesUniformLayer = nativeBorderMetrics.borderRadii.isUniform()"))
assert.ok(
  ownedShape.includes(
    "sourceUsesUniformLayer ? CUIUniformCornerCurve(nativeBorderMetrics.borderCurves.topLeft) : CUIMotionCornerCurves{}",
  ),
)
for (const [sourceName, ownedName] of [
  ["_backgroundColorLayer", "_cuiBackgroundColorLayer"],
  ["_filterLayer", "_cuiFilterLayer"],
  ["backgroundImageLayer", "backgroundImageLayer"],
]) {
  assert.ok(upstream.includes(`shapeLayerToMatchView:${sourceName}`))
  assert.ok(received.includes(`shapeCuiLayerToMatchView:${ownedName}`))
}
const uniformMetrics = between(
  received,
  "- (BorderMetrics)cuiUniformLayerBorderMetrics",
  "- (void)updateLayoutMetrics:",
)
assert.ok(uniformMetrics.includes("topLeft.horizontal"))
assert.ok(uniformMetrics.includes("{{radius, radius}, {radius, radius}, {radius, radius}, {radius, radius}}"))
assert.ok(uniformMetrics.includes("CUIApplyProjectionRadii(_cuiRadii, result.borderRadii)"))
const ownedBorder = between(received, "  // borders", "  // outline")
assert.ok(
  ownedBorder.includes(
    "sourceUsesCoreAnimationBorderRendering ? CUIUniformCornerCurve(nativeBorderMetrics.borderCurves.topLeft) : CUIMotionCornerCurves{}",
  ),
)
assert.ok(ownedBorder.includes("uniformLayerMetrics.borderRadii"))
const contour = between(received, "static void RCTAddContourEffectToLayer(", "static RCTBorderColors")
assert.ok(contour.includes("? RCTGetBorderImage("), "Circular bitmap contours retain the pinned painter")
assert.ok(contour.includes(": CUIGetBorderImage("), "Corrected source-CA continuous borders retain their owned path")

log(
  JSON.stringify(
    {
      scope: "Actual locked RN/CUI source routing audit; no UIKit execution or native drawing/fidelity acceptance",
      upstream: { path: upstreamPath, sha256: createHash("sha256").update(upstream).digest("hex") },
      received: { path: receivedPath, sha256: createHash("sha256").update(received).digest("hex") },
      routes: {
        legacyShadowAndHover: "circular for baseline and corrected axes",
        outlineAndBoxShadow: "circular for baseline and corrected axes",
        bitmapBorder: "circular unless replacing an authored native-CA continuous primitive",
        backgroundFilterAndGradient:
          "native scalar/continuous only for authored uniform source branch; corrected axes retain that source curve",
        clipping:
          "authored scalar branch retains actual container curve; authored mask branch and image-child masks stay circular",
        percentageAndNullFallback:
          "authored native-CA horizontal scalar on both axes; circular painters retain RN axis resolution",
      },
      nativeActions: 0,
    },
    null,
    2,
  ),
)
