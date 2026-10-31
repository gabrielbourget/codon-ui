package com.codonui.input;

import android.content.Context;
import android.content.res.AssetManager;
import android.graphics.Typeface;
import android.os.Build;
import android.text.Layout;
import android.text.Spannable;
import android.text.SpannableString;
import android.text.SpannableStringBuilder;
import android.text.StaticLayout;
import android.text.TextDirectionHeuristics;
import android.text.TextPaint;
import android.text.style.MetricAffectingSpan;
import android.util.SparseArray;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.assets.ReactFontManager;
import com.facebook.react.views.text.TextLayoutManager;
import com.facebook.react.views.text.internal.span.CustomStyleSpan;
import com.facebook.react.views.text.internal.span.ReactAbsoluteSizeSpan;
import com.facebook.react.views.text.internal.span.ReactTextPaintHolderSpan;
import com.facebook.yoga.YogaMeasureMode;
import java.lang.reflect.Field;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

// Non-shipping installed assertions. The original span is called only by the independent oracle.
public final class NativeFontSnapshotAndroidAssertions {
  public interface Recorder { void record(JSONObject value); }
  private static int assertions;
  private static final String TEXT = "office 123 אבג العربية\nA second line of held editor text";
  private static void require(boolean value, String message) {
    assertions++;
    if (!value) throw new AssertionError(message);
  }
  private static Object read(Class<?> owner, String name, Object receiver) throws Exception {
    Field field = owner.getDeclaredField(name); field.setAccessible(true); return field.get(receiver);
  }
  static final class Cache {
    final Object fonts;
    final Object custom;
    final Map<Object, Object> families = new LinkedHashMap<>();
    final Map<Object, Object> customs = new LinkedHashMap<>();
    final Map<Object, Object> arrays = new IdentityHashMap<>();
    final Map<Object, Map<Integer, Object>> faces = new IdentityHashMap<>();
    Cache() throws Exception {
      ReactFontManager manager = ReactFontManager.getInstance();
      fonts = read(ReactFontManager.class, "fontCache", manager);
      custom = read(ReactFontManager.class, "customTypefaceCache", manager);
      families.putAll((Map<?, ?>)fonts); customs.putAll((Map<?, ?>)custom);
      Class<?> family = Class.forName("com.facebook.react.common.assets.ReactFontManager$AssetFontFamily");
      for (Object value : families.values()) {
        SparseArray<?> styles = (SparseArray<?>)read(family, "typefaceSparseArray", value);
        arrays.put(value, styles);
        Map<Integer, Object> handles = new LinkedHashMap<>();
        for (int index = 0; index < styles.size(); index++) handles.put(styles.keyAt(index), styles.valueAt(index));
        faces.put(value, handles);
      }
    }
    void unchanged() throws Exception {
      Cache after = new Cache();
      require(fonts == after.fonts && custom == after.custom, "original map identities");
      require(families.keySet().equals(after.families.keySet()) && customs.keySet().equals(after.customs.keySet()), "original family/custom keys");
      for (Object key : families.keySet()) require(families.get(key) == after.families.get(key), "original family identities");
      for (Object key : customs.keySet()) require(customs.get(key) == after.customs.get(key), "original custom font handles");
      for (Object key : arrays.keySet()) {
        require(arrays.get(key) == after.arrays.get(key), "original style array identity");
        Map<Integer, Object> before = faces.get(key), current = after.faces.get(key);
        require(before.keySet().equals(current.keySet()), "original style keys");
        for (Integer style : before.keySet()) require(before.get(style) == current.get(style), "original style font handles");
      }
    }
  }
  private static TextPaint paint() {
    TextPaint paint = new TextPaint(); paint.setTextSize(31); paint.setTypeface(Typeface.MONOSPACE);
    paint.density = 2; paint.baselineShift = 3; paint.drawableState = new int[]{2, 3};
    return paint;
  }
  private static SpannableStringBuilder text(CustomStyleSpan span) {
    SpannableStringBuilder text = new SpannableStringBuilder(TEXT);
    text.setSpan(new ReactTextPaintHolderSpan(paint()), 0, text.length(), Spannable.SPAN_INCLUSIVE_INCLUSIVE);
    text.setSpan(new ReactAbsoluteSizeSpan(31), 0, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
    text.setSpan(span, 0, text.length(), Spannable.SPAN_EXCLUSIVE_EXCLUSIVE | (7 << Spannable.SPAN_PRIORITY_SHIFT));
    return text;
  }
  private static MetricAffectingSpan owned(SpannableString copied) {
    for (MetricAffectingSpan span : copied.getSpans(0, copied.length(), MetricAffectingSpan.class))
      if (!(span instanceof ReactAbsoluteSizeSpan)) return span;
    throw new AssertionError("missing owned font span");
  }
  private static StaticLayout layout(CharSequence text, TextPaint paint) {
    return StaticLayout.Builder.obtain(text, 0, text.length(), paint, 173)
      .setAlignment(Layout.Alignment.ALIGN_NORMAL).setTextDirection(TextDirectionHeuristics.FIRSTSTRONG_RTL)
      .setIncludePad(true).build();
  }
  private static JSONArray lines(Layout layout) throws Exception {
    JSONArray lines = new JSONArray();
    for (int index = 0; index < layout.getLineCount(); index++) lines.put(new JSONArray()
      .put(layout.getLineStart(index)).put(layout.getLineEnd(index)).put(layout.getLineTop(index))
      .put(layout.getLineBottom(index)).put(layout.getLineWidth(index)).put(layout.getParagraphDirection(index)));
    return lines;
  }

  public static void run(Context context, Recorder recorder) throws Exception {
    UiThreadUtil.assertOnUiThread();
    ReactFontManager manager = ReactFontManager.getInstance();
    String override = "cui-font-fixture-override", custom = "cui-font-fixture-custom";
    Typeface[] overrides = {Typeface.MONOSPACE, Typeface.SERIF, Typeface.SANS_SERIF, Typeface.DEFAULT_BOLD};
    for (int style = 0; style < 4; style++) manager.setTypeface(override, style, overrides[style]);
    manager.setTypeface(custom, 0, Typeface.MONOSPACE);
    manager.addCustomFont(custom, Typeface.SERIF);
    String[] families = {override, custom, "sans-serif", "cui-font-fixture-missing"};
    int[] styles = {-1, 0, 1, 2, 3};
    int[] weights = {-1, 100, 200, 300, 400, 500, 600, 700, 800, 900};
    String[] features = {null, "'liga' off, 'tnum'"};
    int cases = 0;
    for (String family : families) for (int style : styles) for (int weight : weights) for (String feature : features) {
      CustomStyleSpan source = new CustomStyleSpan(style, weight, feature, family, context.getAssets());
      SpannableStringBuilder original = text(source);
      Object[] originalSpans = original.getSpans(0, original.length(), Object.class);
      ReactTextPaintHolderSpan originalHolder = original.getSpans(0, 0, ReactTextPaintHolderSpan.class)[0];
      TextPaint originalPaint = originalHolder.getTextPaint();
      Cache before = new Cache();
      SpannableString copied = CUIMotionIntrinsics.copyCachedText(original);
      MetricAffectingSpan copiedStyle = owned(copied);
      require(copied.getSpans(0, copied.length(), CustomStyleSpan.class).length == 0, "no original named callback in copy");
      require(copied.getSpanStart(copiedStyle) == original.getSpanStart(source) &&
        copied.getSpanEnd(copiedStyle) == original.getSpanEnd(source) &&
        copied.getSpanFlags(copiedStyle) == original.getSpanFlags(source), "exact font span boundaries/priority");
      TextPaint actual = paint(); copiedStyle.updateMeasureState(actual);
      TextPaint actualDraw = paint(); copiedStyle.updateDrawState(actualDraw);
      StaticLayout copiedLayout = layout(copied, paint());
      before.unchanged();
      require(originalHolder.getTextPaint() == originalPaint && originalPaint.getTextSize() == 31 &&
        originalPaint.getTypeface() == Typeface.MONOSPACE && originalPaint.drawableState[0] == 2, "original paint unchanged");
      Object[] afterSpans = original.getSpans(0, original.length(), Object.class);
      require(originalSpans.length == afterSpans.length && original.toString().equals(TEXT), "original cached text unchanged");
      for (int index = 0; index < originalSpans.length; index++) require(originalSpans[index] == afterSpans[index], "original span order/identity unchanged");
      TextPaint expected = paint(); source.updateMeasureState(expected);
      TextPaint expectedDraw = paint(); source.updateDrawState(expectedDraw);
      require(expected.getTypeface().equals(actual.getTypeface()) && expectedDraw.getTypeface().equals(actualDraw.getTypeface()), "actual source font correspondence");
      require(expected.getFlags() == actual.getFlags() && expectedDraw.getFlags() == actualDraw.getFlags(), "actual source font paint flags");
      require(java.util.Objects.equals(expected.getFontFeatureSettings(), actual.getFontFeatureSettings()), "actual source features");
      require(expected.measureText(TEXT) == actual.measureText(TEXT), "actual source glyph width");
      JSONArray expectedLines = lines(layout(original, paint())), actualLines = lines(copiedLayout);
      require(expectedLines.toString().equals(actualLines.toString()), "actual source multiline RTL layout");
      if (family.equals(override)) {
        int nearest = new ReactFontManager.TypefaceStyle(style, weight).getNearestStyle();
        require(actual.getTypeface() == overrides[nearest], "exact registered override handle without weight reapplication");
      }
      recorder.record(new JSONObject().put("kind", "font-case").put("case", cases++)
        .put("family", family).put("style", style).put("weight", weight).put("features", feature == null ? JSONObject.NULL : feature)
        .put("actualStyle", actual.getTypeface().getStyle()).put("actualWeight", Build.VERSION.SDK_INT >= 28 ? actual.getTypeface().getWeight() : JSONObject.NULL)
        .put("sourceWidth", expected.measureText(TEXT)).put("copiedWidth", actual.measureText(TEXT))
        .put("sourceLines", expectedLines).put("copiedLines", actualLines).put("originalCachesUnchanged", true));
    }
    CustomStyleSpan fitting = new CustomStyleSpan(3, -1, "'liga' off", custom, context.getAssets());
    SpannableStringBuilder original = text(fitting);
    SpannableString fit = CUIMotionIntrinsics.copyCachedText(original);
    Cache beforeFit = new Cache();
    TextPaint copiedPaint = fit.getSpans(0, 0, ReactTextPaintHolderSpan.class)[0].getTextPaint();
    TextLayoutManager.adjustSpannableFontToFit(fit, 100, YogaMeasureMode.EXACTLY, 40,
      YogaMeasureMode.AT_MOST, 4, 2, true, 1, 0, Layout.Alignment.ALIGN_NORMAL, 0, copiedPaint);
    beforeFit.unchanged();
    require(original.getSpans(0,0,ReactTextPaintHolderSpan.class)[0].getTextPaint().getTextSize() == 31 &&
      original.getSpans(0,original.length(),ReactAbsoluteSizeSpan.class)[0].getSize() == 31, "font fitting leaves original size/paint unchanged");
    String lifetime = "cui-font-fixture-lifetime";
    manager.setTypeface(lifetime, 0, Typeface.MONOSPACE);
    CustomStyleSpan source = new CustomStyleSpan(0,400,null,lifetime,context.getAssets());
    SpannableString first = CUIMotionIntrinsics.copyCachedText(text(source));
    manager.setTypeface(lifetime, 0, Typeface.SERIF);
    SpannableString second = CUIMotionIntrinsics.copyCachedText(text(source));
    TextPaint firstPaint = paint(), secondPaint = paint();
    Cache beforeLifetime = new Cache();
    owned(first).updateMeasureState(firstPaint); owned(second).updateMeasureState(secondPaint);
    beforeLifetime.unchanged();
    require(firstPaint.getTypeface() == Typeface.MONOSPACE && secondPaint.getTypeface() == Typeface.SERIF, "independent request snapshots across registration changes");
    Cache beforeFailure = new Cache();
    NativeIntrinsicAndroidAssertions.run(context);
    beforeFailure.unchanged();
    recorder.record(new JSONObject().put("kind", "font-summary").put("cases", cases).put("assertions", assertions)
      .put("sdk", Build.VERSION.SDK_INT).put("fontFitting", true).put("requestIsolation", true)
      .put("sourceCachesUnchangedByScratch", true).put("fullCard", false));
  }
}
