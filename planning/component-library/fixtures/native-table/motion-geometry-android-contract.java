import java.lang.ref.WeakReference;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

// Android geometry and JSON seams; the observer methods below are source-extracted.
public class GeometryFixture {
  static final class Counts {
    static int matrices, parents, locations, concatenations, allocations, encodes;
    static void reset() { matrices = parents = locations = concatenations = allocations = encodes = 0; }
    static JSONObject read() throws JSONException {
      return new JSONObject().put("nativeMatrixReads", matrices).put("parentReads", parents)
        .put("windowLocationReads", locations).put("matrixConcatenations", concatenations).put("matrixAllocations", allocations);
    }
  }
  static class Owner {
    static final AtomicLong sequences = new AtomicLong(), identitySequence = new AtomicLong();
    static final IdentityHashMap<View, String> identities = new IdentityHashMap<>();
    WeakReference<View> root;
    Consumer<WritableMap> emit;
    String owner = "owner", binding = "binding", revision = "revision", attachment = "", lastFrame = "", lastWindow = "", lastScope = "";
    double lastEpoch;
    long attachmentRevision;
    boolean enabled = true, observeFrames = true;
    Object coordinator = new Object();
    Object lastEncodedSnapshot; String lastSnapshotJSON;
    void connect() {} void disconnect() {}
    static String identity(View view) { return identities.computeIfAbsent(view, ignored -> "identity:" + identitySequence.incrementAndGet()); }
  }
  static Object invoke(Object receiver, String method, Class<?>[] types, Object... values) throws Exception {
    Method target = receiver.getClass().getDeclaredMethod(method, types); target.setAccessible(true);
    try { return target.invoke(receiver, values); }
    catch (InvocationTargetException failure) { throw (Exception)failure.getCause(); }
  }
  static JSONObject snapshot(Class<?> type, View view) throws Exception {
    return (JSONObject)invoke(type.getDeclaredConstructor().newInstance(), "snapshot", new Class<?>[]{View.class}, view);
  }
  static Owner observer(Class<?> type, View view, List<String> trace) throws Exception {
    Owner owner = (Owner)type.getDeclaredConstructor().newInstance(); owner.root = new WeakReference<>(view);
    owner.emit = data -> trace.add(data.toString()); return owner;
  }
  static void capture(Owner owner, String kind) throws Exception {
    invoke(owner, "capture", new Class<?>[]{String.class, String.class, String.class}, kind, "request", kind.startsWith("mount") ? "transaction" : "");
  }
  static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
  static View hierarchy(int depth) {
    View node = null;
    for (int index = 0; index < depth; index++) {
      ReactViewGroup next = new ReactViewGroup(index + 1); next.parent = node;
      next.left = index * 3 - 7; next.top = index * 5 + 2; next.width = 120 - index; next.height = 90 + index;
      next.scrollX = index % 3; next.scrollY = index % 4; next.density = 2.625;
      next.matrix.values = new float[]{1.01f + index * .01f, -.03f, .27f * index, .02f, .97f, -.13f * index, .0001f, 0, 1};
      next.outline = index % 2 == 0; next.padding = index; next.overflow = index == 2 ? "hidden" : "visible";
      node = next;
    }
    if (node != null) node.getRootView().parent = new WindowParent();
    return node;
  }
  static void reset() { Counts.reset(); Owner.sequences.set(0); Owner.identitySequence.set(0); Owner.identities.clear(); SystemClock.time = 0; }
  static String trace(Class<?> type) throws Exception {
    reset(); View view = hierarchy(7); List<String> events = new ArrayList<>(); Owner owner = observer(type, view, events);
    capture(owner, "mount-before"); view.left += 3; view.matrix.values[2] += .125f;
    capture(owner, "mount-after"); capture(owner, "frame"); capture(owner, "frame");
    check(events.size() == 3, "unchanged frame must still suppress only its own event");
    view.parentView().scrollY += 7; capture(owner, "frame");
    check(events.size() == 4, "changed native scroll must produce a fresh snapshot");
    owner.observeFrames = false; capture(owner, "frame"); check(events.size() == 4, "frame opt-out");
    capture(owner, "sample"); view.attached = false; capture(owner, "detached");
    owner.enabled = false; capture(owner, "sample"); check(events.size() == 6, "disabled observer cannot emit");
    return events.toString();
  }
  static void freshSnapshots() throws Exception {
    reset(); View view = hierarchy(5);
    String first = snapshot(CandidateObserver.class, view).toString();
    view.matrix.values[2] += 19.25f; view.parentView().scrollX += 3; view.width += 8;
    String second = snapshot(CandidateObserver.class, view).toString();
    check(!first.equals(second), "matrix/scroll/size changes must not retain a previous snapshot cache");
    view.parent = new ReactViewGroup(70);
    check(!second.equals(snapshot(CandidateObserver.class, view).toString()), "reparenting must use a fresh chain");
    JSONObject query = (JSONObject)invoke(new CandidateObserver(), "querySnapshot", new Class<?>[]{View.class}, view);
    check(Boolean.FALSE.equals(query.get("mountObservationAvailable")), "query boundary remains explicitly unavailable");
  }
  static void failureAndIdentity() throws Exception {
    Class<?> readClass = Class.forName("CandidateObserver$SnapshotRead"); Constructor<?> constructor = readClass.getDeclaredConstructor(); constructor.setAccessible(true);
    Object read = constructor.newInstance(); Method matrix = readClass.getDeclaredMethod("matrix", View.class); matrix.setAccessible(true);
    View left = new EqualView(1), right = new EqualView(2); left.matrix.values[2] = 5; right.matrix.values[2] = 17;
    check(left.equals(right), "fixture equals collision"); check(matrix.invoke(read, left) != matrix.invoke(read, right), "cache must key native View identity");
    View failing = new View(3); failing.failMatrix = true;
    try { matrix.invoke(read, failing); throw new AssertionError("missing native getter error"); } catch (InvocationTargetException expected) { check(expected.getCause() instanceof IllegalStateException, "preserve native getter error"); }
    failing.failMatrix = false; check(matrix.invoke(read, failing) == failing.matrix, "failed read must not be cached");
    Method box = readClass.getDeclaredMethod("box", View.class, boolean.class); box.setAccessible(true);
    View invalid = hierarchy(3); invalid.density = 0;
    try { box.invoke(read, invalid, true); throw new AssertionError("nonfinite JSON must fail"); } catch (InvocationTargetException expected) { check(expected.getCause() instanceof JSONException, "preserve invalid geometry failure"); }
    invalid.density = 1; check(box.invoke(read, invalid, true) instanceof JSONObject, "failed box must not be cached");
    for (Class<?> type : List.of(OriginalObserver.class, CandidateObserver.class)) {
      reset(); View broken = hierarchy(2); broken.failMatrix = true; List<String> events = new ArrayList<>(); Owner owner = observer(type, broken, events);
      capture(owner, "sample"); check(events.size() == 1 && events.get(0).contains("invalid-native-geometry"), "error envelope is retained");
    }
  }
  static String eventMutationTrace(Class<?> type) throws Exception {
    reset(); View view = hierarchy(4); List<String> events = new ArrayList<>();
    Owner first = observer(type, view, events), second = observer(type, view, events);
    first.emit = data -> { events.add(data.toString()); view.matrix.values[2] += 37.75f; view.parentView().scrollX += 9; };
    capture(first, "mount-before"); capture(second, "mount-before");
    check(!events.get(0).equals(events.get(1)), "post-emit native mutation must reach the next observer");
    return events.toString();
  }
  static String encode(Owner owner, JSONObject value) throws Exception {
    try { return (String)invoke(owner, "encodeSnapshot", new Class<?>[]{JSONObject.class}, value); }
    catch (NoSuchMethodException original) { return value.toString(); }
  }
  static JSONObject payload(Object value) throws JSONException {
    return new JSONObject().put("platform", "android").put("value", value);
  }
  static JSONObject encodingControls(boolean compatibilityOnly) throws Exception {
    int originalCount = 0, candidateCount = 0; String originalTrace = null;
    for (Class<?> type : List.of(OriginalObserver.class, CandidateObserver.class)) {
      reset(); View view = hierarchy(7); List<String> events = new ArrayList<>(); Owner owner = observer(type, view, events);
      for (int index = 0; index < 12; index++) capture(owner, new String[]{"mount-before", "mount-after", "sample"}[index % 3]);
      check(events.size() == 12, "equal snapshots must still emit every mount/sample envelope");
      if (type == OriginalObserver.class) { originalCount = Counts.encodes; originalTrace = events.toString(); }
      else { candidateCount = Counts.encodes; check(originalTrace.equals(events.toString()), "encoding reuse changed complete envelopes"); }
    }
    if (!compatibilityOnly) check(originalCount == 12 && candidateCount == 1, "unchanged publication encoding count must be 12 -> 1");
    for (Class<?> type : List.of(OriginalObserver.class, CandidateObserver.class)) {
      reset(); Owner owner = observer(type, hierarchy(2), new ArrayList<>());
      JSONArray values = new JSONArray().put(new JSONObject().put("x", 1)); JSONObject mutable = payload(values);
      String first = encode(owner, mutable);
      ((JSONObject)values.get(0)).put("x", 2);
      String second = encode(owner, mutable);
      check(!first.equals(second), "nested mutable inputs must not compare equal to themselves after mutation");
      String positiveZero = encode(owner, payload(0.0)), negativeZero = encode(owner, payload(-0.0));
      check(!positiveZero.equals(negativeZero), "JSON-distinct signed zero must retain its encoded bytes");
      check(!encode(owner, payload(true)).equals(encode(owner, payload(1))), "boolean and numeric JSON types must stay distinct");
      JSONObject ordered = payload(new JSONObject().put("a", 1).put("b", 2));
      JSONObject reversed = payload(new JSONObject().put("b", 2).put("a", 1));
      check(!encode(owner, ordered).equals(encode(owner, reversed)), "object key order is encoded observable data");
      MutableNumber number = new MutableNumber(); JSONObject unknown = payload(number);
      String old = encode(owner, unknown); number.value = 2;
      check(!old.equals(encode(owner, unknown)), "unknown mutable Number must never be retained");
      List<String> events = new ArrayList<>(); View view = hierarchy(3); owner = observer(type, view, events);
      capture(owner, "sample"); owner.owner = "replacement"; owner.revision = "new-revision"; capture(owner, "sample");
      check(events.size() == 2 && events.get(1).contains("new-revision") && events.get(1).contains("replacement"), "snapshot reuse cannot reuse envelope authority");
      view.failMatrix = true; capture(owner, "sample"); view.failMatrix = false; capture(owner, "sample");
      check(events.size() == 4 && events.get(2).contains("invalid-native-geometry") && !events.get(3).contains("invalid-native-geometry"), "capture error and recovery must still publish");
    }
    reset(); View moving = hierarchy(4); Owner movingOwner = observer(CandidateObserver.class, moving, new ArrayList<>());
    for (int index = 0; index < 12; index++) { moving.left++; capture(movingOwner, "mount-after"); }
    check(Counts.encodes == 12, "real geometry changes must all encode and publish");
    CUIFocusView contentView = new CUIFocusView(81); contentView.content.put(1); List<String> contentEvents = new ArrayList<>();
    Owner contentOwner = observer(CandidateObserver.class, contentView, contentEvents);
    capture(contentOwner, "sample"); contentView.content.put(2); capture(contentOwner, "sample");
    check(!contentEvents.get(0).equals(contentEvents.get(1)), "actual snapshot contentBox mutation must be observed");
    if (!compatibilityOnly) {
    Owner configured = observer(CandidateObserver.class, hierarchy(2), new ArrayList<>());
    encode(configured, payload(3)); check(configured.lastEncodedSnapshot != null, "valid cache retained");
    invoke(configured, "configure", new Class<?>[]{String.class, String.class, String.class, boolean.class}, "replacement", "replacement-binding", "revision", true);
    check(configured.lastEncodedSnapshot == null && configured.lastSnapshotJSON == null, "authority replacement must retire encoding state");
    encode(configured, payload(3)); invoke(configured, "invalidate", new Class<?>[]{});
    check(configured.lastEncodedSnapshot == null && configured.lastSnapshotJSON == null, "invalidation must release retained data");
    }
    return new JSONObject().put("originalEncodes", originalCount).put("candidateEncodes", candidateCount).put("allPublicationEvents", 12)
      .put("nestedMutableInputs", true).put("keyOrderAndNumericTypes", true).put("authorityAndErrorRecovery", true);
  }
  public static void main(String[] args) throws Exception {
    boolean compatibilityOnly = Arrays.asList(args).contains("--compatibility-only");
    check(trace(OriginalObserver.class).equals(trace(CandidateObserver.class)), "complete capture envelopes/order/JSON bytes differ");
    JSONObject result = new JSONObject();
    for (int depth : new int[]{1, 2, 7, 20}) {
      reset(); View view = hierarchy(depth); Counts.reset(); String baseline = snapshot(OriginalObserver.class, view).toString(); JSONObject original = Counts.read();
      reset(); String candidate = snapshot(CandidateObserver.class, view).toString(); JSONObject fixed = Counts.read();
      check(baseline.equals(candidate), "exact snapshot bytes differ at depth " + depth);
      if (!compatibilityOnly) check(Counts.matrices == depth && Counts.locations == 1, "native matrix/location reads must occur once per actual View/snapshot");
      result.put("depth" + depth, new JSONObject().put("original", original).put("candidate", fixed));
    }
    freshSnapshots();
    check(eventMutationTrace(OriginalObserver.class).equals(eventMutationTrace(CandidateObserver.class)), "synchronous emit changes must be visible to the next snapshot");
    if (!compatibilityOnly) failureAndIdentity();
    result.put("exactSnapshotBytes", true).put("exactEventTrace", true).put("freshSnapshots", true).put("identityAndFailureControls", !compatibilityOnly);
    result.put("encoding", encodingControls(compatibilityOnly));
    System.out.println(result);
  }
}

class JSONException extends Exception { JSONException(String message) { super(message); } }
class JSONObject {
  static final Object NULL = new Object(); final Map<String, Object> values = new LinkedHashMap<>();
  JSONObject put(String key, Object value) throws JSONException { validate(value); values.put(key, value); return this; }
  static void validate(Object value) throws JSONException { if (value instanceof Double && !Double.isFinite((Double)value) || value instanceof Float && !Float.isFinite((Float)value)) throw new JSONException("nonfinite"); }
  Object get(String key) { return values.get(key); }
  Iterator<String> keys() { return values.keySet().iterator(); }
  int length() { return values.size(); }
  static String json(Object value) { if (value == null || value == NULL) return "null"; if (value instanceof String) return "\"" + ((String)value).replace("\\", "\\\\").replace("\"", "\\\"") + "\""; return value.toString(); }
  public String toString() { if (values.containsKey("platform")) GeometryFixture.Counts.encodes++; StringJoiner result = new StringJoiner(",", "{", "}"); values.forEach((key, value) -> result.add(json(key) + ":" + json(value))); return result.toString(); }
}
class JSONArray {
  final List<Object> values = new ArrayList<>();
  int length() { return values.size(); }
  Object get(int index) { return values.get(index); }
  JSONArray put(Object value) throws JSONException { JSONObject.validate(value); values.add(value); return this; }
  public String toString() { StringJoiner result = new StringJoiner(",", "[", "]"); for (Object value : values) result.add(JSONObject.json(value)); return result.toString(); }
}
class WritableMap extends JSONObject {
  void putString(String key, String value) { values.put(key, value); } void putInt(String key, int value) { values.put(key, value); }
  void putDouble(String key, double value) { values.put(key, value); } void putBoolean(String key, boolean value) { values.put(key, value); }
  String getString(String key) { return (String)values.get(key); } double getDouble(String key) { return ((Number)values.get(key)).doubleValue(); }
}
class Arguments { static WritableMap createMap() { return new WritableMap(); } }
class SystemClock { static long time; static long uptimeMillis() { return ++time; } }
class CUIInputWindow { static String identity(View view) { return "window"; } }
class CUIKeyboardScope extends View { CUIKeyboardScope(int id) { super(id); } void writeActivationSession(WritableMap map) {} }
interface ViewParent { ViewParent getParent(); }
class WindowParent implements ViewParent { public ViewParent getParent() { return null; } }
class Rect { int left = 1, top = 2, right = 10, bottom = 12; int width() { return right - left; } int height() { return bottom - top; } }
class Outline { boolean getRect(Rect rect) { return true; } boolean isEmpty() { return false; } float getRadius() { return 2.5f; } }
class OutlineProvider { void getOutline(View view, Outline outline) {} }
class View implements ViewParent {
  static final int NO_ID = -1, VISIBLE = 0, LAYOUT_DIRECTION_RTL = 1;
  final int id; ViewParent parent; int left, top, width = 100, height = 80, scrollX, scrollY, padding; double density = 1;
  boolean outline, attached = true, failMatrix; Matrix matrix = new Matrix();
  View(int id) { this.id = id; }
  public ViewParent getParent() { GeometryFixture.Counts.parents++; return parent; }
  View getRootView() { View view = this; while (view.parent instanceof View) view = (View)view.parent; return view; }
  View parentView() { return (View)parent; }
  Matrix getMatrix() { GeometryFixture.Counts.matrices++; if (failMatrix) throw new IllegalStateException("native getter failed"); return matrix; }
  void getLocationInWindow(int[] result) { GeometryFixture.Counts.locations++; result[0] = 3; result[1] = 7; }
  Resources getResources() { return new Resources(density); }
  boolean isAttachedToWindow() { return attached; } int getId() { return id; } int getLeft() { return left; } int getTop() { return top; }
  int getWidth() { return width; } int getHeight() { return height; } int getScrollX() { return scrollX; } int getScrollY() { return scrollY; }
  int getPaddingLeft() { return padding; } int getPaddingRight() { return padding + 1; } int getPaddingTop() { return padding + 2; } int getPaddingBottom() { return padding + 3; }
  int getLayoutDirection() { return id % 2; } int getVisibility() { return VISIBLE; } boolean isShown() { return true; } float getAlpha() { return .8f; }
  Rect getClipBounds() { return id % 2 == 0 ? new Rect() : null; } boolean getClipToOutline() { return outline; } OutlineProvider getOutlineProvider() { return new OutlineProvider(); }
}
class EqualView extends View { EqualView(int id) { super(id); } public boolean equals(Object other) { return other instanceof EqualView; } public int hashCode() { return 1; } }
class ViewGroup extends View { ViewGroup(int id) { super(id); } boolean getClipChildren() { return true; } boolean getClipToPadding() { return true; } }
class ReactViewGroup extends ViewGroup { String overflow = "visible"; ReactViewGroup(int id) { super(id); } String getOverflow() { return overflow; } }
class CUIFocusView extends View { final JSONArray content = new JSONArray(); CUIFocusView(int id) { super(id); } String motionProjectionRevision() { return "projection"; } JSONArray motionContentBox() { return content; } }
class MutableNumber extends Number { int value = 1; public int intValue() { return value; } public long longValue() { return value; } public float floatValue() { return value; } public double doubleValue() { return value; } public String toString() { return Integer.toString(value); } }
class Resources { final DisplayMetrics metrics; Resources(double density) { metrics = new DisplayMetrics(density); } DisplayMetrics getDisplayMetrics() { return metrics; } }
class DisplayMetrics { final float density; DisplayMetrics(double value) { density = (float)value; } }
class Matrix {
  float[] values;
  Matrix() { GeometryFixture.Counts.allocations++; values = new float[]{1,0,0,0,1,0,0,0,1}; }
  Matrix(Matrix source) { GeometryFixture.Counts.allocations++; values = source.values.clone(); }
  static float[] multiply(float[] left, float[] right) { float[] result = new float[9]; for (int row = 0; row < 3; row++) for (int column = 0; column < 3; column++) for (int index = 0; index < 3; index++) result[row * 3 + column] += left[row * 3 + index] * right[index * 3 + column]; return result; }
  void postConcat(Matrix other) { GeometryFixture.Counts.concatenations++; values = multiply(other.values, values); }
  void postTranslate(float x, float y) { values = multiply(new float[]{1,0,x,0,1,y,0,0,1}, values); }
  void preScale(float x, float y) { values = multiply(values, new float[]{x,0,0,0,y,0,0,0,1}); }
  void postScale(float x, float y) { values = multiply(new float[]{x,0,0,0,y,0,0,0,1}, values); }
  void mapPoints(float[] points) { for (int index = 0; index < points.length; index += 2) { float x = points[index], y = points[index + 1]; float denominator = values[6]*x + values[7]*y + values[8]; points[index] = (values[0]*x + values[1]*y + values[2])/denominator; points[index + 1] = (values[3]*x + values[4]*y + values[5])/denominator; } }
  void getValues(float[] output) { System.arraycopy(values, 0, output, 0, 9); }
}

// PRODUCTION_METHODS
