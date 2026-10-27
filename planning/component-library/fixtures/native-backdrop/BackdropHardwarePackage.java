package com.codonui.fixture;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import com.codonui.input.CUIBackdropCaptureRegistry;
import com.codonui.input.CUIBackdropCaptureRegistration;
import com.codonui.input.CUIBackdropCaptureSource;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/** Non-shipping, owned underlay compositor. Uses the exact buffer submitted to its hardware Surface. */
public final class BackdropHardwarePackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) { return Collections.emptyList(); }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) { return Collections.singletonList(new Manager()); }

  public static final class Manager extends ReactViewManager {
    @Override public String getName() { return "CUIBackdropHardwareTarget"; }
    @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new Target(context); }
    @Override public void addView(ReactViewGroup parent, View child, int index) { super.addView(parent, child, index + 1); }
    @Override public View getChildAt(ReactViewGroup parent, int index) { return super.getChildAt(parent, index + 1); }
    @Override public int getChildCount(ReactViewGroup parent) { return super.getChildCount(parent) - 1; }
    @Override public void removeViewAt(ReactViewGroup parent, int index) { super.removeViewAt(parent, index + 1); }
    @Override public void removeAllViews(ReactViewGroup parent) {
      for (int index = getChildCount(parent) - 1; index >= 0; index--) removeViewAt(parent, index);
    }
    @ReactProp(name = "captureMode") public void mode(ReactViewGroup view, int value) { ((Target)view).setMode(value); }
    @ReactProp(name = "providerVersion") public void version(ReactViewGroup view, int value) { ((Target)view).setVersion(value); }
    @ReactProp(name = "deliverVersion") public void deliver(ReactViewGroup view, int value) { ((Target)view).deliver(value); }
    @ReactProp(name = "inspectVersion") public void inspect(ReactViewGroup view, int value) { ((Target)view).emit(); }
    @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
      Map<String, Object> events = new java.util.HashMap<>();
      Map<String, Object> inherited = super.getExportedCustomDirectEventTypeConstants();
      if (inherited != null) events.putAll(inherited);
      events.put("topCaptureState", Collections.singletonMap("registrationName", "onCaptureState")); return events;
    }
  }

  private static final class CaptureEvent extends Event<CaptureEvent> {
    final WritableMap data;
    CaptureEvent(int surface, int target, WritableMap data) { super(surface, target); this.data = data; }
    @Override public String getEventName() { return "topCaptureState"; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return data; }
  }

  private static final class CaptureCanvas extends Canvas {
    CaptureCanvas(Bitmap image) { super(image); }
  }
  private static final class EngineSurface extends SurfaceView {
    Bitmap submitted;
    EngineSurface(Context context) {
      super(context); setZOrderOnTop(false); setZOrderMediaOverlay(false);
      setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS); setFocusable(false); setClickable(false);
    }
    @Override public void draw(Canvas canvas) {
      if (canvas instanceof CaptureCanvas) {
        if (submitted == null) throw new IllegalStateException("Fixture hardware frame is not ready");
        canvas.drawBitmap(submitted, 0, 0, null);
      } else super.draw(canvas);
    }
  }
  private static final class Task implements CUIBackdropCaptureSource.Cancellation {
    final AtomicBoolean cancelled = new AtomicBoolean();
    final AtomicBoolean delivered = new AtomicBoolean();
    final CUIBackdropCaptureSource.Completion completion;
    CUIBackdropCaptureSource.Frame frame;
    Exception failure;
    Runnable onCancel;
    boolean ready, requested;
    Task(CUIBackdropCaptureSource.Completion completion) { this.completion = completion; }
    @Override public void cancel() { if (cancelled.compareAndSet(false, true) && onCancel != null) onCancel.run(); }
    void deliver() {
      requested = true;
      if (ready && delivered.compareAndSet(false, true)) completion.complete(frame, failure);
    }
  }
  private static final class Source implements CUIBackdropCaptureSource {
    final WeakReference<Target> owner;
    Source(Target target) { owner = new WeakReference<>(target); }
    @Override public Cancellation capture(Request request, Completion completion) {
      Target target = owner.get();
      if (target == null) {
        Task task = new Task(completion); task.failure = new IllegalStateException("Fixture target retired"); task.ready = true; task.deliver(); return task;
      }
      return target.capture(request, completion);
    }
  }

  private static final class Target extends ReactViewGroup implements SurfaceHolder.Callback {
    final Handler main = new Handler(Looper.getMainLooper());
    final EngineSurface surface;
    final ArrayList<Task> held = new ArrayList<>();
    HandlerThread thread;
    Handler worker;
    CUIBackdropCaptureRegistration registration;
    int mode, version, delivery, sequence, captures, cancellations, staleDeliveries;
    boolean attached;
    String failure = "";
    Target(ThemedReactContext context) {
      super(context); surface = new EngineSurface(context); surface.getHolder().addCallback(this);
      super.addView(surface, 0, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }
    @Override protected void onAttachedToWindow() {
      super.onAttachedToWindow(); attached = true;
      thread = new HandlerThread("CUIFixtureHardwareCapture"); thread.start(); worker = new Handler(thread.getLooper());
      register();
    }
    @Override protected void onDetachedFromWindow() {
      attached = false; sequence++;
      if (registration != null) registration.close(); registration = null;
      for (Task task : held) task.cancel(); held.clear(); surface.submitted = null;
      if (thread != null) thread.quitSafely(); worker = null; thread = null;
      super.onDetachedFromWindow();
    }
    @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
      super.onLayout(changed, left, top, right, bottom); surface.layout(0, 0, right - left, bottom - top);
    }
    void setMode(int value) {
      if (value < 0 || value > 3) throw new IllegalArgumentException("Fixture capture mode");
      if (mode != value) { mode = value; register(); }
    }
    void setVersion(int value) { if (version != value) { version = value; register(); } }
    void register() {
      if (registration != null) registration.close(); registration = null;
      if (attached && mode != 1) registration = CUIBackdropCaptureRegistry.register(this, new Source(this));
      emit();
    }
    void deliver(int value) {
      if (delivery == value) return; delivery = value;
      ArrayList<Task> pending = new ArrayList<>(held); held.clear();
      for (Task task : pending) { if (task.cancelled.get()) staleDeliveries++; task.deliver(); }
      emit();
    }
    void emit() {
      if (getId() == View.NO_ID || !attached) return;
      WritableMap state = Arguments.createMap();
      state.putInt("target", getId()); state.putInt("engineSequence", sequence);
      state.putBoolean("hardwareReady", surface.submitted != null);
      state.putBoolean("registered", registration != null && registration.isActive());
      state.putInt("captures", captures); state.putInt("cancellations", cancellations);
      state.putInt("held", held.size()); state.putInt("staleDeliveries", staleDeliveries);
      state.putString("failure", failure);
      EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag((ThemedReactContext)getContext(), getId());
      if (dispatcher != null) dispatcher.dispatchEvent(new CaptureEvent(UIManagerHelper.getSurfaceId(this), getId(), state));
    }
    @Override public void surfaceCreated(SurfaceHolder holder) {}
    @Override public void surfaceDestroyed(SurfaceHolder holder) { sequence++; surface.submitted = null; }
    @Override public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
      if (worker == null || width <= 0 || height <= 0) return;
      final int render = ++sequence; surface.submitted = null;
      worker.post(() -> {
        Bitmap image = null; Exception error = null;
        try {
          image = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
          Canvas pattern = new Canvas(image); Paint paint = new Paint();
          for (int y = 0; y < height; y += 16) for (int x = 0; x < width; x += 16) {
            paint.setColor(((x / 16 + y / 16) & 1) == 0 ? Color.rgb(232, 60, 96) : Color.rgb(24, 136, 220));
            pattern.drawRect(x, y, x + 16, y + 16, paint);
          }
          Canvas output = holder.getSurface().lockHardwareCanvas();
          try { output.drawBitmap(image, 0, 0, null); } finally { holder.getSurface().unlockCanvasAndPost(output); }
        } catch (Exception problem) { error = problem; }
        Bitmap submitted = image; Exception problem = error;
        main.post(() -> {
          if (!attached || sequence != render) return;
          if (problem == null) surface.submitted = submitted; else failure = problem.toString();
          emit();
        });
      });
    }
    Task capture(CUIBackdropCaptureSource.Request request, CUIBackdropCaptureSource.Completion completion) {
      Task task = new Task(completion);
      WeakReference<Target> weakTarget = new WeakReference<>(this);
      task.onCancel = () -> { Target target = weakTarget.get(); if (target != null) { target.cancellations++; target.emit(); } };
      try {
        if (!attached || request.getTarget() != this || request.targetWindow != getWindowToken() ||
            surface.submitted == null || surface.submitted.getWidth() != request.width || surface.submitted.getHeight() != request.height)
          throw new IllegalStateException("Fixture complete hardware frame is unavailable");
        if (request.receiverWindow == request.targetWindow)
          throw new IllegalStateException("Fixture requires an effect in its distinct native window");
        if (held.size() >= 2) throw new IllegalStateException("Fixture held-frame ownership exhausted");
        checkContent(this);
        Bitmap image = Bitmap.createBitmap(request.width, request.height, Bitmap.Config.ARGB_8888);
        super.draw(new CaptureCanvas(image));
        captures++;
        final boolean complete = mode != 2, hold = mode == 3;
        if (hold) held.add(task);
        Handler capturedWorker = worker;
        capturedWorker.post(() -> {
          try {
            int[] colors = new int[Math.multiplyExact(request.width, request.height)];
            // Android Bitmap.getPixels returns unpremultiplied sRGB ARGB; the library contract takes premultiplied RGBA.
            image.getPixels(colors, 0, request.width, 0, 0, request.width, request.height);
            byte[] rgba = new byte[Math.multiplyExact(colors.length, 4)];
            for (int index = 0; index < colors.length; index++) {
              int value = colors[index], alpha = Color.alpha(value), offset = index * 4;
              rgba[offset] = (byte)((Color.red(value) * alpha + 127) / 255);
              rgba[offset + 1] = (byte)((Color.green(value) * alpha + 127) / 255);
              rgba[offset + 2] = (byte)((Color.blue(value) * alpha + 127) / 255); rgba[offset + 3] = (byte)alpha;
            }
            task.frame = new CUIBackdropCaptureSource.Frame(request, request.width, request.height, rgba, complete, true, false);
          } catch (Exception error) { task.failure = error; }
          main.post(() -> {
            task.ready = true;
            if (task.requested || (!hold && !task.cancelled.get())) task.deliver();
            if (captures == 1 || hold) emit();
          });
        });
      } catch (Exception error) { task.failure = error; task.ready = true; task.deliver(); }
      return task;
    }
    void checkContent(View view) {
      if (view == surface) return;
      if (view instanceof SurfaceView || view instanceof TextureView)
        throw new IllegalStateException("Fixture contains an unowned external producer");
      if (view instanceof ViewGroup) {
        ViewGroup group = (ViewGroup)view;
        for (int index = 0; index < group.getChildCount(); index++) checkContent(group.getChildAt(index));
      }
    }
  }
}
