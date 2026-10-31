package com.codonui.input;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.view.SurfaceView;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.ColorPropConverter;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.common.LifecycleState;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;

/** Private original-host draw operation. Only paint is substituted; native input/defaults stay live. */
@DoNotStrip
final class CUIForegroundRenderer implements LifecycleEventListener {
  interface DrawOriginal { void draw(Canvas canvas); }
  private final ViewGroup owner;
  private final String ownerId = "foreground-" + java.util.UUID.randomUUID();
  private final DrawOriginal original;
  private final Handler main = new Handler(Looper.getMainLooper());
  private HandlerThread thread;
  private Handler worker;
  private final Paint outputPaint = new Paint(Paint.FILTER_BITMAP_FLAG);
  private ReadableArray authoredFilters;
  private float authoredOpacity = 1, paintOpacity = 1;
  private boolean backfaceHidden;
  private double[] filters = new double[0];
  private boolean enabled, busy, filtering, capturing, failed;
  private boolean appActive, observingLifecycle;
  private long generation, frameId;
  private AtomicBoolean current;
  private CUIForegroundCompositionSource.Request request;
  private CUIForegroundCompositionRegistry.Registration registration;
  private Runnable removeRegistrationObserver;
  private CUIForegroundCompositionSource.Session session;
  private CUIForegroundCompositionSource.Request sessionIdentity, stagedIdentity;
  private Bitmap staged, pending;
  private CUIForegroundCompositionSource.Presentation pendingPresentation;
  private int stagedLeft, stagedTop;

  CUIForegroundRenderer(ViewGroup owner, DrawOriginal original) { this.owner = owner; this.original = original; }
  void setEnabled(boolean value) {
    if (enabled && !value) throw new IllegalStateException("Foreground ownership must be stable");
    enabled = value;
    if (enabled && owner.isAttachedToWindow()) attached();
  }
  boolean enabled() { return enabled; }
  void setFilters(ReadableArray value) { authoredFilters = value; }
  void setOpacity(float value) { authoredOpacity = value; }
  void setBackfaceVisibility(String value) { backfaceHidden = "hidden".equals(value); }
  void setPaintOpacity(float value) { paintOpacity = value; configure(); }
  private static double scalar(ReadableMap value, String field, double fallback) {
    return value.hasKey(field) && !value.isNull(field) ? value.getDouble(field) : fallback;
  }
  void configure() {
    if (!enabled) return;
    int length = authoredFilters == null ? 0 : authoredFilters.size();
    boolean front = owner.getRotationX() >= -90 && owner.getRotationX() < 90 && owner.getRotationY() >= -90 && owner.getRotationY() < 90;
    double opacity = authoredOpacity * paintOpacity * (backfaceHidden && !front ? 0 : 1);
    if (!Double.isFinite(opacity) || opacity < 0 || opacity > 1) throw new IllegalArgumentException("Foreground opacity invalid");
    double[] next = new double[(length + (opacity == 1 ? 0 : 1))*8];
    double density = owner.getResources().getDisplayMetrics().density;
    final String[] names = {"blur", "brightness", "contrast", "grayscale", "hueRotate", "invert", "opacity", "saturate", "sepia", "dropShadow"};
    for (int index = 0; index < length; index++) {
      ReadableMap map = authoredFilters.getMap(index);
      if (map == null) throw new IllegalArgumentException("Foreground filter missing");
      com.facebook.react.bridge.ReadableMapKeySetIterator keys = map.keySetIterator();
      if (!keys.hasNextKey()) throw new IllegalArgumentException("Foreground filter empty");
      String key = keys.nextKey();
      if (keys.hasNextKey()) throw new IllegalArgumentException("Foreground filter has multiple operations");
      int kind = Arrays.asList(names).indexOf(key), offset = index*8;
      if (kind < 0) throw new IllegalArgumentException("Unsupported foreground filter " + key);
      next[offset] = kind;
      if (kind == 9) {
        ReadableMap shadow = map.getMap(key);
        if (shadow == null) throw new IllegalArgumentException("Foreground shadow missing");
        next[offset+1] = scalar(shadow, "standardDeviation", 0)*density;
        next[offset+2] = scalar(shadow, "offsetX", 0)*density; next[offset+3] = scalar(shadow, "offsetY", 0)*density;
        Integer color = shadow.hasKey("color") && !shadow.isNull("color")
            ? ColorPropConverter.getColor(shadow.getType("color") == com.facebook.react.bridge.ReadableType.Map ? shadow.getMap("color") : shadow.getDouble("color"), owner.getContext()) : Color.BLACK;
        if (color == null) throw new IllegalStateException("Foreground color unavailable");
        next[offset+4] = Color.red(color)/255.0; next[offset+5] = Color.green(color)/255.0;
        next[offset+6] = Color.blue(color)/255.0; next[offset+7] = Color.alpha(color)/255.0;
      } else next[offset+1] = map.getDouble(key)*(kind == 0 ? density : 1);
    }
    if (opacity != 1) { next[length*8] = 6; next[length*8+1] = opacity; }
    // The SDK must not apply an additional partial filter/alpha stage to this original host.
    owner.setTag(com.facebook.react.R.id.filter, null);
    if (Build.VERSION.SDK_INT >= 31) owner.setRenderEffect(null);
    owner.setLayerType(Boolean.TRUE.equals(owner.getTag(com.facebook.react.R.id.use_hardware_layer)) ? View.LAYER_TYPE_HARDWARE : View.LAYER_TYPE_NONE, null); owner.setAlpha(1);
    if (!Arrays.equals(next, filters)) { filters = next; generation++; cancelFrame(); owner.invalidate(); }
    if (filters.length == 0) restore();
  }
  private void cancelFrame() {
    if (current != null) current.set(false);
    if (request != null) request.cancel(); request = null;
    if (!filtering) busy = false;
    if (pending != null) pending.recycle(); pending = null; pendingPresentation = null;
  }
  private void restore() {
    cancelFrame();
    CUIForegroundCompositionSource.Session old = session; session = null; sessionIdentity = null;
    if (removeRegistrationObserver != null) removeRegistrationObserver.run();
    removeRegistrationObserver = null; registration = null;
    try { if (old != null) old.retireForeground(); }
    finally { if (staged != null) staged.recycle(); staged = null; stagedIdentity = null; owner.invalidate(); }
  }
  void recycle() { detached(); enabled = false; failed = false; authoredFilters = null; authoredOpacity = 1; paintOpacity = 1; backfaceHidden = false; filters = new double[0]; generation++; }
  void attached() {
    if (!enabled || observingLifecycle) return;
    if (!(owner.getContext() instanceof ReactContext)) throw new IllegalStateException("Foreground owner has no original React lifecycle");
    ReactContext context = (ReactContext)owner.getContext();
    appActive = context.getLifecycleState() == LifecycleState.RESUMED;
    observingLifecycle = true; context.addLifecycleEventListener(this); owner.invalidate();
  }
  @Override public void onHostResume() { appActive = true; owner.invalidate(); }
  @Override public void onHostPause() { appActive = false; restore(); }
  @Override public void onHostDestroy() { appActive = false; detached(); }
  void detached() {
    if (observingLifecycle) { ((ReactContext)owner.getContext()).removeLifecycleEventListener(this); observingLifecycle = false; }
    restore();
    if (thread != null) thread.quitSafely(); thread = null; worker = null;
  }
  private boolean active() {
    return appActive && owner.isAttachedToWindow() && owner.getWindowToken() != null && owner.hasWindowFocus() &&
        owner.getWindowVisibility() == View.VISIBLE && owner.isShown();
  }
  private String epoch() {
    String result = CUIInputWindow.identity(owner);
    for (View view = owner; view != null; view = view.getParent() instanceof View ? (View)view.getParent() : null)
      if (view instanceof CUIKeyboardScope) {
        CUIKeyboardScope scope = (CUIKeyboardScope)view;
        result += "/" + scope.formActionOwnerId() + "@" + scope.formActionEpoch();
      }
    return result;
  }
  private float[] quad() {
    float[] points = {0,0,owner.getWidth(),0,owner.getWidth(),owner.getHeight(),0,owner.getHeight()};
    android.graphics.Matrix matrix = new android.graphics.Matrix();
    View highest;
    for (View node = owner; ; ) {
      matrix.postConcat(node.getMatrix()); matrix.postTranslate(node.getLeft(), node.getTop());
      if (!(node.getParent() instanceof View)) { highest = node; break; }
      node = (View)node.getParent(); matrix.postTranslate(-node.getScrollX(), -node.getScrollY());
    }
    float[] rootOrigin = {0,0}; highest.getMatrix().mapPoints(rootOrigin);
    int[] location = new int[2]; highest.getLocationOnScreen(location);
    matrix.postTranslate(location[0]-Math.round(highest.getLeft()+rootOrigin[0]), location[1]-Math.round(highest.getTop()+rootOrigin[1]));
    matrix.mapPoints(points);
    for (float value : points) if (!Float.isFinite(value)) throw new IllegalStateException("Foreground geometry unavailable");
    return points;
  }
  private static boolean opaque(View view) {
    if (view instanceof SurfaceView || view instanceof TextureView) return true;
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) if (opaque(group.getChildAt(index))) return true;
    }
    return false;
  }
  private static Rect ink(View view) {
    Rect result = new Rect(0, 0, view.getWidth(), view.getHeight());
    if (view instanceof com.facebook.react.views.view.ReactViewGroup) {
      Rect inset = ((com.facebook.react.views.view.ReactViewGroup)view).getOverflowInset();
      result.union(inset.left, inset.top, view.getWidth()-inset.right, view.getHeight()-inset.bottom);
    }
    if (view.getBackground() != null) {
      Rect padding = new Rect(); view.getBackground().getPadding(padding);
      result.union(-padding.left, -padding.top, view.getWidth()+padding.right, view.getHeight()+padding.bottom);
    }
    if (view instanceof ViewGroup && !((ViewGroup)view).getClipChildren()) {
      ViewGroup group = (ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) {
        View child = group.getChildAt(index); if (child.getVisibility() != View.VISIBLE) continue;
        android.graphics.RectF bounds = new android.graphics.RectF(ink(child)); child.getMatrix().mapRect(bounds);
        bounds.offset(child.getLeft()-group.getScrollX(), child.getTop()-group.getScrollY());
        result.union((int)Math.floor(bounds.left), (int)Math.floor(bounds.top), (int)Math.ceil(bounds.right), (int)Math.ceil(bounds.bottom));
      }
    }
    return result;
  }
  private boolean admit(CUIForegroundCompositionSource.Request expected) {
    return !failed && request == expected && !expected.isCancelled() && active() && expected.getOwner() == owner &&
        expected.sourceWindow == owner.getWindowToken() && expected.outputWindow == owner.getWindowToken() &&
        expected.sourceEpoch.equals(epoch()) && expected.outputEpoch.equals(epoch()) &&
        Arrays.equals(expected.getSourceScreenQuad(), quad()) && CUIForegroundCompositionRegistry.find(owner) == registration &&
        (registration == null || registration.isActive());
  }
  private void fail(Exception error) {
    failed = true; restore();
    throw new IllegalStateException("Native foreground: complete composition failed", error);
  }
  boolean draw(Canvas canvas) {
    if (!enabled || filters.length == 0) return false;
    attached();
    if (capturing) throw new IllegalStateException("Foreground source capture contains its own output");
    if (!active()) { restore(); return true; }
    if (failed) return true;
    try {
      if (registration != CUIForegroundCompositionRegistry.find(owner) ||
          (sessionIdentity != null && (sessionIdentity.sourceWindow != owner.getWindowToken() ||
            !sessionIdentity.sourceEpoch.equals(epoch())))) restore();
      if (stagedIdentity != null && (stagedIdentity.sourceWindow != owner.getWindowToken() || !stagedIdentity.sourceEpoch.equals(epoch()))) restore();
      if (pending != null) {
        CUIForegroundCompositionSource.Request expected = pendingPresentation.sourceFrame.request;
        if (admit(expected)) {
          if (session != null) session.presentForeground(pendingPresentation);
          if (staged != null) staged.recycle(); staged = pending; stagedIdentity = expected;
          stagedLeft = pendingPresentation.left; stagedTop = pendingPresentation.top;
        } else pending.recycle();
        pending = null; pendingPresentation = null;
      }
      if (!busy) capture();
      if (staged != null) canvas.drawBitmap(staged, stagedLeft, stagedTop, outputPaint);
      else original.draw(canvas);
      owner.postInvalidateOnAnimation();
    } catch (Exception error) { fail(error); }
    return true;
  }
  private void capture() {
    CUIForegroundCompositionRegistry.Registration provider = CUIForegroundCompositionRegistry.find(owner);
    if (provider == null && opaque(owner)) throw new IllegalStateException("Opaque foreground requires a registered composition source");
    Rect bounds = ink(owner); if (bounds.isEmpty()) { restore(); return; }
    CUIForegroundCompositionSource.Request next = new CUIForegroundCompositionSource.Request(
        provider == null ? owner : provider.getRoot(), owner, owner, owner, epoch(), epoch(), ownerId, generation, ++frameId,
        bounds, owner.getResources().getDisplayMetrics().density, quad(), quad());
    request = next; current = new AtomicBoolean(true); busy = true;
    if (provider != null) {
      if (session == null) {
        registration = provider; removeRegistrationObserver = provider.onRetire(this::restore);
        sessionIdentity = next; session = provider.source().prepareForeground(next);
        if (session == null) throw new IllegalStateException("Foreground provider did not prepare a session");
      }
      AtomicBoolean completed = new AtomicBoolean();
      session.captureForeground(next, (frame, error) -> {
        boolean duplicate = completed.getAndSet(true);
        main.post(() -> {
          if (next.isCancelled()) return;
          if (duplicate || error != null || frame == null) { busy = false; fail(error == null ? new IllegalStateException(duplicate ? "Foreground capture completed twice" : "Foreground capture missing") : error); return; }
          try { process(next, frame); } catch (Exception failure) { fail(failure); }
        });
      });
    } else {
      Bitmap bitmap = Bitmap.createBitmap(bounds.width(), bounds.height(), Bitmap.Config.ARGB_8888);
      try {
        Canvas target = new Canvas(bitmap); target.translate(-bounds.left, -bounds.top); capturing = true;
        original.draw(target);
        int[] colors = new int[Math.multiplyExact(bitmap.getWidth(), bitmap.getHeight())];
        bitmap.getPixels(colors,0,bitmap.getWidth(),0,0,bitmap.getWidth(),bitmap.getHeight());
        byte[] pixels = new byte[Math.multiplyExact(colors.length,4)];
        for (int index=0; index<colors.length; index++) {
          int color=colors[index], alpha=Color.alpha(color), offset=index*4;
          pixels[offset]=(byte)((Color.red(color)*alpha+127)/255);
          pixels[offset+1]=(byte)((Color.green(color)*alpha+127)/255);
          pixels[offset+2]=(byte)((Color.blue(color)*alpha+127)/255); pixels[offset+3]=(byte)alpha;
        }
        process(next, new CUIForegroundCompositionSource.Frame(next, bounds.width(), bounds.height(), pixels, true, true, false));
      } finally { capturing = false; bitmap.recycle(); }
    }
  }
  private void process(CUIForegroundCompositionSource.Request expected, CUIForegroundCompositionSource.Frame frame) {
    if (!admit(expected)) { busy = false; return; }
    if (frame.request != expected || !frame.complete || !frame.excludesOwnerEffectsAndOutput || frame.protectedContent ||
        frame.width != expected.width || frame.height != expected.height)
      throw new IllegalStateException("Foreground provider returned incomplete or mismatched pixels");
    byte[] capturedRGBA = frame.validatedRGBA(expected);
    if (worker == null) {
      thread = new HandlerThread("CUIForegroundFilter"); thread.start(); worker = new Handler(thread.getLooper());
    }
    AtomicBoolean token = current; double[] operations = filters.clone(); filtering = true;
    Handler filterWorker = worker;
    filterWorker.post(() -> {
      Result result = null; Exception error = null;
      try { System.loadLibrary("codon_motion"); result = nativeFilter(capturedRGBA, frame.width, frame.height, operations, token); }
      catch (Exception failure) { error = failure; }
      Result output = result; Exception failure = error;
      main.post(() -> {
        busy = false; filtering = false;
        if (!token.get() || !admit(expected)) return;
        if (failure != null || output == null) { fail(failure == null ? new IllegalStateException("Foreground output missing") : failure); return; }
        int[] colors = new int[Math.multiplyExact(output.width,output.height)];
        for (int index=0; index<colors.length; index++) {
          int offset=index*4, alpha=output.rgba[offset+3]&255;
          int red=alpha==0 ? 0 : Math.min(255,((output.rgba[offset]&255)*255+alpha/2)/alpha);
          int green=alpha==0 ? 0 : Math.min(255,((output.rgba[offset+1]&255)*255+alpha/2)/alpha);
          int blue=alpha==0 ? 0 : Math.min(255,((output.rgba[offset+2]&255)*255+alpha/2)/alpha);
          colors[index]=Color.argb(alpha,red,green,blue);
        }
        Bitmap bitmap = Bitmap.createBitmap(colors,output.width,output.height,Bitmap.Config.ARGB_8888);
        try {
          if (pending != null) pending.recycle(); pending = bitmap;
          pendingPresentation = new CUIForegroundCompositionSource.Presentation(frame,
              expected.left+output.left, expected.top+output.top, output.width, output.height);
          owner.invalidate();
        } catch (Exception presentationFailure) { bitmap.recycle(); fail(presentationFailure); }
      });
    });
  }
  @DoNotStrip
  static final class Result {
    final int left, top, width, height;
    final byte[] rgba;
    @DoNotStrip Result(int left, int top, int width, int height, byte[] rgba) {
      this.left = left; this.top = top; this.width = width; this.height = height; this.rgba = rgba;
    }
  }
  private static native Result nativeFilter(byte[] rgba, int width, int height, double[] filters, AtomicBoolean current);
}
