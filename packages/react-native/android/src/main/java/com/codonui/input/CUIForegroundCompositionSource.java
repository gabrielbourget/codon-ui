package com.codonui.input;

/** Explicit original producer cooperation, separate from the read-only backdrop capture API. */
public interface CUIForegroundCompositionSource {
  /** UI thread. Prepare the contained owner without changing original producer ink. */
  Session prepareForeground(Request request);
  interface Completion { void complete(Frame frame, Exception failure); }
  interface Session {
    /** UI thread; complete exactly once on any thread. Include original ink even during presentation. */
    void captureForeground(Request request, Completion completion);
    /** UI thread at the admitted frame: withdraw only independently presented producer ink.
     * Never hide, replace, reparent or mutate original controls, alpha, values, selection or defaults. */
    void presentForeground(Presentation presentation);
    /** UI thread, exactly once: cancel capture and restore this session's original producer ink. */
    void retireForeground();
  }
  final class Request {
    private final java.lang.ref.WeakReference<android.view.View> root, owner, source, output;
    private final float[] sourceQuad, outputQuad;
    private final java.util.concurrent.atomic.AtomicBoolean cancelled = new java.util.concurrent.atomic.AtomicBoolean();
    public final android.os.IBinder sourceWindow, outputWindow;
    public final String sourceEpoch, outputEpoch, ownerId, frameId;
    public final long generation;
    public final int left, top, width, height;
    public final float scale;
    Request(android.view.View root, android.view.View owner, android.view.View source, android.view.View output,
        String sourceEpoch, String outputEpoch, String ownerId, long generation, long frame, android.graphics.Rect bounds,
        float scale, float[] sourceQuad, float[] outputQuad) {
      this.root = new java.lang.ref.WeakReference<>(root); this.owner = new java.lang.ref.WeakReference<>(owner);
      this.source = new java.lang.ref.WeakReference<>(source); this.output = new java.lang.ref.WeakReference<>(output);
      sourceWindow = source.getWindowToken(); outputWindow = output.getWindowToken();
      this.sourceEpoch = sourceEpoch; this.outputEpoch = outputEpoch;
      this.ownerId = ownerId; frameId = ownerId + "-" + generation + "-" + frame;
      this.generation = generation; left = bounds.left; top = bounds.top; width = bounds.width(); height = bounds.height();
      this.scale = scale; this.sourceQuad = sourceQuad.clone(); this.outputQuad = outputQuad.clone();
    }
    public android.view.View getRegistrationRoot() { return root.get(); }
    public android.view.View getOwner() { return owner.get(); }
    public android.view.View getSource() { return source.get(); }
    public android.view.View getOutput() { return output.get(); }
    public float[] getSourceScreenQuad() { return sourceQuad.clone(); }
    public float[] getOutputScreenQuad() { return outputQuad.clone(); }
    public boolean isCancelled() { return cancelled.get(); }
    void cancel() { cancelled.set(true); }
  }
  final class Frame {
    public final Request request;
    public final int width, height;
    public final boolean complete, excludesOwnerEffectsAndOutput, protectedContent;
    private final byte[] rgba;
    /** Complete top-down premultiplied RGBA8/sRGB. Pixels are copied into immutable storage. */
    public Frame(Request request, int width, int height, byte[] rgba, boolean complete,
        boolean excludesOwnerEffectsAndOutput, boolean protectedContent) {
      if (request == null || width <= 0 || height <= 0 || rgba == null ||
          rgba.length != Math.multiplyExact(Math.multiplyExact(width, height), 4))
        throw new IllegalArgumentException("Native foreground: invalid capture raster");
      this.request = request; this.width = width; this.height = height; this.rgba = rgba.clone();
      this.complete = complete; this.excludesOwnerEffectsAndOutput = excludesOwnerEffectsAndOutput;
      this.protectedContent = protectedContent;
    }
    public byte[] copyRGBA() { return rgba.clone(); }
    byte[] validatedRGBA(Request expected) {
      if (request != expected || expected.isCancelled() || !complete || !excludesOwnerEffectsAndOutput || protectedContent ||
          width != expected.width || height != expected.height)
        throw new IllegalStateException("Foreground provider returned incomplete, retired or mismatched pixels");
      byte[] result = copyRGBA();
      for (int index=0; index<result.length; index+=4) {
        if (expected.isCancelled()) throw new IllegalStateException("Foreground capture retired");
        int alpha = result[index+3]&255;
        if ((result[index]&255)>alpha || (result[index+1]&255)>alpha || (result[index+2]&255)>alpha)
          throw new IllegalStateException("Foreground capture is not premultiplied RGBA/sRGB");
      }
      return result;
    }
  }
  final class Presentation {
    public final Frame sourceFrame;
    public final int left, top, width, height;
    Presentation(Frame frame, int left, int top, int width, int height) {
      sourceFrame = frame; this.left = left; this.top = top; this.width = width; this.height = height;
    }
  }
}
