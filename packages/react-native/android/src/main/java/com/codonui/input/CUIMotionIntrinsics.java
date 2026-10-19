package com.codonui.input;

import android.content.Context;
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

// Private RN0.86.3 adapter. Native layout/fidelity and cache concurrency need installed proof.
final class CUIMotionIntrinsics {
  private final Context context;
  private final ReactProgressBarViewManager progress = new ReactProgressBarViewManager();
  private static final Class<?>[] auditedSpans = {
    ReactAbsoluteSizeSpan.class, CustomLetterSpacingSpan.class, CustomLineHeightSpan.class,
    CustomStyleSpan.class, TextInlineViewPlaceholderSpan.class, ReactBackgroundColorSpan.class,
    ReactForegroundColorSpan.class, ReactUnderlineSpan.class, ReactStrikethroughSpan.class,
    ReactOpacitySpan.class, ShadowStyleSpan.class, ReactTagSpan.class, ReactFragmentIndexSpan.class,
    ReactLinkSpan.class, ReactClickableSpan.class
  };

  private CUIMotionIntrinsics(Context context) { this.context = context; }

  static CUIMotionIntrinsics create(Context context) {
    UiThreadUtil.assertOnUiThread();
    if (!(context instanceof ThemedReactContext))
      throw new IllegalArgumentException("Native motion: actual themed view context required");
    return new CUIMotionIntrinsics(context);
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
    if (span instanceof CustomStyleSpan && ((CustomStyleSpan)span).getFontFamily() != null)
      throw new IllegalStateException("Native motion: shared font-family cache isolation unavailable");
    return span;
  }

  static SpannableString copyCachedText(Spannable original) {
    if (original.getClass() != SpannableStringBuilder.class && original.getClass() != SpannableString.class)
      throw new IllegalStateException("Native motion: unaudited cached text container " + original.getClass().getName());
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
      } else owned = measurementSpan(span);
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

  long cachedEditor(ReadableMapBuffer attributed, ReadableMapBuffer paragraph,
      float minWidth, float maxWidth, float minHeight, float maxHeight) {
    UiThreadUtil.assertOnUiThread(); bounds(minWidth, maxWidth); bounds(minHeight, maxHeight);
    if (!attributed.contains(TextLayoutManager.AS_KEY_CACHE_ID))
      throw new IllegalArgumentException("Native motion: actual cached editor ID required");
    Spannable original = TextLayoutManager.INSTANCE.getOrCreateSpannableForText(context.getAssets(), attributed, null);
    SpannableString copied = copyCachedText(original);
    ReactTextPaintHolderSpan[] holders = copied.getSpans(0, 0, ReactTextPaintHolderSpan.class);
    if (holders.length != 1) throw new IllegalStateException("Native motion: exact cached editor paint required");
    float width = LayoutMetricsConversions.getYogaSize(minWidth, maxWidth);
    float height = LayoutMetricsConversions.getYogaSize(minHeight, maxHeight);
    YogaMeasureMode widthMode = LayoutMetricsConversions.getYogaMeasureMode(minWidth, maxWidth);
    YogaMeasureMode heightMode = LayoutMetricsConversions.getYogaMeasureMode(minHeight, maxHeight);
    Object result = invoke(PinnedLayout.create, TextLayoutManager.INSTANCE, copied, holders[0].getTextPaint(),
      attributed, paragraph, width, widthMode, height, heightMode);
    Layout layout = (Layout)invoke(PinnedLayout.layout, result);
    int maximumLines = paragraph.contains(TextLayoutManager.PA_KEY_MAX_NUMBER_OF_LINES)
      ? paragraph.getInt(TextLayoutManager.PA_KEY_MAX_NUMBER_OF_LINES) : ReactConstants.UNSET;
    int lines = maximumLines == ReactConstants.UNSET || maximumLines == 0
      ? layout.getLineCount() : Math.min(maximumLines, layout.getLineCount());
    float measuredWidth = widthMode == YogaMeasureMode.EXACTLY ? width : layout.getWidth();
    float measuredHeight = height;
    if (heightMode != YogaMeasureMode.EXACTLY) {
      measuredHeight = layout.getLineBottom(lines - 1);
      if (heightMode == YogaMeasureMode.AT_MOST && measuredHeight > height) measuredHeight = height;
    }
    return YogaMeasureOutput.make(PixelUtil.toDIPFromPixel(measuredWidth), PixelUtil.toDIPFromPixel(measuredHeight));
  }

  long progress(ReadableMap props, float minWidth, float maxWidth, float minHeight, float maxHeight) {
    UiThreadUtil.assertOnUiThread(); bounds(minWidth, maxWidth); bounds(minHeight, maxHeight);
    return progress.measure(context, null, props, null,
      LayoutMetricsConversions.getYogaSize(minWidth, maxWidth), LayoutMetricsConversions.getYogaMeasureMode(minWidth, maxWidth),
      LayoutMetricsConversions.getYogaSize(minHeight, maxHeight), LayoutMetricsConversions.getYogaMeasureMode(minHeight, maxHeight), null);
  }
}
