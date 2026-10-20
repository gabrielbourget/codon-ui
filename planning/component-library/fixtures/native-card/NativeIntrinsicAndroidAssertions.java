package com.codonui.input;

import android.content.Context;
import android.text.Editable;
import android.text.Layout;
import android.text.NoCopySpan;
import android.text.Spannable;
import android.text.SpannableString;
import android.text.SpannableStringBuilder;
import android.text.SpanWatcher;
import android.text.TextPaint;
import android.text.TextWatcher;
import android.text.style.MetricAffectingSpan;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.views.text.TextLayoutManager;
import com.facebook.react.views.text.internal.span.CustomStyleSpan;
import com.facebook.react.views.text.internal.span.ReactAbsoluteSizeSpan;
import com.facebook.react.views.text.internal.span.ReactTextPaintHolderSpan;
import com.facebook.yoga.YogaMeasureMode;

// Compile now; execute only in a matching installed native harness. Not shipping source.
public final class NativeIntrinsicAndroidAssertions {
  private static void require(boolean value, String message) {
    if (!value) throw new AssertionError(message);
  }
  private static final class Watcher implements SpanWatcher, TextWatcher, NoCopySpan {
    int calls;
    public void onSpanAdded(Spannable text, Object span, int start, int end) { calls++; }
    public void onSpanRemoved(Spannable text, Object span, int start, int end) { calls++; }
    public void onSpanChanged(Spannable text, Object span, int a, int b, int c, int d) { calls++; }
    public void beforeTextChanged(CharSequence text, int start, int count, int after) { calls++; }
    public void onTextChanged(CharSequence text, int start, int before, int count) { calls++; }
    public void afterTextChanged(Editable text) { calls++; }
  }
  private static final class UnknownMetric extends MetricAffectingSpan {
    int calls;
    public void updateMeasureState(TextPaint paint) { calls++; }
    public void updateDrawState(TextPaint paint) { calls++; }
  }

  public static void run(Context context) {
    UiThreadUtil.assertOnUiThread();
    SpannableStringBuilder original = new SpannableStringBuilder("A long held native editor value");
    TextPaint paint = new TextPaint(); paint.setTextSize(80); paint.density = 2;
    paint.baselineShift = 7; paint.drawableState = new int[]{1,2};
    ReactAbsoluteSizeSpan size = new ReactAbsoluteSizeSpan(80);
    ReactTextPaintHolderSpan holder = new ReactTextPaintHolderSpan(paint);
    original.setSpan(size, 0, original.length(), Spannable.SPAN_INCLUSIVE_INCLUSIVE);
    original.setSpan(holder, 0, original.length(), Spannable.SPAN_INCLUSIVE_INCLUSIVE);
    Watcher watcher = new Watcher();
    original.setSpan(watcher, 0, original.length(), Spannable.SPAN_INCLUSIVE_INCLUSIVE);
    int originalCalls = watcher.calls;
    SpannableString copied = CUIMotionIntrinsics.copyCachedText(original);
    TextPaint copiedPaint = copied.getSpans(0,0,ReactTextPaintHolderSpan.class)[0].getTextPaint();
    require(copied.toString().equals(original.toString()), "copied characters");
    require(copied.getSpans(0,copied.length(),Watcher.class).length == 0, "no copied watcher");
    require(copiedPaint != paint && copiedPaint.drawableState != paint.drawableState, "owned paint and state array");
    require(copiedPaint.density == paint.density && copiedPaint.baselineShift == 7, "extended paint fields retained");
    TextLayoutManager.adjustSpannableFontToFit(copied, 30, YogaMeasureMode.EXACTLY, 10,
      YogaMeasureMode.AT_MOST, 4, 1, true, 1, 0, Layout.Alignment.ALIGN_NORMAL, 0, copiedPaint);
    require(paint.getTextSize() == 80 && size.getSize() == 80, "original size and paint survive native font fitting");
    require(original.getSpanStart(size) == 0 && original.getSpanEnd(size) == original.length(), "original span survives fitting");
    require(original.getSpans(0,0,ReactTextPaintHolderSpan.class)[0] == holder, "original holder unchanged");
    require(watcher.calls == originalCalls, "no original watcher notification");
    require(original.toString().equals("A long held native editor value"), "original characters unchanged");
    UnknownMetric metric = new UnknownMetric(); original.setSpan(metric,0,1,Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
    try { CUIMotionIntrinsics.copyCachedText(original); throw new AssertionError("unknown metric accepted"); }
    catch (IllegalStateException expected) { require(expected.getMessage().contains("unaudited cached span"), "exact unsupported metric"); }
    require(metric.calls == 0, "unproved metric callback never invoked");
    original.removeSpan(metric);
    CustomStyleSpan family = new CustomStyleSpan(0,400,null,"custom-family",context.getAssets());
    original.setSpan(family,0,1,Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
    try { CUIMotionIntrinsics.copyCachedText(original); throw new AssertionError("shared font cache accepted"); }
    catch (IllegalStateException expected) { require(expected.getMessage().contains("shared font-family cache"), "exact unproved font cache"); }
  }
}
