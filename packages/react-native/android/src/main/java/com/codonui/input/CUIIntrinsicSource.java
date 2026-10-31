package com.codonui.input;

import android.content.res.AssetManager;
import android.text.Spannable;
import com.facebook.react.common.mapbuffer.MapBuffer;

/** Native text-callback cooperation for isolated Card layout. UI-thread, synchronous only.
 * Custom Fabric widgets/attachments use the matching C++ CUIIntrinsicSource family contract.
 * Implement on the original ReactTextViewManagerCallback; normal rendering keeps that callback.
 */
public interface CUIIntrinsicSource {
  /** Capture immutable selected inputs and owned resources. Never call the original callback
   * from the returned session or change a mounted editor, its spans, caches or paint. */
  Session captureIntrinsic(Request request);

  interface Session extends AutoCloseable {
    boolean isCurrent();
    /** Called at the original fresh-builder callback position, before font/span isolation. */
    void postProcess(Spannable ownedText);
    /** Return a request-owned measurement span for an otherwise unaudited original span.
     * Preserve all metric/paragraph behavior; never return the original mutable span. */
    Object copySpan(Object original);
    /** Exactly once, including exceptions; release only this session's resources. Must not throw. */
    @Override void close();
  }

  final class Request {
    public final int tag, surfaceId;
    public final MapBuffer attributedString, paragraphAttributes;
    public final AssetManager assets;
    public final float density, fontScale;
    public final boolean cached;
    Request(int tag, int surfaceId, MapBuffer attributed, MapBuffer paragraph,
        AssetManager assets, float density, float fontScale, boolean cached) {
      this.tag = tag; this.surfaceId = surfaceId; attributedString = attributed;
      paragraphAttributes = paragraph; this.assets = assets;
      this.density = density; this.fontScale = fontScale; this.cached = cached;
    }
  }
}
