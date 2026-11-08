import Foundation

// BEGIN TAG_G02_PURE_CHECKS
struct TagG02OwnerState {
    let raw: String
    let owner: Bool
    let echo: Bool
    let requests: Int
    let last: String
    let identifier: String
    let exposed: String
    let size: String
    let armed: Bool
    let deliveredSize: [Double]?
}
enum TagG02Checks {
    static func parse(_ raw: String) throws -> TagG02OwnerState {
        let text = raw.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
        func field(_ pattern: String, _ group: Int = 1) throws -> String {
            let regex = try NSRegularExpression(pattern: pattern)
            guard let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
                  let range = Range(match.range(at: group), in: text) else {
                throw NSError(domain: "TagG02State", code: 1, userInfo: [NSLocalizedDescriptionKey: pattern])
            }
            return String(text[range])
        }
        var delivered: [Double]?
        if !text.contains("Frame: unmeasured.") {
            guard let width = Double(try field("Frame: ([0-9.]+) x ([0-9.]+)\\.")),
                  let height = Double(try field("Frame: ([0-9.]+) x ([0-9.]+)\\.", 2)),
                  width.isFinite, height.isFinite, width > 0, height > 0 else {
                throw NSError(domain: "TagG02State", code: 2)
            }
            delivered = [width, height]
        }
        guard let requests = Int(try field("Requests: ([0-9]+)\\.")) else {
            throw NSError(domain: "TagG02State", code: 3)
        }
        return try TagG02OwnerState(raw: text, owner: field("Owner: (true|false)\\.") == "true",
            echo: field("Echo: (true|false)\\.") == "true", requests: requests,
            last: field("Last: (.*?)\\. ID:"), identifier: field(" ID: (.*?)\\. Exposed:"),
            exposed: field("Exposed: (.*?)\\. Size:"), size: field("Size: (.*?)\\. Geometry:"),
            armed: field("Armed guard: (true|false)\\.") == "true", deliveredSize: delivered)
    }
    static func outcome(_ state: TagG02OwnerState, actualID: String, label: String, isButton: Bool,
                        enabled: Bool, value: String?, owner: Bool, requests: Int, last: String,
                        checked: String, expectedEnabled: Bool) -> Bool {
        state.owner == owner && state.requests == requests && state.last == last
            && state.identifier == "number 0" && actualID == "tag-example" && label == "Controlled tag"
            && isButton && enabled == expectedEnabled && value == checked
    }
    static func contained(_ child: [Double], _ parent: [Double], scale: Double) -> Bool {
        guard child.count == 4, parent.count == 4, scale.isFinite, scale > 0,
              (child + parent).allSatisfy({ $0.isFinite }) else { return false }
        let c = child.map { floor($0 * scale + 0.5) }, p = parent.map { floor($0 * scale + 0.5) }
        return c[2] > 0 && c[3] > 0 && p[2] > 0 && p[3] > 0 && c[0] >= p[0] && c[1] >= p[1]
            && c[0] + c[2] <= p[0] + p[2] && c[1] + c[3] <= p[1] + p[3]
    }
    static func wraps(_ frame: [Double], delivered: [Double], shortHeight: Double, scale: Double) -> Bool {
        guard frame.count == 4, delivered.count == 2, scale.isFinite, scale > 0,
              (frame + delivered + [shortHeight]).allSatisfy({ $0.isFinite }) else { return false }
        let pixel = 1 / scale
        return abs(frame[2] - 140) <= pixel && abs(frame[2] - delivered[0]) <= pixel
            && abs(frame[3] - delivered[1]) <= pixel && frame[3] > shortHeight + pixel
    }
}
// END TAG_G02_PURE_CHECKS


var checks = 0
func expect(_ value: Bool, _ name: String) {
    guard value else { fatalError("TagG02 control failed: " + name) }
    checks += 1
}
let raw = "Owner: false. Echo: false. Requests: 3. Last: number 0. ID: number 0. Exposed: false. Size: 140. Geometry: rounded. Frame: 140 x 117.333. Armed guard: false."
let state = try TagG02Checks.parse(raw)
expect(!state.owner && !state.echo && state.requests == 3 && state.last == "number 0"
    && state.identifier == "number 0" && state.exposed == "false" && state.deliveredSize == [140,117.333], "actual marker parser")
func outcome(_ row: TagG02OwnerState = state, id: String = "tag-example", owner: Bool = false,
             count: Int = 3, checked: String = "unchecked", button: Bool = true, enabled: Bool = true) -> Bool {
    TagG02Checks.outcome(row, actualID: id, label: "Controlled tag", isButton: button,
        enabled: enabled, value: checked, owner: owner, requests: count, last: "number 0",
        checked: "unchecked", expectedEnabled: true)
}
expect(outcome(), "owner-veto/exposed-false positive")
expect(!outcome(count: 2) && !outcome(count: 4), "missing/extra request negative")
expect(!outcome(id: "stale-target"), "wrong target negative")
expect(!outcome(owner: true), "wrong owner negative")
expect(!outcome(checked: "checked") && !outcome(button: false) && !outcome(enabled: false), "wrong native traits negative")
let wrongID = try TagG02Checks.parse(raw.replacingOccurrences(of: "ID: number 0", with: "ID: string \"0\""))
expect(!outcome(wrongID), "typed identifier negative")
let wrongLast = try TagG02Checks.parse(raw.replacingOccurrences(of: "Last: number 0", with: "Last: string \"0\""))
expect(!outcome(wrongLast), "callback identity negative")
expect(TagG02Checks.contained([0,0,17.0001220703125,17.0001220703125], [0,0,17,17], scale: 1), "fractional delivered physical containment")
expect(!TagG02Checks.contained([1,0,17,17], [0,0,17,17], scale: 1), "one physical pixel outside negative")
expect(!TagG02Checks.contained([0,0,18,17], [0,0,17,17], scale: 1), "wrong target size negative")
expect(TagG02Checks.contained([8,20,140,117.333], [0,0,390,700], scale: 3), "wrapped viewport positive")
expect(!TagG02Checks.contained([8,650,140,117.333], [0,0,390,700], scale: 3), "clipped tail negative")
expect(TagG02Checks.wraps([8,20,140,117.333], delivered: [140,117.333], shortHeight: 30, scale: 3), "native wrapped fixed-width positive")
expect(!TagG02Checks.wraps([8,20,140,30], delivered: [140,30], shortHeight: 30, scale: 3), "unwrapped label negative")
expect(!TagG02Checks.wraps([8,20,145,117.333], delivered: [145,117.333], shortHeight: 30, scale: 3), "wrong constrained width negative")
var malformedRejected = false
do { _ = try TagG02Checks.parse(raw.replacingOccurrences(of: "Requests: 3", with: "Requests: -1")) }
catch { malformedRejected = true }
expect(malformedRejected, "malformed count rejected")
print("TAG_G02_ACTUAL_HELPER_CONTROLS_PASS \(checks)")
