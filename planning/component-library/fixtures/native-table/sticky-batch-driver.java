import java.lang.ref.WeakReference;
import java.util.*;

// Runs the actual Java controller with SDK/view/owner boundary doubles; no guest or UI harness.
class StickyBatchDriverContract {
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  static CUIMotionSnapshotModule setup() {
    CUIMotionSnapshotModule owner = new CUIMotionSnapshotModule(); View window = new View(100), table = new ViewGroup(90); table.parent = window;
    owner.table = table; owner.manager.views.put(90, table);
    for (int index = 1; index <= 4; index++) {
      View view = new View(index); view.parent = table; owner.manager.views.put(index, view);
      owner.targets.put(new JSONObject().put("lease", "lease" + index).put("target", index).put("containingRoot", 90).put("session", null));
    }
    return owner;
  }
  static void run(CUIMotionSnapshotModule owner) { new CUITableStickyPresentation(owner, new ReactApplicationContext(), owner.manager).synchronize(); }
  public static void main(String[] args) {
    CUIMotionSnapshotModule owner = setup(); run(owner);
    check(owner.prepares == 1 && owner.frames == 1 && owner.applied == 1 && owner.lastGeometry.length == 32, "four validated headers must use one prepare and one publication");
    for (int index = 0; index < 4; index++) check(owner.lastGeometry[index * 8 + 1] == 75, "viewport geometry must be read after activation changes layout");
    owner = setup(); owner.invalidateSecond = true; run(owner);
    check(owner.retires == 1 && owner.frames == 1 && owner.applied == 0, "retirement during second validation must reject mixed-epoch geometry");
    owner = setup(); owner.failPrepare = true; run(owner);
    check(owner.failure != null && owner.failure.getMessage().equals("prepare failure") && owner.frames == 0 && owner.retires == 4, "prepare error must synchronously fail and retire without partial frames");
    owner = setup(); owner.manager.views.get(4).surface = 2; run(owner);
    check(owner.prepares == 0 && owner.frames == 0 && owner.scalar.size() == 4, "mixed surfaces must retain scalar path");
    check(owner.scalar.get(0)[1] == 0 && owner.scalar.get(1)[1] == 15, "scalar fallback must freshly measure after preceding publication");
    owner = setup(); owner.targets.getJSONObject(1).put("session", new JSONObject().put("scopeOwnerId", "foreign").put("windowId", "window").put("epoch", 1)); run(owner);
    check(owner.retires == 1 && owner.preparedCount == 3 && owner.lastGeometry.length == 24, "foreign scope/session must retire before activation");
    owner = setup(); owner.manager.views.get(2).token = new Object(); run(owner);
    check(owner.retires == 1 && owner.preparedCount == 3, "foreign window must retire before activation");
    System.out.println("{\"cases\":6,\"postActivationReads\":true,\"staleGeometryRejected\":true,\"mixedSurfaceScalarFallback\":true,\"nativeActions\":0}");
  }
}
class CUIMotionSnapshotModule {
  final FabricUIManager manager = new FabricUIManager(); final JSONArray targets = new JSONArray(); View table;
  long revision; int prepares, frames, applied, retires, preparedCount; double[] lastGeometry; Exception failure;
  boolean invalidateSecond, failPrepare; final List<double[]> scalar = new ArrayList<>();
  String tableStickyTargets() { return targets.toString(); } void tableStickySynchronize() {}
  long tableStickyPrepare(String leases) {
    prepares++; preparedCount = new JSONArray(leases).length();
    if (failPrepare) throw new IllegalStateException("prepare failure");
    table.top = 75; revision++;
    if (invalidateSecond) manager.views.get(2).attached = false;
    return revision;
  }
  boolean tableStickyFrames(long expected, String leases, double[] geometry) { frames++; lastGeometry = geometry; if (expected != revision) return false; applied++; return true; }
  void tableStickyFrame(String lease, double[] geometry) { scalar.add(geometry); table.top = 15; }
  void tableStickyRetire(String lease) { retires++; revision++; if (invalidateSecond) table.top = 40; }
  void tableStickyFailure(Exception value) { if (failure == null) failure = value; }
}
interface ViewParent { ViewParent getParent(); }
class View implements ViewParent {
  static final int VISIBLE = 0; static final Object WINDOW = new Object();
  final int id; int top, surface = 1; View parent; boolean attached = true; Object token = WINDOW; final ViewTreeObserver tree = new ViewTreeObserver();
  View(int id) { this.id = id; } public ViewParent getParent() { return parent; }
  int getLeft() { return 0; } int getTop() { return top; } int getWidth() { return 100; } int getHeight() { return 50; }
  int getScrollX() { return 0; } int getScrollY() { return 0; } int getPaddingLeft() { return 0; } int getPaddingRight() { return 0; } int getPaddingTop() { return 0; } int getPaddingBottom() { return 0; }
  boolean isAttachedToWindow() { return attached; } Object getWindowToken() { return token; } boolean hasWindowFocus() { return true; }
  View getRootView() { View root = this; while (root.parent != null) root = root.parent; return root; }
  ViewTreeObserver getViewTreeObserver() { return getRootView().tree; } int getVisibility() { return VISIBLE; } Resources getResources() { return new Resources(); }
}
class ViewGroup extends View { ViewGroup(int id) { super(id); } boolean getClipToPadding() { return false; } }
class ScrollView extends ViewGroup { ScrollView(int id) { super(id); } }
class HorizontalScrollView extends ViewGroup { HorizontalScrollView(int id) { super(id); } }
class ViewTreeObserver { interface OnPreDrawListener { boolean onPreDraw(); } boolean isAlive() { return true; } void addOnPreDrawListener(OnPreDrawListener observer) {} void removeOnPreDrawListener(OnPreDrawListener observer) {} }
interface LifecycleEventListener { void onHostPause(); void onHostResume(); void onHostDestroy(); }
class ReactApplicationContext { void addLifecycleEventListener(LifecycleEventListener listener) {} void removeLifecycleEventListener(LifecycleEventListener listener) {} }
class UiThreadUtil { static void assertOnUiThread() {} }
class FabricUIManager { final Map<Integer, View> views = new HashMap<>(); View resolveView(int tag) { return views.get(tag); } }
class IllegalViewOperationException extends RuntimeException {}
class UIManagerHelper { static int getSurfaceId(View view) { return view.surface; } }
class CUIKeyboardScope extends ViewGroup { CUIKeyboardScope(int id) { super(id); } String menuPointerOwnerId() { return "scope"; } double menuPointerEpoch() { return 1; } }
class CUIInputWindow { static String identity(View view) { return "window"; } }
class Resources { DisplayMetrics getDisplayMetrics() { return new DisplayMetrics(); } }
class DisplayMetrics { final float density = 1; }
class JSONObject {
  final Map<String, Object> values = new HashMap<>(); JSONObject put(String key, Object value) { values.put(key, value); return this; }
  int getInt(String key) { return ((Number)values.get(key)).intValue(); } double getDouble(String key) { return ((Number)values.get(key)).doubleValue(); }
  String getString(String key) { return (String)values.get(key); } boolean isNull(String key) { return values.get(key) == null; } JSONObject getJSONObject(String key) { return (JSONObject)values.get(key); }
}
class JSONArray {
  static final Map<String, JSONArray> encoded = new HashMap<>(); static int sequence;
  final List<Object> values;
  JSONArray() { values = new ArrayList<>(); } JSONArray(String input) { values = encoded.get(input).values; }
  JSONArray put(Object value) { values.add(value); return this; } int length() { return values.size(); } JSONObject getJSONObject(int index) { return (JSONObject)values.get(index); }
  public String toString() { String key = "encoded:" + ++sequence; encoded.put(key, this); return key; }
}
// OWNED_CONTROLLER
