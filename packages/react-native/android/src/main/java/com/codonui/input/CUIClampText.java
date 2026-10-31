package com.codonui.input;

import android.content.res.AssetManager;
import android.text.Layout;
import android.text.Spannable;
import android.text.SpannableString;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.NativeArray;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.ReactConstants;
import com.facebook.react.common.mapbuffer.ReadableMapBuffer;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.fabric.mounting.LayoutMetricsConversions;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.views.text.TextLayoutManager;
import com.facebook.yoga.YogaMeasureMode;
import com.facebook.yoga.YogaMeasureOutput;
import java.lang.ref.WeakReference;
import java.util.ArrayList;

@DoNotStrip
final class CUIClampText {
  static {
    System.loadLibrary("react_codegen_CodonNativeOverlay");
    nativeInstallKernel(CUIMotionSnapshotModule.clampKernel());
  }
  private static native void nativeInstallKernel(long kernel);
  private static final ArrayList<WeakReference<ReactApplicationContext>> contexts = new ArrayList<>();
  private static native void nativePublished(int tag, long owner, Object immutableText, String failure);
  static synchronized void registerContext(ReactApplicationContext context) {
    contexts.removeIf(reference -> reference.get() == null);
    for (WeakReference<ReactApplicationContext> reference : contexts) if (reference.get() == context) return;
    contexts.add(new WeakReference<>(context));
  }
  private static synchronized AssetManager assets(FabricUIManager manager, int tag) {
    for (WeakReference<ReactApplicationContext> reference : contexts) {
      ReactApplicationContext context = reference.get();
      if (context != null && context.hasActiveReactInstance() &&
          UIManagerHelper.getUIManagerForReactTag(context,tag) == manager) return context.getAssets();
    }
    throw new IllegalStateException("Table clamp: original Fabric runtime retired");
  }
  private static void stock(FabricUIManager manager) {
    if (CUIMotionIntrinsics.originalCallback(manager) != null)
      throw new IllegalStateException("Table clamp: original custom text callback requires CUIClampContentSource");
  }
  private static final class Editor {
    final SpannableString text;
    Editor(Spannable original) { text = CUIMotionIntrinsics.copyCachedText(original); }
  }
  @DoNotStrip static void observe(int tag, long owner) {
    TextLayoutManager.INSTANCE.setCuiTextSnapshotObserver(tag,owner,new TextLayoutManager.CuiTextSnapshotObserver() {
      @Override public void published(Spannable original) {
        UiThreadUtil.assertOnUiThread();
        nativePublished(tag,owner,new Editor(original),null);
      }
      @Override public void failed(RuntimeException failure) { nativePublished(tag,owner,null,failure.toString()); }
      @Override public void cleared() { nativePublished(tag,owner,null,"Table clamp: original native editor cache retired"); }
    });
  }
  @DoNotStrip static void unobserve(int tag, long owner) { TextLayoutManager.INSTANCE.removeCuiTextSnapshotObserver(tag,owner); }
  @DoNotStrip static long cached(Object snapshot, ReadableMapBuffer cached, ReadableMapBuffer paragraph,
      float minWidth, float maxWidth, float minHeight, float maxHeight) {
    if (!(snapshot instanceof Editor)) throw new IllegalStateException("Table clamp: immutable native editor payload required");
    Layout layout = CUIMotionIntrinsics.layoutOwnedCached(((Editor)snapshot).text,cached,paragraph,minWidth,maxWidth,minHeight,maxHeight);
    YogaMeasureMode widthMode = LayoutMetricsConversions.getYogaMeasureMode(minWidth,maxWidth);
    YogaMeasureMode heightMode = LayoutMetricsConversions.getYogaMeasureMode(minHeight,maxHeight);
    float width = LayoutMetricsConversions.getYogaSize(minWidth,maxWidth);
    float height = LayoutMetricsConversions.getYogaSize(minHeight,maxHeight);
    int maximum = paragraph.contains(TextLayoutManager.PA_KEY_MAX_NUMBER_OF_LINES)
      ? paragraph.getInt(TextLayoutManager.PA_KEY_MAX_NUMBER_OF_LINES) : ReactConstants.UNSET;
    int lines = maximum == ReactConstants.UNSET || maximum == 0 ? layout.getLineCount() : Math.min(maximum,layout.getLineCount());
    float measuredWidth = widthMode == YogaMeasureMode.EXACTLY ? width : layout.getWidth();
    float measuredHeight = heightMode == YogaMeasureMode.EXACTLY ? height : layout.getLineBottom(lines-1);
    if (heightMode == YogaMeasureMode.AT_MOST) measuredHeight = Math.min(height,measuredHeight);
    return YogaMeasureOutput.make(PixelUtil.toDIPFromPixel(measuredWidth),PixelUtil.toDIPFromPixel(measuredHeight));
  }
  @DoNotStrip static long fresh(FabricUIManager manager, int tag, ReadableMapBuffer text,
      ReadableMapBuffer paragraph, float minWidth, float maxWidth, float minHeight, float maxHeight, boolean prepared) {
    stock(manager);
    AssetManager assets = assets(manager,tag);
    float width = LayoutMetricsConversions.getYogaSize(minWidth,maxWidth), height = LayoutMetricsConversions.getYogaSize(minHeight,maxHeight);
    YogaMeasureMode wm = LayoutMetricsConversions.getYogaMeasureMode(minWidth,maxWidth), hm = LayoutMetricsConversions.getYogaMeasureMode(minHeight,maxHeight);
    if (prepared) {
      float[] result = TextLayoutManager.measurePreparedLayout(
        TextLayoutManager.createPreparedLayout(assets,text,paragraph,width,wm,height,hm,null),width,wm,height,hm);
      return YogaMeasureOutput.make(result[0],result[1]);
    }
    return TextLayoutManager.measureText(assets,text,paragraph,width,wm,height,hm,null,null);
  }
  @DoNotStrip static NativeArray lines(FabricUIManager manager, int tag, ReadableMapBuffer text,
      ReadableMapBuffer paragraph, float width, float height) {
    stock(manager);
    return (NativeArray)TextLayoutManager.measureLines(assets(manager,tag),text,paragraph,width,height,null);
  }
}
