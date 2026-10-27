package com.codonui.input;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.PixelFormat;
import android.graphics.PorterDuff;
import android.graphics.drawable.BitmapDrawable;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.view.Surface;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.ViewTreeObserver;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.bridge.UIManager;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.proguard.annotations.DoNotStrip;
import java.lang.ref.WeakReference;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

@DoNotStrip
final class CUIBackdropRenderer implements LifecycleEventListener {
  private final ReactApplicationContext context;
  private final HashMap<String, Frame> frames = new HashMap<>();
  private final Handler main = new Handler(Looper.getMainLooper());
  private final HandlerThread thread = new HandlerThread("CUIBackdropFilter");
  private final Handler worker;
  private boolean retired;
  private boolean active = true;

  private final class Frame implements View.OnAttachStateChangeListener, ViewTreeObserver.OnPreDrawListener {
    WeakReference<View> source, receiver;
    IBinder sourceWindow, receiverWindow;
    String sourceSession, receiverSession, frameId;
    double generation;
    int sourceWidth, sourceHeight, width, height;
    int sourceTag, receiverTag;
    float[] mapping;
    AtomicBoolean current = new AtomicBoolean(true);
    AtomicBoolean settled = new AtomicBoolean();
    Bitmap staged;
    BitmapDrawable output;
    Promise pending;
    ImageReader reader;
    Runnable cancelCapture;
    boolean busy;
    ViewTreeObserver tree;

    void cancel(boolean clear) {
      boolean wasCurrent = current.getAndSet(false);
      staged = null;
      if (wasCurrent && cancelCapture != null) cancelCapture.run();
      if (clear && output != null) {
        View view = receiver.get();
        if (view != null) view.getOverlay().remove(output);
        output = null;
      }
    }
    void detach() {
      View from = source.get(), to = receiver.get();
      if (from != null) from.removeOnAttachStateChangeListener(this);
      if (to != null) to.removeOnAttachStateChangeListener(this);
      if (tree != null && tree.isAlive()) tree.removeOnPreDrawListener(this);
      tree = null;
      cancel(true);
    }
    @Override public void onViewAttachedToWindow(View view) {}
    @Override public void onViewDetachedFromWindow(View view) { cancel(true); }
    @Override public boolean onPreDraw() {
      View from = source.get(), to = receiver.get();
      if (from == null || to == null || !from.isAttachedToWindow() || !to.isAttachedToWindow() ||
          from.getId() != sourceTag || to.getId() != receiverTag ||
          from.getWindowToken() != sourceWindow || to.getWindowToken() != receiverWindow ||
          (current.get() && !attached(this))) cancel(true);
      return true;
    }
  }

  CUIBackdropRenderer(ReactApplicationContext context) {
    this.context = context;
    thread.start(); worker = new Handler(thread.getLooper());
    context.addLifecycleEventListener(this);
  }
  @DoNotStrip private static native byte[] nativeBlur(byte[] pixels, int width, int height, double sigma, AtomicBoolean current);
  private static void require(boolean allowed, String message) {
    if (!allowed) throw new IllegalStateException("Native backdrop: " + message);
  }
  private static String session(View view) {
    WritableMap value = Arguments.createMap();
    value.putString("windowId", CUIInputWindow.identity(view));
    value.putString("scopeOwnerId", ""); value.putDouble("epoch", 0);
    for (ViewParent parent = view.getParent(); parent != null; parent = parent.getParent())
      if (parent instanceof CUIKeyboardScope) { ((CUIKeyboardScope)parent).writeActivationSession(value); break; }
    return value.toHashMap().toString();
  }
  private static Matrix toScreen(View view) {
    Matrix result = new Matrix();
    View highest = view;
    for (View node = view; ; ) {
      result.postConcat(node.getMatrix());
      result.postTranslate(node.getLeft(), node.getTop());
      if (!(node.getParent() instanceof View)) { highest = node; break; }
      node = (View)node.getParent();
      result.postTranslate(-node.getScrollX(), -node.getScrollY());
    }
    float[] rootOrigin = {0, 0};
    highest.getMatrix().mapPoints(rootOrigin);
    int[] location = new int[2]; highest.getLocationOnScreen(location);
    result.postTranslate(location[0] - highest.getLeft() - rootOrigin[0],
        location[1] - highest.getTop() - rootOrigin[1]);
    return result;
  }
  private static void collectSessions(View view, ArrayList<String> values) {
    if (view instanceof CUIKeyboardScope) {
      WritableMap session = Arguments.createMap(); ((CUIKeyboardScope)view).writeActivationSession(session);
      values.add(view.getId() + ":" + session.toHashMap().toString());
    }
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) collectSessions(group.getChildAt(index), values);
    }
  }
  private static String sourceSession(View view) {
    ArrayList<String> children = new ArrayList<>(); collectSessions(view, children);
    return session(view) + ":" + children.toString();
  }
  private static Matrix mapping(View source, View receiver) {
    Matrix result = toScreen(source), inverse = new Matrix();
    require(toScreen(receiver).invert(inverse), "singular receiver transform");
    result.postConcat(inverse);
    float[] values = new float[9]; result.getValues(values);
    for (float value : values) require(Float.isFinite(value), "invalid capture transform");
    return result;
  }
  private static boolean descendant(View view, View root) {
    for (ViewParent parent = view.getParent(); parent != null; parent = parent.getParent()) if (parent == root) return true;
    return false;
  }
  private static void checkSurfaces(View view) {
    // A separate producer surface is not part of View.draw's hardware display list.
    require(!(view instanceof SurfaceView), "external surface capture is not complete");
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup)view;
      for (int index = 0; index < group.getChildCount(); index++) checkSurfaces(group.getChildAt(index));
    }
  }
  private boolean attached(Frame frame) {
    View source = frame.source.get(), receiver = frame.receiver.get();
    return !retired && active && frame.current.get() && source != null && receiver != null &&
        source.getId() == frame.sourceTag && receiver.getId() == frame.receiverTag &&
        source.isAttachedToWindow() && receiver.isAttachedToWindow() && receiver.hasWindowFocus() &&
        source.getWindowToken() == frame.sourceWindow && receiver.getWindowToken() == frame.receiverWindow &&
        sourceSession(source).equals(frame.sourceSession) && session(receiver).equals(frame.receiverSession);
  }
  private boolean geometry(Frame frame) {
    if (!attached(frame)) return false;
    View source = frame.source.get(), receiver = frame.receiver.get();
    float[] values = new float[9]; mapping(source, receiver).getValues(values);
    return source.getWidth() == frame.sourceWidth && source.getHeight() == frame.sourceHeight &&
        receiver.getWidth() == frame.width && receiver.getHeight() == frame.height && Arrays.equals(values, frame.mapping);
  }
  private static void reply(Promise promise, JSONObject response) { promise.resolve(response.toString()); }
  private void finish(String owner, Frame frame, AtomicBoolean token, Bitmap image, Exception failure) {
    UiThreadUtil.assertOnUiThread();
    if (frame.current != token) return;
    if (!frame.settled.compareAndSet(false, true)) return;
    frame.busy = false;
    frame.reader = null;
    frame.cancelCapture = null;
    Promise promise = frame.pending; frame.pending = null;
    try {
      if (failure != null && frame.current.get()) { promise.reject("E_CUI_BACKDROP", failure); return; }
      boolean staged = frames.get(owner) == frame && geometry(frame) && image != null;
      if (staged) frame.staged = image;
      reply(promise, new JSONObject().put("ownerId", owner).put("frameId", frame.frameId)
          .put("generation", frame.generation).put("staged", staged).put("superseded", !staged));
    } catch (Exception error) { promise.reject("E_CUI_BACKDROP", error); }
  }
  void request(String encoded, Promise promise) {
    UiThreadUtil.assertOnUiThread();
    try {
      JSONObject request = new JSONObject(encoded);
      Object rawOwner = request.get("ownerId"), rawAction = request.get("action");
      require(rawOwner instanceof String && !((String)rawOwner).isEmpty() && rawAction instanceof String,
          "owner/action required");
      String owner = (String)rawOwner, action = (String)rawAction;
      Frame frame = frames.get(owner);
      JSONObject response = new JSONObject().put("ownerId", owner);
      if ("release".equals(action)) {
        if (frame != null) frame.detach();
        frames.remove(owner); reply(promise, response.put("released", true)); return;
      }
      require(!retired, "renderer retired");
      if ("pause".equals(action)) {
        if (frame != null) frame.cancel(false);
        reply(promise, response.put("paused", true)); return;
      }
      if ("discard".equals(action) || "publish".equals(action)) {
        boolean matches = frame != null && frame.frameId.equals(request.getString("frameId")) &&
            frame.generation == request.getDouble("generation");
        response.put("frameId", request.get("frameId")).put("generation", request.get("generation"));
        if ("discard".equals(action)) {
          if (matches) frame.staged = null;
          reply(promise, response.put("discarded", true)); return;
        }
        boolean publish = matches && frame.staged != null && geometry(frame);
        if (publish) {
          View receiver = frame.receiver.get();
          BitmapDrawable output = new BitmapDrawable(receiver.getResources(), frame.staged);
          output.setBounds(0, 0, frame.width, frame.height);
          if (frame.output != null) receiver.getOverlay().remove(frame.output);
          receiver.getOverlay().add(output); frame.output = output;
        }
        if (matches) frame.staged = null;
        reply(promise, response.put("published", publish).put("superseded", !publish)); return;
      }
      require("capture".equals(action), "unknown action");
      for (String key : new String[]{"target", "receiver", "generation", "epoch", "radius"}) {
        Object value = request.get(key);
        require(value instanceof Number && Double.isFinite(((Number)value).doubleValue()) &&
            ((Number)value).doubleValue() >= 0, "invalid numeric value");
      }
      for (String key : new String[]{"target", "receiver"}) {
        double tag = request.getDouble(key);
        require(tag > 0 && tag <= Integer.MAX_VALUE && tag == Math.rint(tag), "invalid native tag");
      }
      String frameId = request.getString("frameId"); require(!frameId.isEmpty(), "frame identity required");
      UIManager manager = UIManagerHelper.getUIManagerForReactTag(context, request.getInt("target"));
      UIManager receiverManager = UIManagerHelper.getUIManagerForReactTag(context, request.getInt("receiver"));
      require(manager != null && receiverManager != null, "Fabric views unavailable");
      View source = manager.resolveView(request.getInt("target")), receiver = receiverManager.resolveView(request.getInt("receiver"));
      if (!active || source == null || receiver == null || !source.isAttachedToWindow() || !receiver.isAttachedToWindow()) {
        if (frame != null) frame.cancel(true);
        reply(promise, response.put("frameId", frameId).put("generation", request.get("generation"))
            .put("retired", true).put("staged", false)); return;
      }
      require(source != receiver && !descendant(receiver, source), "source/effect exclusion is not established");
      require(source.getDisplay() != null && receiver.getDisplay() != null &&
          source.getDisplay().getDisplayId() == receiver.getDisplay().getDisplayId(), "display changed");
      require(source.getWidth() > 0 && source.getHeight() > 0 && receiver.getWidth() > 0 && receiver.getHeight() > 0,
          "empty capture bounds");
      WritableMap activation = Arguments.createMap();
      for (ViewParent parent = receiver.getParent(); parent != null; parent = parent.getParent())
        if (parent instanceof CUIKeyboardScope) { ((CUIKeyboardScope)parent).writeActivationSession(activation); break; }
      if (!activation.hasKey("scopeOwnerId") || !request.getString("scopeOwnerId").equals(activation.getString("scopeOwnerId")) ||
          !request.getString("windowId").equals(activation.getString("windowId")) ||
          request.getDouble("epoch") != activation.getDouble("epoch")) {
        if (frame != null) frame.cancel(true);
        reply(promise, response.put("frameId", frameId).put("generation", request.get("generation"))
            .put("retired", true).put("staged", false)); return;
      }
      require(frame == null || !frame.busy, "capture already in flight");
      if (frame != null && (frame.source.get() != source || frame.receiver.get() != receiver)) {
        frame.detach(); frames.remove(owner); frame = null;
      }
      if (frame == null) {
        frame = new Frame(); frame.source = new WeakReference<>(source); frame.receiver = new WeakReference<>(receiver);
        source.addOnAttachStateChangeListener(frame); receiver.addOnAttachStateChangeListener(frame); frames.put(owner, frame);
        frame.tree = receiver.getViewTreeObserver(); frame.tree.addOnPreDrawListener(frame);
      }
      frame.current = new AtomicBoolean(true); frame.settled = new AtomicBoolean();
      frame.sourceWindow = source.getWindowToken(); frame.receiverWindow = receiver.getWindowToken();
      frame.sourceTag = source.getId(); frame.receiverTag = receiver.getId();
      frame.sourceSession = sourceSession(source); frame.receiverSession = session(receiver);
      frame.sourceWidth = source.getWidth(); frame.sourceHeight = source.getHeight();
      frame.width = receiver.getWidth(); frame.height = receiver.getHeight();
      Matrix mapping = mapping(source, receiver);
      frame.mapping = new float[9]; mapping.getValues(frame.mapping);
      frame.frameId = frameId; frame.generation = request.getDouble("generation"); frame.staged = null;
      checkSurfaces(source);
      Frame captured = frame;
      AtomicBoolean token = captured.current;
      double sigma = request.getDouble("radius") * receiver.getResources().getDisplayMetrics().density;
      captured.pending = promise; captured.busy = true;
      // API19 ImageReader plus API23 hardware Canvas cover the existing API24 minimum.
      ImageReader reader = ImageReader.newInstance(frame.width, frame.height, PixelFormat.RGBA_8888, 2);
      captured.reader = reader;
      AtomicBoolean readerClosed = new AtomicBoolean();
      Runnable closeReader = () -> { if (readerClosed.compareAndSet(false, true)) reader.close(); };
      captured.cancelCapture = () -> worker.post(() -> {
        closeReader.run(); main.post(() -> finish(owner, captured, token, null, null));
      });
      reader.setOnImageAvailableListener(available -> {
        Bitmap filtered = null;
        Exception failure = null;
        try (Image image = available.acquireLatestImage()) {
          require(image != null, "hardware capture is incomplete");
          require(token.get(), "frame retired");
          Image.Plane plane = image.getPlanes()[0];
          require(plane.getPixelStride() == 4 && image.getWidth() == captured.width && image.getHeight() == captured.height,
              "unexpected capture pixel format");
          ByteBuffer buffer = plane.getBuffer();
          byte[] rgba = new byte[Math.multiplyExact(Math.multiplyExact(captured.width, captured.height), 4)];
          for (int y = 0; y < captured.height; y++) {
            require(token.get(), "frame retired");
            buffer.position(y * plane.getRowStride()); buffer.get(rgba, y * captured.width * 4, captured.width * 4);
          }
          byte[] pixels = nativeBlur(rgba, captured.width, captured.height, sigma, token);
          int[] colors = new int[captured.width * captured.height];
          for (int index = 0; index < colors.length; index++) {
            int offset = index * 4, alpha = pixels[offset + 3] & 255;
            int red = alpha == 0 ? 0 : Math.min(255, ((pixels[offset] & 255) * 255 + alpha / 2) / alpha);
            int green = alpha == 0 ? 0 : Math.min(255, ((pixels[offset + 1] & 255) * 255 + alpha / 2) / alpha);
            int blue = alpha == 0 ? 0 : Math.min(255, ((pixels[offset + 2] & 255) * 255 + alpha / 2) / alpha);
            colors[index] = Color.argb(alpha, red, green, blue);
          }
          require(token.get(), "frame retired");
          filtered = Bitmap.createBitmap(colors, captured.width, captured.height, Bitmap.Config.ARGB_8888);
        } catch (Exception error) { failure = error; }
        finally { closeReader.run(); }
        Bitmap output = filtered; Exception error = failure;
        main.post(() -> finish(owner, captured, token, output, error));
      }, worker);
      Surface surface = reader.getSurface();
      try {
        Canvas canvas = surface.lockHardwareCanvas();
        try {
          canvas.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR);
          canvas.concat(mapping);
          source.draw(canvas);
        } finally { surface.unlockCanvasAndPost(canvas); }
      } catch (Exception error) {
        closeReader.run(); finish(owner, captured, token, null, error);
      }
    } catch (Exception error) { promise.reject("E_CUI_BACKDROP", error); }
  }
  void invalidate() {
    UiThreadUtil.assertOnUiThread();
    retired = true;
    for (Frame frame : frames.values()) frame.detach();
    frames.clear(); context.removeLifecycleEventListener(this); thread.quitSafely();
  }
  @Override public void onHostResume() { main.post(() -> active = true); }
  @Override public void onHostPause() {
    main.post(() -> { active = false; for (Frame frame : frames.values()) frame.cancel(true); });
  }
  @Override public void onHostDestroy() { main.post(this::invalidate); }
}
