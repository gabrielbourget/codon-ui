package com.codonui.input;

import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Typeface;
import android.text.Layout;
import android.text.NoCopySpan;
import android.text.Spannable;
import android.text.SpannableString;
import android.text.SpannableStringBuilder;
import android.text.SpanWatcher;
import android.text.TextPaint;
import android.text.TextWatcher;
import android.text.style.MetricAffectingSpan;
import android.text.style.ParagraphStyle;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.ReactConstants;
import com.facebook.react.common.mapbuffer.MapBuffer;
import com.facebook.react.common.mapbuffer.ReadableMapBuffer;
import com.facebook.react.fabric.mounting.LayoutMetricsConversions;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.progressbar.ReactProgressBarViewManager;
import com.facebook.react.views.text.TextLayoutManager;
import com.facebook.react.views.text.internal.span.*;
import com.facebook.yoga.YogaMeasureMode;
import com.facebook.yoga.YogaMeasureOutput;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.ViewManager;
import com.facebook.react.uimanager.ViewManagerRegistry;
import com.facebook.react.views.text.ReactTextViewManager;
import com.facebook.react.views.text.ReactTextViewManagerCallback;
import com.facebook.react.views.text.ReactTypefaceUtils;
import com.facebook.react.views.text.ReactFontWeightScalar;
import com.facebook.react.views.text.TextAttributeProps;
import java.util.Map;

// Private RN0.86.3 adapter. Native layout/fidelity and cache concurrency need installed proof.
final class CUIMotionIntrinsics {
  private final ThemedReactContext context;
  private final FabricUIManager manager;
  private final ReactProgressBarViewManager progress = new ReactProgressBarViewManager();
  private static final Class<?>[] auditedSpans = {
    ReactAbsoluteSizeSpan.class, CustomLetterSpacingSpan.class, CustomLineHeightSpan.class,
    CustomStyleSpan.class, TextInlineViewPlaceholderSpan.class, ReactBackgroundColorSpan.class,
    ReactForegroundColorSpan.class, ReactUnderlineSpan.class, ReactStrikethroughSpan.class,
    ReactOpacitySpan.class, ShadowStyleSpan.class, ReactTagSpan.class, ReactFragmentIndexSpan.class,
    ReactLinkSpan.class, ReactClickableSpan.class
  };

  private CUIMotionIntrinsics(ThemedReactContext context, FabricUIManager manager) {
    this.context = context; this.manager = manager;
  }

  static CUIMotionIntrinsics create(Context context, FabricUIManager manager) {
    UiThreadUtil.assertOnUiThread();
    if (!(context instanceof ThemedReactContext))
      throw new IllegalArgumentException("Native motion: actual themed view context required");
    if (manager == null) throw new IllegalArgumentException("Native motion: original Fabric manager required");
    return new CUIMotionIntrinsics((ThemedReactContext)context, manager);
  }

  private static void bounds(float minimum, float maximum) {
    if (!Float.isFinite(minimum) || minimum < 0 || Float.isNaN(maximum) || maximum < minimum)
      throw new IllegalArgumentException("Native motion: invalid intrinsic constraints");
  }

  private static Object measurementSpan(Object span) {
    // Monitoring/composition markers must never observe changes to the measurement copy.
    if (!(span instanceof MetricAffectingSpan) && !(span instanceof ParagraphStyle) &&
        (span instanceof SpanWatcher || span instanceof TextWatcher || span instanceof NoCopySpan)) return null;
    boolean audited = false;
    for (Class<?> type : auditedSpans) if (span.getClass() == type) { audited = true; break; }
    if (!audited) throw new IllegalStateException("Native motion: unaudited cached span " + span.getClass().getName());
    return span;
  }

  private static void requireContainer(Spannable original) {
    UiThreadUtil.assertOnUiThread();
    if (original == null || (original.getClass() != SpannableStringBuilder.class && original.getClass() != SpannableString.class))
      throw new IllegalStateException("Native motion: unaudited cached text container");
  }

  static SpannableString copyCachedText(Spannable original) {
    requireContainer(original);
    return copyText(original, CUIMotionFontSnapshot.capture(
      original.getSpans(0, original.length(), CustomStyleSpan.class)), null);
  }

  private static SpannableString copyText(Spannable original,
      Map<CustomStyleSpan, MetricAffectingSpan> fonts, CUIIntrinsicSource.Session session) {
    requireContainer(original);
    // Start from characters only: copying a Spanned constructor can retain original watchers.
    SpannableString copied = new SpannableString(original.toString());
    for (Object span : original.getSpans(0, original.length(), Object.class)) {
      Object owned;
      if (span.getClass() == ReactTextPaintHolderSpan.class) {
        TextPaint source = ((ReactTextPaintHolderSpan)span).getTextPaint();
        TextPaint paint = new TextPaint();
        paint.set(source);
        paint.drawableState = source.drawableState == null ? null : source.drawableState.clone();
        owned = new ReactTextPaintHolderSpan(paint);
      } else {
        try { owned = measurementSpan(span); }
        catch (IllegalStateException unsupported) {
          if (session == null) throw unsupported;
          requireCurrent(session);
          owned = session.copySpan(span);
          requireCurrent(session);
          if (owned == null || owned == span || owned instanceof SpanWatcher ||
              owned instanceof TextWatcher || owned instanceof NoCopySpan)
            throw new IllegalStateException("Native motion: isolated measurement span required", unsupported);
        }
        if (span instanceof CustomStyleSpan && fonts.containsKey(span)) owned = fonts.get(span);
      }
      if (owned != null) copied.setSpan(owned, original.getSpanStart(span), original.getSpanEnd(span), original.getSpanFlags(span));
    }
    return copied;
  }

  private static final class PinnedLayout {
    static final Method create;
    static final Method layout;
    static {
      try {
        create = TextLayoutManager.class.getDeclaredMethod("createLayout", Spannable.class,
          TextPaint.class, MapBuffer.class, MapBuffer.class, float.class, YogaMeasureMode.class,
          float.class, YogaMeasureMode.class);
        Class<?> result = Class.forName("com.facebook.react.views.text.TextLayoutManager$CreateLayoutResult");
        if (create.getReturnType() != result) throw new NoSuchMethodException("createLayout result type");
        layout = result.getDeclaredMethod("getLayout");
        if (layout.getReturnType() != Layout.class) throw new NoSuchMethodException("getLayout result type");
        create.setAccessible(true); layout.setAccessible(true);
      } catch (ReflectiveOperationException failure) {
        throw new IllegalStateException("Native motion: pinned native layout helper unavailable", failure);
      }
    }
  }

  private static Object invoke(Method method, Object receiver, Object... arguments) {
    try { return method.invoke(receiver, arguments); }
    catch (InvocationTargetException failure) {
      Throwable cause = failure.getCause();
      if (cause instanceof RuntimeException) throw (RuntimeException)cause;
      if (cause instanceof Error) throw (Error)cause;
      throw new IllegalStateException("Native motion: native layout helper failed", cause);
    } catch (ReflectiveOperationException failure) {
      throw new IllegalStateException("Native motion: pinned native layout helper inaccessible", failure);
    }
  }

  private static final class PinnedRegistry {
    static final Field registry;
    static {
      try {
        registry = FabricUIManager.class.getDeclaredField("mViewManagerRegistry");
        int modifiers = registry.getModifiers();
        if (registry.getDeclaringClass() != FabricUIManager.class || registry.getType() != ViewManagerRegistry.class ||
            !Modifier.isPrivate(modifiers) || !Modifier.isFinal(modifiers) || Modifier.isStatic(modifiers))
          throw new NoSuchFieldException("FabricUIManager.mViewManagerRegistry descriptor");
        registry.setAccessible(true);
      } catch (ReflectiveOperationException failure) {
        throw new IllegalStateException("Native motion: original text registry unavailable", failure);
      }
    }
  }

  private ReactTextViewManagerCallback originalCallback() {
    try {
      ViewManager<?, ?> original = ((ViewManagerRegistry)PinnedRegistry.registry.get(manager))
        .get(ReactTextViewManager.REACT_CLASS);
      return original instanceof ReactTextViewManagerCallback ? (ReactTextViewManagerCallback)original : null;
    } catch (IllegalAccessException failure) {
      throw new IllegalStateException("Native motion: original text registry inaccessible", failure);
    }
  }

  private static void requireCurrent(CUIIntrinsicSource.Session session) {
    if (session != null && !session.isCurrent())
      throw new IllegalStateException("Native motion: isolated text source retired");
  }

  private static TextPaint basePaint(TextAttributeProps attributes, AssetManager assets,
      CUIMotionFontSnapshot.Snapshot fonts, boolean prepared) {
    // Match scratchPaintWithAttributes initial values; never borrow its ThreadLocal paint.
    TextPaint paint = new TextPaint(TextPaint.ANTI_ALIAS_FLAG);
    if (!prepared) {
      paint.setTypeface(null); paint.setTextSize(12); paint.setFakeBoldText(false); paint.setTextSkewX(0);
    }
    if (attributes.getFontSize() != ReactConstants.UNSET) paint.setTextSize(attributes.getFontSize());
    int style = attributes.getFontStyle(), weight = attributes.getFontWeight();
    String family = attributes.getFontFamily();
    if (style != ReactConstants.UNSET || weight != ReactConstants.UNSET || family != null) {
      Typeface face = family == null ? ReactTypefaceUtils.applyStyles(null, style, weight, null, assets)
        : fonts.manager.getTypeface(family, style, weight, assets);
      paint.setTypeface(face);
      if (style != ReactConstants.UNSET && style != face.getStyle()) {
        int missing = style & ~face.getStyle();
        paint.setFakeBoldText((missing & Typeface.BOLD) != 0);
        paint.setTextSkewX((missing & Typeface.ITALIC) != 0 ? -0.25f : 0);
      }
    }
    ReactFontWeightScalar.apply(paint, attributes.getFontWeightScalar());
    return paint;
  }

  private float[] textResult(ReadableMapBuffer attributed, ReadableMapBuffer paragraph, int tag, int surface,
      float minWidth, float maxWidth, float minHeight, float maxHeight, boolean prepared) {
    UiThreadUtil.assertOnUiThread(); bounds(minWidth, maxWidth); bounds(minHeight, maxHeight);
    boolean cached = attributed.contains(TextLayoutManager.AS_KEY_CACHE_ID);
    AssetManager assets = context.getReactApplicationContext().getAssets();
    ReactTextViewManagerCallback callback = originalCallback();
    CUIIntrinsicSource.Session session = null;
    if (callback != null) {
      if (!(callback instanceof CUIIntrinsicSource))
        throw new IllegalStateException("Native motion: original text callback requires CUIIntrinsicSource");
      session = ((CUIIntrinsicSource)callback).captureIntrinsic(new CUIIntrinsicSource.Request(tag, surface,
        attributed, paragraph, assets, context.getResources().getDisplayMetrics().density,
        context.getResources().getConfiguration().fontScale, cached));
      if (session == null) throw new IllegalStateException("Native motion: isolated text session required");
    }
    try {
      requireCurrent(session);
      final CUIIntrinsicSource.Session captured = session;
      // Cached text has already been postprocessed. Never replay its original callback.
      ReactTextViewManagerCallback isolated = cached || captured == null ? null : text -> {
        requireCurrent(captured); captured.postProcess(text); requireCurrent(captured);
      };
      Spannable original = TextLayoutManager.INSTANCE.getOrCreateSpannableForText(assets, attributed, isolated);
      requireContainer(original);
      TextAttributeProps base = cached ? null : TextAttributeProps.fromMapBuffer(
        attributed.getMapBuffer(TextLayoutManager.AS_KEY_BASE_ATTRIBUTES));
      CUIMotionFontSnapshot.Snapshot fonts = CUIMotionFontSnapshot.capture(
        original.getSpans(0, original.length(), CustomStyleSpan.class), base == null ? null : base.getFontFamily());
      SpannableString copied = copyText(original, fonts.replacements, session);
      TextPaint paint;
      if (cached) {
        ReactTextPaintHolderSpan[] holders = copied.getSpans(0, 0, ReactTextPaintHolderSpan.class);
        if (holders.length != 1) throw new IllegalStateException("Native motion: exact cached editor paint required");
        paint = holders[0].getTextPaint();
      } else paint = basePaint(base, assets, fonts, prepared);
      float width = LayoutMetricsConversions.getYogaSize(minWidth, maxWidth);
      float height = LayoutMetricsConversions.getYogaSize(minHeight, maxHeight);
      YogaMeasureMode widthMode = LayoutMetricsConversions.getYogaMeasureMode(minWidth, maxWidth);
      YogaMeasureMode heightMode = LayoutMetricsConversions.getYogaMeasureMode(minHeight, maxHeight);
      Object result = invoke(PinnedLayout.create, TextLayoutManager.INSTANCE, copied, paint,
        attributed, paragraph, width, widthMode, height, heightMode);
      Layout layout = (Layout)invoke(PinnedLayout.layout, result);
      int maximumLines = paragraph.contains(TextLayoutManager.PA_KEY_MAX_NUMBER_OF_LINES)
        ? paragraph.getInt(TextLayoutManager.PA_KEY_MAX_NUMBER_OF_LINES) : ReactConstants.UNSET;
      // RN0.86.3 calculateLineCount/calculateWidth/calculateHeight, shared by fresh and cached text.
      int lines = maximumLines == ReactConstants.UNSET || maximumLines == 0
        ? layout.getLineCount() : Math.min(maximumLines, layout.getLineCount());
      float measuredWidth = widthMode == YogaMeasureMode.EXACTLY ? width : layout.getWidth();
      float measuredHeight = heightMode == YogaMeasureMode.EXACTLY ? height : layout.getLineBottom(lines - 1);
      if (heightMode == YogaMeasureMode.AT_MOST && measuredHeight > height) measuredHeight = height;
      requireCurrent(session);
      // Fabric LineMeasurement::baseline selects the first line ASCENDER, not getLineBaseline.
      return new float[]{PixelUtil.toDIPFromPixel(measuredWidth), PixelUtil.toDIPFromPixel(measuredHeight),
        layout.getLineCount() == 0 ? 0 : PixelUtil.toDIPFromPixel(-layout.getLineAscent(0))};
    } finally { if (session != null) session.close(); }
  }

  long textMeasure(ReadableMapBuffer attributed, ReadableMapBuffer paragraph, int tag, int surface,
      float minWidth, float maxWidth, float minHeight, float maxHeight, boolean prepared) {
    float[] result = textResult(attributed, paragraph, tag, surface, minWidth, maxWidth, minHeight, maxHeight, prepared);
    return YogaMeasureOutput.make(result[0], result[1]);
  }

  float textBaseline(ReadableMapBuffer attributed, ReadableMapBuffer paragraph, int tag, int surface,
      float width, float height) {
    return textResult(attributed, paragraph, tag, surface, width, width, height, height, false)[2];
  }

  long progress(ReadableMap props, float minWidth, float maxWidth, float minHeight, float maxHeight) {
    UiThreadUtil.assertOnUiThread(); bounds(minWidth, maxWidth); bounds(minHeight, maxHeight);
    return progress.measure(context, null, props, null,
      LayoutMetricsConversions.getYogaSize(minWidth, maxWidth), LayoutMetricsConversions.getYogaMeasureMode(minWidth, maxWidth),
      LayoutMetricsConversions.getYogaSize(minHeight, maxHeight), LayoutMetricsConversions.getYogaMeasureMode(minHeight, maxHeight), null);
  }
}
