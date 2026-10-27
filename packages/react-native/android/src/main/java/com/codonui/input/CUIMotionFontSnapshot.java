package com.codonui.input;

import android.content.res.AssetManager;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.style.MetricAffectingSpan;
import android.util.SparseArray;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.common.assets.ReactFontManager;
import com.facebook.react.views.text.internal.span.CustomStyleSpan;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.Map;

// RN0.86.3 only. Peer containers are read on the UI thread and never escape capture.
final class CUIMotionFontSnapshot {
  private static final class PinnedFonts {
    static final Class<?> family;
    static final Field fonts;
    static final Field custom;
    static final Field styles;
    static final Field assets;
    static final Field style;
    static final Field weight;
    static {
      try {
        family = Class.forName("com.facebook.react.common.assets.ReactFontManager$AssetFontFamily");
        if (family.getEnclosingClass() != ReactFontManager.class)
          throw new NoSuchFieldException("font family owner");
        fonts = descriptor(ReactFontManager.class, "fontCache", Map.class);
        custom = descriptor(ReactFontManager.class, "customTypefaceCache", Map.class);
        styles = descriptor(family, "typefaceSparseArray", SparseArray.class);
        assets = descriptor(CustomStyleSpan.class, "assetManager", AssetManager.class);
        style = descriptor(CustomStyleSpan.class, "privateStyle", int.class);
        weight = descriptor(CustomStyleSpan.class, "privateWeight", int.class);
      } catch (ReflectiveOperationException failure) {
        throw new IllegalStateException("Native motion: pinned font snapshot unavailable", failure);
      }
    }
  }

  private static Field descriptor(Class<?> owner, String name, Class<?> type) throws NoSuchFieldException {
    Field field = owner.getDeclaredField(name);
    int modifiers = field.getModifiers();
    if (field.getDeclaringClass() != owner || field.getType() != type ||
        !Modifier.isPrivate(modifiers) || !Modifier.isFinal(modifiers) || Modifier.isStatic(modifiers))
      throw new NoSuchFieldException(owner.getName() + "." + name);
    field.setAccessible(true);
    return field;
  }

  private static Object read(Field field, Object receiver) {
    try { return field.get(receiver); }
    catch (IllegalAccessException failure) {
      throw new IllegalStateException("Native motion: pinned font snapshot inaccessible", failure);
    }
  }

  private static final class Family {
    final Typeface custom;
    final Map<Integer, Typeface> styles;
    Family(Typeface custom, Map<Integer, Typeface> styles) {
      this.custom = custom;
      this.styles = Collections.unmodifiableMap(styles);
    }
  }

  private static Family captureFamily(String name, Map<?, ?> fonts, Map<?, ?> custom) {
    Object registered = custom.get(name);
    if (registered != null && !(registered instanceof Typeface))
      throw new IllegalStateException("Native motion: incompatible registered font");
    Map<Integer, Typeface> captured = new LinkedHashMap<>();
    Object family = fonts.get(name);
    if (family != null) {
      if (family.getClass() != PinnedFonts.family)
        throw new IllegalStateException("Native motion: incompatible font family");
      SparseArray<?> styles = (SparseArray<?>)read(PinnedFonts.styles, family);
      for (int index = 0; index < styles.size(); index++) {
        Object face = styles.valueAt(index);
        if (face != null && !(face instanceof Typeface))
          throw new IllegalStateException("Native motion: incompatible registered font style");
        captured.put(styles.keyAt(index), (Typeface)face);
      }
    }
    return new Family((Typeface)registered, captured);
  }

  private static boolean same(Family first, Family second) {
    if (first.custom != second.custom || !first.styles.keySet().equals(second.styles.keySet())) return false;
    for (Integer style : first.styles.keySet())
      if (first.styles.get(style) != second.styles.get(style)) return false;
    return true;
  }

  private static final class OwnedStyle extends MetricAffectingSpan {
    private final ReactFontManager manager;
    private final AssetManager assets;
    private final String family;
    private final int style;
    private final int weight;
    private final double scalarWeight;
    private final String features;
    OwnedStyle(ReactFontManager manager, AssetManager assets, String family, int style, int weight, double scalarWeight, String features) {
      this.manager = manager; this.assets = assets; this.family = family;
      this.style = style; this.weight = weight; this.scalarWeight = scalarWeight; this.features = features;
    }
    private void apply(TextPaint paint) {
      paint.setFontFeatureSettings(features);
      // Preserve the original layout engine's lookup order, including cache misses across spans.
      paint.setTypeface(manager.getTypeface(family, style, weight, assets));
      com.facebook.react.views.text.ReactFontWeightScalar.apply(paint, scalarWeight);
      paint.setSubpixelText(true);
      paint.setLinearText(true);
    }
    @Override public void updateMeasureState(TextPaint paint) { apply(paint); }
    @Override public void updateDrawState(TextPaint paint) { apply(paint); }
  }

  static Map<CustomStyleSpan, MetricAffectingSpan> capture(CustomStyleSpan[] spans) {
    UiThreadUtil.assertOnUiThread();
    boolean named = false;
    for (CustomStyleSpan span : spans) if (span.getFontFamily() != null) { named = true; break; }
    if (!named) return Collections.emptyMap();
    Map<String, Family> captured = new LinkedHashMap<>();
    ReactFontManager original = ReactFontManager.getInstance();
    Map<?, ?> fonts = (Map<?, ?>)read(PinnedFonts.fonts, original);
    Map<?, ?> custom = (Map<?, ?>)read(PinnedFonts.custom, original);
    for (CustomStyleSpan span : spans) {
      String name = span.getFontFamily();
      if (name != null && !captured.containsKey(name)) captured.put(name, captureFamily(name, fonts, custom));
    }
    // Reject an observed registration race; never retry against a different peer cache revision.
    for (Map.Entry<String, Family> entry : captured.entrySet())
      if (!same(entry.getValue(), captureFamily(entry.getKey(), fonts, custom)))
        throw new IllegalStateException("Native motion: font registrations changed during snapshot");
    Map<String, Family> snapshot = Collections.unmodifiableMap(captured);
    ReactFontManager owned = new ReactFontManager();
    for (Map.Entry<String, Family> entry : snapshot.entrySet()) {
      Family family = entry.getValue();
      for (Map.Entry<Integer, Typeface> style : family.styles.entrySet())
        owned.setTypeface(entry.getKey(), style.getKey(), style.getValue());
      owned.addCustomFont(entry.getKey(), family.custom);
    }
    Map<CustomStyleSpan, MetricAffectingSpan> replacements = new IdentityHashMap<>();
    for (CustomStyleSpan span : spans) {
      String name = span.getFontFamily();
      if (name == null) continue;
      AssetManager assets = (AssetManager)read(PinnedFonts.assets, span);
      if (assets == null) throw new IllegalStateException("Native motion: original font assets required");
      int style = (Integer)read(PinnedFonts.style, span);
      int weight = (Integer)read(PinnedFonts.weight, span);
      replacements.put(span, new OwnedStyle(owned, assets, name, style, weight, span.getWeightScalar(), span.getFontFeatureSettings()));
    }
    return replacements;
  }
}
