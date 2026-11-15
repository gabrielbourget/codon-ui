package com.codonui.input;

import android.graphics.Matrix;
import android.graphics.Outline;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.ViewTreeObserver;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.UIManagerListener;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.views.view.ReactViewGroup;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import java.util.Iterator;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.IdentityHashMap;
import java.util.WeakHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class CUIMotionGeometryObserver implements ViewTreeObserver.OnPreDrawListener {
  private static final AtomicLong sequences = new AtomicLong();
  private static final AtomicLong batches = new AtomicLong();
  private static final AtomicLong identitySequence = new AtomicLong();
  private static final WeakHashMap<View, String> identities = new WeakHashMap<>();
  private static String identity(View view) { String value = identities.get(view); if (value == null) { value = "android-geometry:" + identitySequence.incrementAndGet(); identities.put(view, value); } return value; }
  private static final WeakHashMap<UIManager, MountCoordinator> coordinators = new WeakHashMap<>();
  private final WeakReference<View> root;
  private final Consumer<WritableMap> emit;
  private String owner = "", binding = "", revision = "", attachment = "", lastFrame = "";
  private String lastWindow = "", lastScope = "";
  private double lastEpoch;
  private long attachmentRevision;
  private Object lastEncodedSnapshot;
  private String lastSnapshotJSON;
  private boolean enabled;
  private boolean observeFrames = true;
  private MountCoordinator coordinator;
  private ViewTreeObserver tree;

  CUIMotionGeometryObserver(View view, Consumer<WritableMap> emit) { root = new WeakReference<>(view); this.emit = emit; }
  void configure(String owner, String binding, String revision, boolean observeFrames) {
    boolean changed = !this.owner.equals(owner) || !this.binding.equals(binding);
    if (changed) { resetEncoding(); disconnect(); attachment = ""; attachmentRevision++; lastFrame = ""; }
    if (changed) { lastWindow = ""; lastScope = ""; lastEpoch = 0; }
    if (this.observeFrames != observeFrames) lastFrame = "";
    this.observeFrames = observeFrames;
    this.owner = owner; this.binding = binding; this.revision = revision; enabled = !binding.isEmpty();
    connect();
  }
  private void connect() {
    View view = root.get();
    if (!enabled || view == null || !view.isAttachedToWindow()) return;
    if (!observeFrames && tree != null) { if (tree.isAlive()) tree.removeOnPreDrawListener(this); tree = null; }
    if (observeFrames && (tree == null || !tree.isAlive())) { tree = view.getViewTreeObserver(); tree.addOnPreDrawListener(this); }
    if (coordinator == null && view.getContext() instanceof ReactContext) {
      UIManager manager = UIManagerHelper.getUIManagerForReactTag((ReactContext)view.getContext(), view.getId());
      if (manager != null) {
        MountCoordinator existing = coordinators.get(manager);
        if (existing == null) { existing = new MountCoordinator(manager); coordinators.put(manager, existing); manager.addUIManagerEventListener(existing); }
        coordinator = existing; existing.add(this);
      }
    }
  }
  private void disconnect() {
    if (tree != null && tree.isAlive()) tree.removeOnPreDrawListener(this);
    tree = null;
    if (coordinator != null) { MountCoordinator previous = coordinator; coordinator = null; previous.remove(this); }
  }
  // A query may have already observed this attachment before the lifecycle callback.
  // Real detach/configuration changes clear attachment at their own boundary.
  void attached() { connect(); capture("sample", "", ""); }
  void detached() { if (enabled) capture("detached", "", ""); disconnect(); attachment = ""; attachmentRevision++; }
  void invalidate() { resetEncoding(); disconnect(); enabled = false; binding = ""; owner = ""; attachment = ""; attachmentRevision++; }
  void query(String owner, String binding, String requestId) {
    if (enabled && this.owner.equals(owner) && this.binding.equals(binding) && !requestId.isEmpty()) capture("sample", requestId, "");
  }
  JSONObject snapshotIdentity() throws JSONException {
    View view = root.get();
    if (!enabled || view == null || !view.isAttachedToWindow()) throw new IllegalStateException("motion-owner-detached");
    WritableMap session = Arguments.createMap();
    session.putString("windowId", CUIInputWindow.identity(view)); session.putString("scopeOwnerId", ""); session.putDouble("epoch", 0);
    for (ViewParent parent = view.getParent(); parent != null; parent = parent.getParent()) {
      if (parent instanceof CUIKeyboardScope) { ((CUIKeyboardScope)parent).writeActivationSession(session); break; }
    }
    String current = session.getString("windowId") + "|" + session.getString("scopeOwnerId") + "|" + session.getDouble("epoch");
    if (!attachment.equals(current)) throw new IllegalStateException("motion-owner-awaiting-geometry");
    return new JSONObject().put("ownerId", owner).put("bindingId", binding).put("target", view.getId())
      .put("windowId", session.getString("windowId")).put("scopeOwnerId", session.getString("scopeOwnerId"))
      .put("epoch", session.getDouble("epoch")).put("attachmentRevision", attachmentRevision).put("nativeViewRevision", revision);
  }
  @Override public boolean onPreDraw() { if (observeFrames) capture("frame", "", ""); return true; }

  private Supplier<WritableMap> envelope(String kind, String requestId, String transaction, View view, boolean attached) {
    String capturedOwner = owner, capturedBinding = binding;
    int target = view == null ? View.NO_ID : view.getId();
    String window = attached ? CUIInputWindow.identity(view) : lastWindow;
    String scopeOwner = attached ? "" : lastScope;
    double epoch = attached ? 0 : lastEpoch;
    if (attached) for (ViewParent parent = view.getParent(); parent != null; parent = parent.getParent()) {
      if (parent instanceof CUIKeyboardScope) {
        CUIKeyboardScope scope = (CUIKeyboardScope)parent;
        scopeOwner = scope.menuPointerOwnerId(); window = CUIInputWindow.identity(scope); epoch = scope.menuPointerEpoch(); break;
      }
    }
    if (attached) { lastWindow = window; lastScope = scopeOwner; lastEpoch = epoch; }
    String current = window + "|" + scopeOwner + "|" + epoch;
    if (!attachment.equals(current)) { attachment = current; attachmentRevision++; lastFrame = ""; }
    String capturedWindow = window, capturedScope = scopeOwner, capturedRevision = revision;
    double capturedEpoch = epoch;
    long capturedAttachment = attachmentRevision, geometryRevision = sequences.incrementAndGet(), observedAt = SystemClock.uptimeMillis();
    // Reserve capture identity/time before reading geometry, but avoid JNI maps for rejected no-op frames.
    return () -> {
      WritableMap data = Arguments.createMap();
      data.putString("ownerId", capturedOwner); data.putString("bindingId", capturedBinding); data.putInt("target", target);
      data.putString("windowId", capturedWindow); data.putString("scopeOwnerId", capturedScope); data.putDouble("epoch", capturedEpoch);
      data.putDouble("attachmentRevision", capturedAttachment); data.putDouble("geometryRevision", geometryRevision);
      data.putString("commitRevision", capturedRevision); data.putString("transactionId", transaction); data.putString("kind", kind); data.putString("requestId", requestId);
      data.putBoolean("attached", attached); data.putDouble("observedAt", observedAt);
      return data;
    };
  }
  private void capture(String kind, String requestId, String transaction) {
    if (!enabled || ("frame".equals(kind) && !observeFrames)) return;
    View view = root.get();
    boolean attached = view != null && view.isAttachedToWindow() && !"detached".equals(kind);
    Supplier<WritableMap> pendingEnvelope = envelope(kind, requestId, transaction, view, attached);
    String snapshot = "", error = "";
    // ReadableNativeMap caches its first imported keys; retain capture facts outside the write-only payload.
    if (!attached) { resetEncoding(); error = "native-geometry-view-detached"; }
    else try { snapshot = encodeSnapshot(snapshot(view).put("mountObservationAvailable", coordinator != null)); } catch (JSONException | RuntimeException failure) { resetEncoding(); error = "invalid-native-geometry"; }
    if ("frame".equals(kind) && snapshot.equals(lastFrame) && error.isEmpty()) return;
    WritableMap data = pendingEnvelope.get();
    if ("frame".equals(kind)) lastFrame = snapshot;
    data.putString("snapshot", snapshot); data.putString("error", error); emit.accept(data);
  }
  private void resetEncoding() { lastEncodedSnapshot = null; lastSnapshotJSON = null; }
  private String encodeSnapshot(JSONObject value) {
    try {
      if (lastSnapshotJSON != null && equalSnapshot(value, lastEncodedSnapshot)) return lastSnapshotJSON;
    } catch (JSONException | RuntimeException ignored) { /* A cache miss must retain normal encoding behavior. */ }
    resetEncoding();
    String encoded = value.toString();
    if (encoded != null) try {
      Object retained = retainSnapshot(value);
      lastEncodedSnapshot = retained; lastSnapshotJSON = encoded;
    } catch (JSONException | RuntimeException ignored) { /* Unknown/mutable JSON leaves are never retained. */ }
    return encoded;
  }
  private static boolean immutableJSONLeaf(Object value) {
    return value == null || value == JSONObject.NULL || value instanceof String || value instanceof Boolean ||
      value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long ||
      value instanceof Float || value instanceof Double || value.getClass() == java.math.BigInteger.class || value.getClass() == java.math.BigDecimal.class;
  }
  private static Object retainSnapshot(Object value) throws JSONException {
    if (value instanceof JSONObject) {
      LinkedHashMap<String, Object> retained = new LinkedHashMap<>();
      Iterator<String> keys = ((JSONObject)value).keys();
      while (keys.hasNext()) { String key = keys.next(); retained.put(key, retainSnapshot(((JSONObject)value).get(key))); }
      return retained;
    }
    if (value instanceof JSONArray) {
      JSONArray values = (JSONArray)value; List<Object> retained = new ArrayList<>(values.length());
      for (int index = 0; index < values.length(); index++) retained.add(retainSnapshot(values.get(index)));
      return retained;
    }
    if (!immutableJSONLeaf(value)) throw new IllegalArgumentException("mutable-json-leaf");
    return value;
  }
  private static boolean equalSnapshot(Object value, Object retained) throws JSONException {
    if (value instanceof JSONObject) {
      if (!(retained instanceof Map) || ((JSONObject)value).length() != ((Map<?, ?>)retained).size()) return false;
      Iterator<String> keys = ((JSONObject)value).keys(); Iterator<? extends Map.Entry<?, ?>> previous = ((Map<?, ?>)retained).entrySet().iterator();
      while (keys.hasNext()) {
        String key = keys.next(); Map.Entry<?, ?> entry = previous.next();
        if (!key.equals(entry.getKey()) || !equalSnapshot(((JSONObject)value).get(key), entry.getValue())) return false;
      }
      return true;
    }
    if (value instanceof JSONArray) {
      if (!(retained instanceof List) || ((JSONArray)value).length() != ((List<?>)retained).size()) return false;
      JSONArray values = (JSONArray)value;
      for (int index = 0; index < values.length(); index++) if (!equalSnapshot(values.get(index), ((List<?>)retained).get(index))) return false;
      return true;
    }
    // Class equality is conservative: unlike numeric coercion it cannot merge JSON-distinct -0 or booleans.
    return immutableJSONLeaf(value) && (value == null ? retained == null : retained != null && value.getClass() == retained.getClass() && value.equals(retained));
  }
  private static JSONArray numbers(double... values) throws JSONException {
    JSONArray result = new JSONArray(); for (double value : values) result.put(value); return result;
  }
  private static double density(View view) { return view.getResources().getDisplayMetrics().density; }
  private static JSONArray matrix(Matrix nativeMatrix, double density) throws JSONException {
    Matrix normalized = new Matrix(nativeMatrix); normalized.preScale((float)density, (float)density); normalized.postScale((float)(1 / density), (float)(1 / density));
    float[] values = new float[9]; normalized.getValues(values); JSONArray result = new JSONArray(); for (float value : values) result.put((double)value); return result;
  }
  // Read reuse ends before emitting: event listeners may synchronously update native views.
  private static final class SnapshotRead {
    private final IdentityHashMap<View, Matrix> matrices = new IdentityHashMap<>();
    private final IdentityHashMap<View, ViewParent> parents = new IdentityHashMap<>();
    private final IdentityHashMap<View, int[]> locations = new IdentityHashMap<>();
    private final IdentityHashMap<View, JSONObject> transformedBoxes = new IdentityHashMap<>();
    private final IdentityHashMap<View, JSONObject> untransformedBoxes = new IdentityHashMap<>();
    Matrix matrix(View view) {
      Matrix value = matrices.get(view);
      if (value == null) { value = view.getMatrix(); matrices.put(view, value); }
      return value;
    }
    ViewParent parent(View view) {
      if (!parents.containsKey(view)) parents.put(view, view.getParent());
      return parents.get(view);
    }
    int[] location(View view) {
      int[] value = locations.get(view);
      if (value == null) { value = new int[2]; view.getLocationInWindow(value); locations.put(view, value); }
      return value;
    }
    JSONObject box(View view, boolean transformed) throws JSONException {
      IdentityHashMap<View, JSONObject> boxes = transformed ? transformedBoxes : untransformedBoxes;
      JSONObject value = boxes.get(view);
      if (value == null) { value = CUIMotionGeometryObserver.box(view, transformed, this); boxes.put(view, value); }
      return value;
    }
  }
  private static Matrix toWindow(View view, boolean transformed, SnapshotRead read) {
    View highest = view; Matrix result = new Matrix();
    for (View node = view; node != null;) {
      if (node != view) result.postTranslate(-node.getScrollX(), -node.getScrollY());
      if (transformed) result.postConcat(read.matrix(node));
      result.postTranslate(node.getLeft(), node.getTop()); highest = node;
      ViewParent parent = read.parent(node); node = parent instanceof View ? (View)parent : null;
    }
    // Public window coordinates supply the integral ViewRoot scroll correction;
    // hierarchy matrices retain subpixel transforms that integer locations lose.
    float[] origin = new float[]{0, 0}; read.matrix(highest).mapPoints(origin);
    int[] actual = read.location(highest);
    result.postTranslate(actual[0] - Math.round(origin[0] + highest.getLeft()), actual[1] - Math.round(origin[1] + highest.getTop()));
    return result;
  }
  private static JSONObject box(View view, boolean transformed, SnapshotRead read) throws JSONException {
    double density = density(view); Matrix matrix = toWindow(view, transformed, read);
    float[] points = new float[]{0, 0, view.getWidth(), 0, view.getWidth(), view.getHeight(), 0, view.getHeight()}; matrix.mapPoints(points);
    double minX = Double.POSITIVE_INFINITY, minY = Double.POSITIVE_INFINITY, maxX = Double.NEGATIVE_INFINITY, maxY = Double.NEGATIVE_INFINITY;
    JSONArray quad = new JSONArray();
    for (int index = 0; index < 8; index += 2) {
      double x = points[index] / density, y = points[index + 1] / density; quad.put(x); quad.put(y);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return new JSONObject().put("quad", quad).put("box", numbers(minX, minY, maxX - minX, maxY - minY)).put("toWindowMatrix", matrix(matrix, density));
  }
  private static JSONObject ancestor(View view, SnapshotRead read) throws JSONException {
    double density = density(view); Rect clip = view.getClipBounds(); JSONObject clipping = new JSONObject();
    clipping.put("rect", clip == null ? JSONObject.NULL : numbers(clip.left / density, clip.top / density, clip.width() / density, clip.height() / density));
    clipping.put("children", view instanceof ViewGroup && ((ViewGroup)view).getClipChildren());
    clipping.put("padding", view instanceof ViewGroup && ((ViewGroup)view).getClipToPadding());
    clipping.put("overflow", view instanceof ReactViewGroup ? ((ReactViewGroup)view).getOverflow() : JSONObject.NULL);
    boolean outline = view.getClipToOutline(); clipping.put("outline", outline); clipping.put("outlineRect", JSONObject.NULL); clipping.put("outlineRadius", JSONObject.NULL);
    boolean complete = true;
    if (outline && view.getOutlineProvider() != null) {
      Outline shape = new Outline(); view.getOutlineProvider().getOutline(view, shape); Rect rect = new Rect();
      if (shape.getRect(rect)) { clipping.put("outlineRect", numbers(rect.left / density, rect.top / density, rect.width() / density, rect.height() / density)); clipping.put("outlineRadius", shape.getRadius() / density); }
      else if (!shape.isEmpty()) complete = false;
    }
    // RN overflow can use a rounded padding path rather than its reported Rect.
    // Preserve that distinction until the path is observed/resolved faithfully.
    if (view instanceof ReactViewGroup && !"visible".equals(((ReactViewGroup)view).getOverflow())) complete = false;
    clipping.put("complete", complete);
    return new JSONObject().put("tag", view.getId()).put("identity", identity(view)).put("projectionRevision", view instanceof CUIFocusView ? ((CUIFocusView)view).motionProjectionRevision() : "").put("layoutDirection", view.getLayoutDirection() == View.LAYOUT_DIRECTION_RTL ? "rtl" : "ltr")
      .put("bounds", numbers(0, 0, view.getWidth() / density, view.getHeight() / density))
      .put("layout", numbers(view.getLeft() / density, view.getTop() / density, view.getWidth() / density, view.getHeight() / density))
      .put("visible", view.getVisibility() == View.VISIBLE).put("shown", view.isShown()).put("opacity", view.getAlpha())
      .put("scroll", numbers(view.getScrollX() / density, view.getScrollY() / density))
      .put("padding", numbers(view.getPaddingLeft() / density, view.getPaddingTop() / density, view.getPaddingRight() / density, view.getPaddingBottom() / density))
      .put("matrix", matrix(read.matrix(view), density)).put("model", read.box(view, true)).put("clip", clipping);
  }
  private static JSONObject snapshot(View view) throws JSONException {
    SnapshotRead read = new SnapshotRead();
    View windowRoot = view.getRootView(); JSONArray chain = new JSONArray();
    for (View node = view; node != null;) { chain.put(ancestor(node, read)); ViewParent parent = read.parent(node); node = parent instanceof View ? (View)parent : null; }
    double density = density(view); JSONObject model = read.box(view, true);
    return new JSONObject().put("platform", "android").put("coordinateSpace", "window").put("units", "dp").put("density", density)
      .put("matrixFormat", "android-row-major-3x3").put("rootTag", windowRoot.getId()).put("rootIdentity", identity(windowRoot))
      .put("root", read.box(windowRoot, false)).put("layout", numbers(view.getLeft() / density, view.getTop() / density, view.getWidth() / density, view.getHeight() / density))
      .put("untransformed", read.box(view, false)).put("model", model).put("presentation", model).put("presentationSource", "android-view-render-node-matrix")
      .put("ancestors", chain).put("contentBox", view instanceof CUIFocusView ? ((CUIFocusView)view).motionContentBox() : JSONObject.NULL);
  }
  static JSONObject querySnapshot(View view) throws JSONException {
    return snapshot(view).put("mountObservationAvailable", false);
  }
  @androidx.annotation.OptIn(markerClass = com.facebook.react.common.annotations.UnstableReactNativeAPI.class)
  private static final class MountCoordinator implements UIManagerListener {
    private final WeakReference<UIManager> manager;
    private final List<WeakReference<CUIMotionGeometryObserver>> observers = new ArrayList<>();
    private String transaction = "";
    MountCoordinator(UIManager manager) { this.manager = new WeakReference<>(manager); }
    void add(CUIMotionGeometryObserver observer) { observers.add(new WeakReference<>(observer)); }
    void remove(CUIMotionGeometryObserver observer) {
      observers.removeIf(reference -> reference.get() == null || reference.get() == observer);
      UIManager live = manager.get(); if (observers.isEmpty() && live != null) { live.removeUIManagerEventListener(this); coordinators.remove(live); }
    }
    private void capture(String kind) { for (WeakReference<CUIMotionGeometryObserver> reference : new ArrayList<>(observers)) { CUIMotionGeometryObserver observer = reference.get(); if (observer != null) observer.capture(kind, "", transaction); } }
    @Override public void willMountItems(UIManager manager) { transaction = "android-mount-batch:" + batches.incrementAndGet(); capture("mount-before"); }
    @Override public void didMountItems(UIManager manager) { if (transaction.isEmpty()) transaction = "android-mount-batch:" + batches.incrementAndGet(); capture("mount-after"); transaction = ""; }
    @Override public void willDispatchViewUpdates(UIManager manager) { }
    @Override public void didDispatchMountItems(UIManager manager) { }
    @Override public void didScheduleMountItems(UIManager manager) { }
  }
}
