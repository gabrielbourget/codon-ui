package com.codonui.input;

import android.os.IBinder;
import android.view.View;
import java.lang.ref.WeakReference;
import java.util.concurrent.atomic.AtomicBoolean;

/** A native compositor supplies the complete original target, excluding the requesting effect.
 * Pixels are tightly packed, top-to-bottom, premultiplied RGBA8 in sRGB. No view/input mutation is permitted.
 * capture runs on the UI thread; completion may run on any thread, at most once. */
public interface CUIBackdropCaptureSource {
  interface Cancellation { void cancel(); }
  interface Completion { void complete(Frame frame, Exception failure); }
  Cancellation capture(Request request, Completion completion);

  final class Request {
    private final WeakReference<View> target, receiver;
    private final float[] targetQuad, receiverQuad;
    private final AtomicBoolean cancelled = new AtomicBoolean();
    public final IBinder targetWindow, receiverWindow;
    public final String targetEpoch, receiverEpoch, ownerId, frameId;
    public final double generation;
    public final int width, height, receiverWidth, receiverHeight, targetTag, receiverTag;

    Request(View target, View receiver, String targetEpoch, String receiverEpoch, String ownerId,
        String frameId, double generation, float[] targetQuad, float[] receiverQuad) {
      this.target = new WeakReference<>(target); this.receiver = new WeakReference<>(receiver);
      targetWindow = target.getWindowToken(); receiverWindow = receiver.getWindowToken();
      this.targetEpoch = targetEpoch; this.receiverEpoch = receiverEpoch;
      this.ownerId = ownerId; this.frameId = frameId; this.generation = generation;
      width = target.getWidth(); height = target.getHeight();
      receiverWidth = receiver.getWidth(); receiverHeight = receiver.getHeight();
      targetTag = target.getId(); receiverTag = receiver.getId();
      this.targetQuad = targetQuad.clone(); this.receiverQuad = receiverQuad.clone();
    }
    public View getTarget() { return target.get(); }
    public View getReceiver() { return receiver.get(); }
    public float[] getTargetScreenQuad() { return targetQuad.clone(); }
    public float[] getReceiverScreenQuad() { return receiverQuad.clone(); }
    public boolean isCancelled() { return cancelled.get(); }
    void cancel() { cancelled.set(true); }
  }

  final class Frame {
    public final Request request;
    public final int width, height;
    public final boolean complete, excludesEffect, protectedContent;
    private final byte[] rgba;

    /** Echo the exact request whose compositor state was captured. The byte array is copied. */
    public Frame(Request request, int width, int height, byte[] rgba, boolean complete,
        boolean excludesEffect, boolean protectedContent) {
      if (request == null || width <= 0 || height <= 0 || rgba == null ||
          rgba.length != Math.multiplyExact(Math.multiplyExact(width, height), 4))
        throw new IllegalArgumentException("Native backdrop: invalid capture raster");
      this.request = request; this.width = width; this.height = height; this.rgba = rgba.clone();
      this.complete = complete; this.excludesEffect = excludesEffect; this.protectedContent = protectedContent;
    }
    public byte[] copyRGBA() { return rgba.clone(); }
    byte[] validatedRGBA(Request expected) {
      if (request != expected || expected.isCancelled())
        throw new IllegalStateException("Native backdrop: capture source returned a different or cancelled request");
      if (!complete || !excludesEffect || protectedContent)
        throw new IllegalStateException("Native backdrop: capture source frame is incomplete, protected or contains its effect");
      if (width != expected.width || height != expected.height)
        throw new IllegalStateException("Native backdrop: capture source raster does not match target bounds");
      byte[] result = copyRGBA();
      for (int index = 0; index < result.length; index += 4) {
        if (expected.isCancelled()) throw new IllegalStateException("Native backdrop: capture source request retired");
        int alpha = result[index + 3] & 255;
        if ((result[index] & 255) > alpha || (result[index + 1] & 255) > alpha || (result[index + 2] & 255) > alpha)
          throw new IllegalStateException("Native backdrop: capture source pixels are not premultiplied sRGB RGBA");
      }
      return result;
    }
  }
}
