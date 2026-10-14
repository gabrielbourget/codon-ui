# Native Text/Button — Independent Implementation Review

Status: **Review completed with three P2 implementation findings; remediation, palette disposition and owner visual/physical acceptance remain open**. Reviewed on 2026-10-13 at `921339543a0cede71b645c084ac453a561271268` by a separate read-only reviewer. The owner requested this review and capture preparation; iPhone signing remains deferred. This receipt records findings and a proposed bounded follow-up, without changing the implementation or approved public contracts.

## Review Coverage And Verification

The reviewer inspected the approved [Text/Button proposal](react-native-text-button-pass.md), native Text semantics/selection/style inheritance, types/exports, Button state/event adapters and style precedence, runtime color validation, provider/defaults, positive/negative public contracts, owning showcase scenes/tests, source history and the explicit clipping/label follow-up. No additional material Text or event-adapter issue was found in that source coverage. The clipping/label correction matches its approved scope and installed receipt.

Fresh focused verification passed three native suites with 39 tests in 5.663 seconds and public contract typechecking. Commands were `pnpm -F @codon-ui/react-native test --runInBand` and `pnpm -F @codon-ui/react-native typecheck:contracts`, using the existing pinned toolchain. No native rebuild or emulator run was needed for this read-only review. Public-entry tests used the existing compiled entry; component implementation has not changed since its recorded build. In-memory canonical-source probes independently reproduced the findings below with lightweight React/RN shims. These prove source behavior, rather than installed rendering; the invalid shadow strings in those probes were deliberately rejected by the shim's processColor but never reached it.

## P2 — Mixed Primitive Children Bypass The Text Wrapper

[Button.tsx](../../packages/react-native/src/components/Button/Button.tsx) lines 103–104 wrap only a single top-level string or number. Normal JSX such as `<Button>Save {count}</Button>`, arrays, explicit fragments and render callbacks returning those compositions leave raw primitive children under the View-backed Pressable. Installed RN Fabric’s development renderer reports invalid raw native View text with “Text strings must be rendered within a <Text> component.” The public ReactNode child type admits these compositions, while current tests exercise single primitives and authored Text elements.

The source probe returned `{"type":"Text","props":{"children":"Save"}}` for a single string, but `["Save ",3]` for mixed children and `{"type":"Fragment","props":{"children":["Save ",3]}}` for an explicit fragment. Arrays and fragments need normalization through their direct primitive children, including callback results. Preserve authored native/custom elements and keys; unknown components retain ownership of their internals. Grouping contiguous primitives into one owned Text avoids introducing the Button row gap between pieces of a phrase.

## P2 — An Identity Style Callback Restores Automatic Minima

[Button/styles.ts](../../packages/react-native/src/components/Button/styles.ts) lines 93–100 expose defaultStyle before removing automatic minima for width/height supplied through customStyles. The final merge at lines 104–113 then reintroduces those minima from the callback result. An identity callback therefore changes authored dimensions instead of preserving its supplied baseline.

On the iOS source probe, `customStyles={{ width: 24, height: 24 }}` resolved to width/height 24 without minima. Adding `style={(state) => state.defaultStyle}` restored minWidth/minHeight 44. Make the callback baseline reflect dimensions already authored through customStyles; retain final caller style precedence and explicitly authored minima. Verify the equivalent Android 48-dp default and dimensions authored through each supported style layer.

## P2 — Shadow Colors Bypass Runtime Validation

[colors.ts](../../packages/react-native/src/components/colors.ts) lines 37–47 validate top-level colors and structured box shadows, but string box shadows reject only var/currentColor spellings; filter.dropShadow colors are not checked. Both `boxShadow: "0 1px 2px not-a-color"` and `filter: [{ dropShadow: { offsetX: 0, offsetY: 1, color: "var(--shadow)" } }]` passed the current resolver. Installed RN declares these style shapes and its processors discard invalid shadow inputs, while the approved Codon boundary promises a descriptive TypeError for unsupported colors.

Validate color-bearing supported native shadow/filter forms without changing public types or accepting CSS variables. Add meaningful invalid/valid string and structured-input regression cases, including final style callbacks and customStyles. Preserve valid native color and style forms; a parsing or compatibility choice that would narrow them needs a separate contract decision.

## Inherited Palette Acceptance Concern

The review also calculated low resting text contrast in six existing theme states. These values follow the pinned web-derived palette and are separate from the three implementation defects. The two passing strict iOS audit states exercise visible primary light-fill/dark-outline content; their zero issues do not settle other orders. No theme values were changed during this review.

| State                   | Foreground | Background | Calculated ratio |
| ----------------------- | ---------- | ---------- | ---------------: |
| Light secondary fill    | #ffffff    | #c6c6c6    |          1.708:1 |
| Light secondary outline | #c6c6c6    | #ffffff    |          1.708:1 |
| Dark tertiary fill      | #ffffff    | #6ad060    |          1.944:1 |
| Dark quaternary fill    | #ffffff    | #f0b429    |          1.864:1 |
| Dark quintenary fill    | #ffffff    | #ff6b5f    |          2.792:1 |
| Dark secondary outline  | #3d3d3d    | #171717    |          1.650:1 |

The calculation linearizes normalized sRGB channels at 0.04045, uses luminance 0.2126R + 0.7152G + 0.0722B and divides (lighter + 0.05) by (darker + 0.05). It uses theme foreground/background values at rest, not sampled screenshot pixels or an exhaustive contrast audit. The packet retains all 20 computed resting state pairs. Inspect the six named captures during visual review, then decide theme ownership/parity and any palette correction through a separate approved theme-contract pass.

## Visual Review Packet

The private packet is `/Users/gabrielbourget/.codex/visualizations/2026/10/11/01a12cc2-8c0c-71f1-b7aa-f055be011117/native-text-button-visual-review-2026-10-13/index.html`. It organizes 83 unchanged full-resolution PNGs into 44 review scenes: all 20 color combinations per platform, disabled/pending, custom/render children, geometry/typography, larger text/footer/reset, five synthetic layouts, full-screen rotation and the corrected fixture/audit captures. The reviewer report, source probes, color calculations and capture provenance accompany it.

Both source manifests were reverified before copying: 831 baseline and 182 remediation files. Each copied PNG retains its source hash and artifact identity. Broad inspection captures belong to the earlier retained-parent builds; corrected fixture and iOS audit captures belong to the fresh cf27285 Release builds. Library implementation is identical between those checkpoints. The cropped application-scoped iOS landscape PNG, failed baseline diagnostics, developer onboarding views and the original unclipped visual fixture are excluded. Larger-text comparison pairs iOS scale 2.143 with Android 2.0; Android 1.5 remains separately available. Different logical windows and system fonts mean this is a visual comparison, not a pixel-parity proof.

Start with corrected fixture and primary fill/outline, then inspect all five orders in both themes, especially the six low-contrast states above. Continue through disabled/pending, custom/render children, shape/typography, larger-text footer/reset, synthetic layouts and landscape. Record feedback using the scene name, platform and visible issue. Existing browser measurements are retained, but durable mobile-web PNGs were not found in the evidence roots; no web screenshot or renewed deployed-revision claim is presented. The gallery links the reference environment for owner comparison.

## Proposed Follow-Up And Stop Condition

1. Correct primitive-child normalization in Button with array/fragment/render-callback regression coverage, preserving existing public props, native elements and phrase flow.
2. Correct style-callback baseline dimensions with iOS/Android regression coverage, preserving the approved computed/custom/final precedence and explicit minima.
3. Close native shadow-color validation bypasses with valid/invalid structured and string cases; preserve the documented native style forms and contextual TypeError behavior.
4. Run focused native tests/contracts/build and owning showcase cases, then create new source/archive/consumer/native-build identities as required by changed library source. Repeat affected installed composition, dimension and shadow checks and refresh any changed review captures. Keep existing sealed proof tied to its original source.

These are proposed logical remediation boundaries, not additional implementation authority inferred from a request for review. Preserve dependencies, tooling, registry/CLI, publication, signing and the current theme during that pass. Theme correction requires its own deliberate proposal. Obtain a follow-up independent review after remediation; implementation acceptance remains open until its findings are resolved. Owner visual review can begin with this packet, while physical VoiceOver/TalkBack, touch/adjacent targets, pointer/keyboard and ARM gates remain separate. Do not open the next component family on the strength of passing existing tests or primary-only audits.
