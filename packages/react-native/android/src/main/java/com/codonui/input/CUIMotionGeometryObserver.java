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
import java.util.WeakHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;
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
  private boolean enabled;
  private boolean observeFrames = true;
  private MountCoordinator coordinator;
  private ViewTreeObserver tree;

  CUIMotionGeometryObserver(View view, Consumer<WritableMap> emit) { root = new WeakReference<>(view); this.emit = emit; }
  void configure(String owner, String binding, String revision, boolean observeFrames) {
    boolean changed = !this.owner.equals(owner) || !this.binding.equals(binding);
    if (changed) { disconnect(); attachment = ""; attachmentRevision++; lastFrame = ""; }
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
  void attached() { attachment = ""; connect(); capture("sample", "", ""); }
  void detached() { if (enabled) capture("detached", "", ""); disconnect(); attachment = ""; attachmentRevision++; }
  void invalidate() { disconnect(); enabled = false; binding = ""; owner = ""; attachment = ""; attachmentRevision++; }
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

  private WritableMap envelope(String kind, String requestId, String transaction, View view, boolean attached) {
    WritableMap data = Arguments.createMap();
    data.putString("ownerId", owner); data.putString("bindingId", binding); data.putInt("target", view == null ? View.NO_ID : view.getId());
    data.putString("windowId", attached ? CUIInputWindow.identity(view) : ""); data.putString("scopeOwnerId", ""); data.putDouble("epoch", 0);
    if (attached) for (ViewParent parent = view.getParent(); parent != null; parent = parent.getParent()) {
      if (parent instanceof CUIKeyboardScope) { ((CUIKeyboardScope)parent).writeActivationSession(data); break; }
    }
    if (attached) { lastWindow = data.getString("windowId"); lastScope = data.getString("scopeOwnerId"); lastEpoch = data.getDouble("epoch"); }
    else { data.putString("windowId", lastWindow); data.putString("scopeOwnerId", lastScope); data.putDouble("epoch", lastEpoch); }
    String current = data.getString("windowId") + "|" + data.getString("scopeOwnerId") + "|" + data.getDouble("epoch");
    if (!attachment.equals(current)) { attachment = current; attachmentRevision++; lastFrame = ""; }
    data.putDouble("attachmentRevision", attachmentRevision); data.putDouble("geometryRevision", sequences.incrementAndGet());
    data.putString("commitRevision", revision); data.putString("transactionId", transaction); data.putString("kind", kind); data.putString("requestId", requestId);
    data.putBoolean("attached", attached); data.putDouble("observedAt", SystemClock.uptimeMillis());
    return data;
  }
  private void capture(String kind, String requestId, String transaction) {
    if (!enabled || ("frame".equals(kind) && !observeFrames)) return;
    View view = root.get();
    boolean attached = view != null && view.isAttachedToWindow() && !"detached".equals(kind);
    WritableMap data = envelope(kind, requestId, transaction, view, attached);
    String snapshot = "", error = "";
    // ReadableNativeMap caches its first imported keys; retain capture facts outside the write-only payload.
    if (!attached) error = "native-geometry-view-detached";
    else try { snapshot = snapshot(view).put("mountObservationAvailable", coordinator != null).toString(); } catch (JSONException | RuntimeException failure) { error = "invalid-native-geometry"; }
    if ("frame".equals(kind) && snapshot.equals(lastFrame) && error.isEmpty()) return;
    if ("frame".equals(kind)) lastFrame = snapshot;
    data.putString("snapshot", snapshot); data.putString("error", error); emit.accept(data);
  }
  private static JSONArray numbers(double... values) throws JSONException {
    JSONArray result = new JSONArray(); for (double value : values) result.put(value); return result;
  }
  private static double density(View view) { return view.getResources().getDisplayMetrics().density; }
  private static JSONArray matrix(Matrix nativeMatrix, double density) throws JSONException {
    Matrix normalized = new Matrix(nativeMatrix); normalized.preScale((float)density, (float)density); normalized.postScale((float)(1 / density), (float)(1 / density));
    float[] values = new float[9]; normalized.getValues(values); JSONArray result = new JSONArray(); for (float value : values) result.put((double)value); return result;
  }
  private static Matrix toWindow(View view, boolean transformed) {
    View highest = view; Matrix result = new Matrix();
    for (View node = view; node != null;) {
      if (node != view) result.postTranslate(-node.getScrollX(), -node.getScrollY());
      if (transformed) result.postConcat(node.getMatrix());
      result.postTranslate(node.getLeft(), node.getTop()); highest = node;
      ViewParent parent = node.getParent(); node = parent instanceof View ? (View)parent : null;
    }
    // Public window coordinates supply the integral ViewRoot scroll correction;
    // hierarchy matrices retain subpixel transforms that integer locations lose.
    float[] origin = new float[]{0, 0}; highest.getMatrix().mapPoints(origin);
    int[] actual = new int[2]; highest.getLocationInWindow(actual);
    result.postTranslate(actual[0] - Math.round(origin[0] + highest.getLeft()), actual[1] - Math.round(origin[1] + highest.getTop()));
    return result;
  }
  private static JSONObject box(View view, boolean transformed) throws JSONException {
    double density = density(view); Matrix matrix = toWindow(view, transformed);
    float[] points = new float[]{0, 0, view.getWidth(), 0, view.getWidth(), view.getHeight(), 0, view.getHeight()}; matrix.mapPoints(points);
    double minX = Double.POSITIVE_INFINITY, minY = Double.POSITIVE_INFINITY, maxX = Double.NEGATIVE_INFINITY, maxY = Double.NEGATIVE_INFINITY;
    JSONArray quad = new JSONArray();
    for (int index = 0; index < 8; index += 2) {
      double x = points[index] / density, y = points[index + 1] / density; quad.put(x); quad.put(y);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    return new JSONObject().put("quad", quad).put("box", numbers(minX, minY, maxX - minX, maxY - minY)).put("toWindowMatrix", matrix(matrix, density));
  }
  private static JSONObject ancestor(View view) throws JSONException {
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
      .put("matrix", matrix(view.getMatrix(), density)).put("model", box(view, true)).put("clip", clipping);
  }
  private static JSONObject snapshot(View view) throws JSONException {
    View windowRoot = view.getRootView(); JSONArray chain = new JSONArray();
    for (View node = view; node != null;) { chain.put(ancestor(node)); ViewParent parent = node.getParent(); node = parent instanceof View ? (View)parent : null; }
    double density = density(view); JSONObject model = box(view, true);
    return new JSONObject().put("platform", "android").put("coordinateSpace", "window").put("units", "dp").put("density", density)
      .put("matrixFormat", "android-row-major-3x3").put("rootTag", windowRoot.getId()).put("rootIdentity", identity(windowRoot))
      .put("root", box(windowRoot, false)).put("layout", numbers(view.getLeft() / density, view.getTop() / density, view.getWidth() / density, view.getHeight() / density))
      .put("untransformed", box(view, false)).put("model", model).put("presentation", model).put("presentationSource", "android-view-render-node-matrix")
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
