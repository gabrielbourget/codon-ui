/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * Copyright (c) Codon UI contributors.
 *
 * The painting routines are received from React Native 0.86.3 under its MIT license.
 * Original source: ReactAndroid/src/main/java/com/facebook/react/uimanager/drawable/
 * {BackgroundDrawable,BackgroundImageDrawable,BorderDrawable,OutlineDrawable,
 * InsetBoxShadowDrawable,OutsetBoxShadowDrawable,BoxShadowBorderRadius}.kt
 * and uimanager/style/BorderColors.kt. See cpp/motion/UPSTREAM.json for pinned receipts.
 */
package com.codonui.input;

import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.DashPathEffect;
import android.graphics.Outline;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.PointF;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.View;
import android.view.ViewOutlineProvider;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.modules.i18nmanager.I18nUtil;
import com.facebook.react.uimanager.LengthPercentage;
import com.facebook.react.uimanager.LengthPercentageType;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.Spacing;
import com.facebook.react.uimanager.drawable.BackgroundDrawable;
import com.facebook.react.uimanager.drawable.BackgroundImageDrawable;
import com.facebook.react.uimanager.drawable.BorderDrawable;
import com.facebook.react.uimanager.drawable.CompositeBackgroundDrawable;
import com.facebook.react.uimanager.drawable.InsetBoxShadowDrawable;
import com.facebook.react.uimanager.drawable.OutsetBoxShadowDrawable;
import com.facebook.react.uimanager.drawable.OutlineDrawable;
import com.facebook.react.uimanager.style.BackgroundImageLayer;
import com.facebook.react.uimanager.style.BackgroundPosition;
import com.facebook.react.uimanager.style.BackgroundRepeat;
import com.facebook.react.uimanager.style.BackgroundRepeatKeyword;
import com.facebook.react.uimanager.style.BackgroundSize;
import com.facebook.react.uimanager.style.BackgroundSizeLengthPercentage;
import com.facebook.react.uimanager.style.BorderRadiusStyle;
import com.facebook.react.uimanager.style.BorderStyle;
import com.facebook.react.uimanager.style.BoxShadow;
import com.facebook.react.uimanager.style.ComputedBorderRadius;
import com.facebook.react.uimanager.style.CornerRadii;
import com.facebook.react.uimanager.style.LogicalEdge;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/** Only this host's opt-in corrected drawing changes; RN retains its authored style holders. */
final class CUIMotionDrawing {
  private static final String[] CORNERS = {"topLeft", "topRight", "bottomRight", "bottomLeft"};
  private final CUIFocusView host;
  private final Integer[] borderColors = new Integer[LogicalEdge.values().length];
  private final List<BoxShadow> shadows = new ArrayList<>();
  private final List<Layer> layers = new ArrayList<>();
  private boolean enabled;
  private float[] corrections = new float[] {Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN};
  private boolean hasCorrections;
  private CompositeBackgroundDrawable composite;
  private ViewOutlineProvider authoredOutline;
  private final ViewOutlineProvider correctedOutline = new ViewOutlineProvider() {
    @Override public void getOutline(View view, Outline outline) {
      synchronize();
      if (!active() || composite == null) {
        if (authoredOutline != null) authoredOutline.getOutline(view, outline);
        return;
      }
      if (authoredOutline != ViewOutlineProvider.BACKGROUND) {
        if (authoredOutline != null) authoredOutline.getOutline(view, outline);
        return;
      }
      // Preserve the background provider's opacity semantics before replacing its path.
      authoredOutline.getOutline(view, outline);
      RectF bounds = new RectF(composite.getBounds());
      Path path = rounded(bounds, elevationRadii(bounds));
      if (Build.VERSION.SDK_INT >= 30) outline.setPath(path);
      else outline.setConvexPath(path);
    }
  };

  CUIMotionDrawing(CUIFocusView host) { this.host = host; }
  boolean active() { return enabled && hasCorrections; }
  void setEnabled(boolean value) { enabled = value; synchronize(); host.invalidate(); }
  void setRadii(String encoded) {
    float[] next = new float[] {Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN, Float.NaN};
    boolean present = false;
    try {
      JSONObject object = encoded == null || encoded.isEmpty() ? new JSONObject() : new JSONObject(encoded);
      for (int corner = 0; corner < 4; corner++) {
        if (!object.has(CORNERS[corner]) || object.isNull(CORNERS[corner])) continue;
        JSONObject value = object.getJSONObject(CORNERS[corner]);
        for (int axis = 0; axis < 2; axis++) {
          Object raw = value.get(axis == 0 ? "x" : "y");
          if (!(raw instanceof Number)) throw new JSONException("Finite nonnegative native radius required");
          double number = ((Number)raw).doubleValue();
          if (!Double.isFinite(number) || number < 0 || number > Float.MAX_VALUE) throw new JSONException("Finite nonnegative native radius required");
          next[corner * 2 + axis] = (float)number;
        }
        present = true;
      }
    } catch (JSONException error) { throw new IllegalArgumentException("Invalid CUI native projection radii", error); }
    corrections = next; hasCorrections = present;
    synchronize(); host.invalidate(); host.invalidateOutline();
  }
  void setBorderColor(int index, Integer value) { borderColors[index] = value; }
  void setShadows(ReadableArray values) {
    shadows.clear();
    if (values != null) for (int index = 0; index < values.size(); index++) {
      BoxShadow shadow = BoxShadow.parse(values.getMap(index), host.getContext());
      if (shadow == null) throw new IllegalArgumentException("Invalid CUI native box shadow");
      shadows.add(shadow);
    }
  }

  void synchronize() {
    Drawable background = host.getBackground();
    CompositeBackgroundDrawable current = background instanceof CompositeBackgroundDrawable ? (CompositeBackgroundDrawable)background : null;
    if (!active() || current != composite) restore();
    if (!active()) return;
    if (host.getOutlineProvider() != correctedOutline) {
      authoredOutline = host.getOutlineProvider(); host.setOutlineProvider(correctedOutline);
    }
    if (current == null || current == composite) return;
    composite = current;
    List<BoxShadow> outer = new ArrayList<>(), inner = new ArrayList<>();
    for (BoxShadow shadow : shadows) {
      if (Boolean.TRUE.equals(shadow.getInset())) { if (Build.VERSION.SDK_INT >= 29) inner.add(shadow); }
      else if (Build.VERSION.SDK_INT >= 28) outer.add(shadow);
    }
    int outerIndex = outer.size() - 1, innerIndex = inner.size() - 1;
    for (int index = 0; index < current.getNumberOfLayers(); index++) {
      Drawable original = current.getDrawable(index);
      BoxShadow shadow = null;
      if (original instanceof OutsetBoxShadowDrawable) {
        if (outerIndex < 0) throw new IllegalStateException("CUI shadow input was not captured by its owned manager");
        shadow = outer.get(outerIndex--);
      } else if (original instanceof InsetBoxShadowDrawable) {
        if (innerIndex < 0) throw new IllegalStateException("CUI inset shadow input was not captured by its owned manager");
        shadow = inner.get(innerIndex--);
      } else if (!(original instanceof BackgroundDrawable) && !(original instanceof BackgroundImageDrawable) && !(original instanceof BorderDrawable) && !(original instanceof OutlineDrawable)) continue;
      Layer layer = new Layer(original, index, shadow);
      current.setDrawable(index, layer);
      original.setCallback(layer);
      layers.add(layer);
    }
    host.invalidateOutline();
  }
  private void restore() {
    if (composite != null) for (Layer layer : layers) {
      if (composite.getDrawable(layer.index) == layer) composite.setDrawable(layer.index, layer.original);
    }
    layers.clear(); composite = null;
    if (host.getOutlineProvider() == correctedOutline) host.setOutlineProvider(authoredOutline);
  }
  void retire() {
    enabled = false; restore();
    Arrays.fill(corrections, Float.NaN); hasCorrections = false;
    Arrays.fill(borderColors, null); shadows.clear();
  }

  void clipChildren(Canvas canvas) {
    synchronize();
    Rect drawing = new Rect(); host.getDrawingRect(drawing);
    if (composite == null) { canvas.clipRect(drawing); return; }
    RectF widths = insets(), bounds = new RectF(composite.getBounds());
    float[] radii = innerRadii(radii(bounds), widths, 1);
    bounds = inset(bounds, widths, 1);
    Path path = rounded(bounds, radii); path.offset(drawing.left, drawing.top);
    canvas.clipPath(path);
  }

  private float px(float dp) { return PixelUtil.toPixelFromDIP(dp); }
  private RectF insets() {
    if (composite == null || composite.getBorderInsets() == null) return new RectF();
    RectF values = composite.getBorderInsets().resolve(host.getLayoutDirection(), host.getContext());
    return new RectF(finitePx(values.left), finitePx(values.top), finitePx(values.right), finitePx(values.bottom));
  }
  private float finitePx(float value) { return Float.isNaN(value) ? 0 : px(value); }
  private float[] elevationRadii(RectF bounds) {
    float[] result = new float[8];
    BorderRadiusStyle style = composite.getBorderRadius();
    if (style != null) {
      // CompositeBackgroundDrawable resolves this particular path against pixel bounds,
      // then converts the resolved radii and border offsets from DIP. Keep that pinned
      // percentage behavior for every corner that has no explicit correction.
      ComputedBorderRadius resolved = style.resolve(composite.getLayoutDirection(), host.getContext(), bounds.width(), bounds.height());
      CornerRadii[] corners = {resolved.getTopLeft(), resolved.getTopRight(), resolved.getBottomRight(), resolved.getBottomLeft()};
      for (int corner = 0; corner < 4; corner++) {
        result[corner * 2] = corners[corner].getHorizontal();
        result[corner * 2 + 1] = corners[corner].getVertical();
      }
    }
    RectF widths = composite.getBorderInsets() == null ? new RectF() : composite.getBorderInsets().resolve(composite.getLayoutDirection(), host.getContext());
    float[] expansion = {widths.left, widths.top, widths.right, widths.top, widths.right, widths.bottom, widths.left, widths.bottom};
    for (int axis = 0; axis < 8; axis++) {
      if (!Float.isNaN(corrections[axis])) result[axis] = corrections[axis];
      result[axis] = px(result[axis] + expansion[axis]);
    }
    return result;
  }
  private float[] radii(RectF bounds) {
    float[] result = new float[8];
    BorderRadiusStyle style = composite == null ? null : composite.getBorderRadius();
    if (style != null) {
      boolean rtl = host.getLayoutDirection() == View.LAYOUT_DIRECTION_RTL;
      boolean swap = rtl && I18nUtil.getInstance().doLeftAndRightSwapInRTL(host.getContext());
      LengthPercentage[] corners;
      if (!rtl) {
        corners = new LengthPercentage[] {
          first(style.getStartStart(), style.getTopStart(), style.getTopLeft(), style.getUniform()),
          first(style.getEndStart(), style.getTopEnd(), style.getTopRight(), style.getUniform()),
          first(style.getEndEnd(), style.getBottomEnd(), style.getBottomRight(), style.getUniform()),
          first(style.getStartEnd(), style.getBottomStart(), style.getBottomLeft(), style.getUniform())
        };
      } else if (swap) {
        corners = new LengthPercentage[] {
          first(style.getEndStart(), style.getTopEnd(), style.getTopRight(), style.getUniform()),
          first(style.getStartStart(), style.getTopStart(), style.getTopLeft(), style.getUniform()),
          first(style.getStartEnd(), style.getBottomStart(), style.getBottomLeft(), style.getUniform()),
          first(style.getEndEnd(), style.getBottomEnd(), style.getBottomRight(), style.getUniform())
        };
      } else {
        corners = new LengthPercentage[] {
          first(style.getEndStart(), style.getTopEnd(), style.getTopLeft(), style.getUniform()),
          first(style.getStartStart(), style.getTopStart(), style.getTopRight(), style.getUniform()),
          first(style.getStartEnd(), style.getBottomEnd(), style.getBottomRight(), style.getUniform()),
          first(style.getEndEnd(), style.getBottomStart(), style.getBottomLeft(), style.getUniform())
        };
      }
      float width = PixelUtil.toDIPFromPixel(bounds.width()), height = PixelUtil.toDIPFromPixel(bounds.height());
      for (int index = 0; index < 4; index++) if (corners[index] != null) {
        result[index * 2] = px(corners[index].resolve(width));
        result[index * 2 + 1] = px(corners[index].resolve(height));
      }
    }
    for (int axis = 0; axis < 8; axis++) if (!Float.isNaN(corrections[axis])) result[axis] = px(corrections[axis]);
    float left = fit(bounds.height(), result[1] + result[7]), top = fit(bounds.width(), result[0] + result[2]);
    float right = fit(bounds.height(), result[3] + result[5]), bottom = fit(bounds.width(), result[4] + result[6]);
    float[] scales = {Math.min(left, top), Math.min(top, right), Math.min(right, bottom), Math.min(bottom, left)};
    for (int index = 0; index < 4; index++) { result[index * 2] *= scales[index]; result[index * 2 + 1] *= scales[index]; }
    return result;
  }
  private static float fit(float size, float total) { return total > 0 ? Math.min(size / total, 1) : 0; }
  private static Path rounded(RectF bounds, float[] radii) { Path path = new Path(); path.addRoundRect(bounds, radii, Path.Direction.CW); return path; }
  private static RectF inset(RectF bounds, RectF widths, float factor) { return new RectF(bounds.left + widths.left * factor, bounds.top + widths.top * factor, bounds.right - widths.right * factor, bounds.bottom - widths.bottom * factor); }
  private static float[] innerRadii(float[] radii, RectF widths, float factor) {
    float[] result = radii.clone();
    float[] edges = {widths.left, widths.top, widths.right, widths.top, widths.right, widths.bottom, widths.left, widths.bottom};
    for (int axis = 0; axis < 8; axis++) result[axis] = Math.max(0, result[axis] - edges[axis] * factor);
    return result;
  }
  private static boolean rounded(float[] radii) { for (float radius : radii) if (radius != 0) return true; return false; }
  private static boolean uniform(float[] radii) { for (int index = 2; index < 8; index++) if (radii[index] != radii[index % 2]) return false; return true; }
  private static int alpha(int color, int value) {
    if (value == 255) return color;
    if (value == 0) return color & 0x00ffffff;
    int scaled = value + (value >> 7);
    // The intermediate shift is present in both RN 0.86.3 source and bytecode.
    // Retain its intermediate-alpha behavior rather than repairing the peer helper.
    return (((color >>> 24) * (scaled >> 7) >> 8) << 24) | (color & 0x00ffffff);
  }
  private static void effect(Paint paint, String style, float width) {
    float length = "DASHED".equals(style) ? width * 3 : width;
    paint.setPathEffect(width <= 0 || style == null || "SOLID".equals(style) ? null : new DashPathEffect(new float[] {length, length, length, length}, 0));
  }
  private int color(LogicalEdge... edges) { for (LogicalEdge edge : edges) { Integer color = borderColors[edge.ordinal()]; if (color != null) return color; } return Color.BLACK; }
  private int[] colors() {
    boolean rtl = host.getLayoutDirection() == View.LAYOUT_DIRECTION_RTL;
    boolean swap = rtl && I18nUtil.getInstance().doLeftAndRightSwapInRTL(host.getContext());
    return new int[] {
      color(rtl ? LogicalEdge.END : LogicalEdge.START, swap ? LogicalEdge.RIGHT : LogicalEdge.LEFT, LogicalEdge.HORIZONTAL, LogicalEdge.ALL),
      color(LogicalEdge.BLOCK_START, LogicalEdge.TOP, LogicalEdge.BLOCK, LogicalEdge.VERTICAL, LogicalEdge.ALL),
      color(rtl ? LogicalEdge.START : LogicalEdge.END, swap ? LogicalEdge.LEFT : LogicalEdge.RIGHT, LogicalEdge.HORIZONTAL, LogicalEdge.ALL),
      color(LogicalEdge.BLOCK_END, LogicalEdge.BOTTOM, LogicalEdge.BLOCK, LogicalEdge.VERTICAL, LogicalEdge.ALL)
    };
  }

  private final class Layer extends Drawable implements Drawable.Callback {
    final Drawable original;
    final int index;
    final BoxShadow shadow;
    final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    int opacity = 255;
    ColorFilter filter;
    Layer(Drawable original, int index, BoxShadow shadow) { this.original = original; this.index = index; this.shadow = shadow; }
    @Override public void draw(Canvas canvas) {
      RectF bounds = new RectF(getBounds()); float[] radii = radii(bounds); RectF widths = insets();
      paint.reset(); paint.setAntiAlias(true);
      if (original instanceof BackgroundDrawable) background(canvas, bounds, radii, widths);
      else if (original instanceof BackgroundImageDrawable) images(canvas, bounds, radii, widths);
      else if (original instanceof BorderDrawable) border(canvas, bounds, radii, widths);
      else if (original instanceof OutlineDrawable) outline(canvas, bounds, radii);
      else if (shadow != null) shadow(canvas, bounds, radii, widths);
    }
    @Override protected void onBoundsChange(Rect bounds) { original.setBounds(bounds); }
    @Override protected boolean onStateChange(int[] state) { return original.setState(state); }
    @Override protected boolean onLevelChange(int level) { return original.setLevel(level); }
    @Override public boolean setVisible(boolean visible, boolean restart) {
      boolean changed = super.setVisible(visible, restart);
      return original.setVisible(visible, restart) || changed;
    }
    @Override public boolean isStateful() { return original.isStateful(); }
    @Override public void setAlpha(int alpha) { opacity = alpha; original.setAlpha(alpha); invalidateSelf(); }
    @Override public int getAlpha() { return opacity; }
    @Override public void setColorFilter(ColorFilter value) { filter = value; original.setColorFilter(value); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    @Override public boolean getPadding(Rect padding) { return original.getPadding(padding); }
    @Override public void invalidateDrawable(Drawable drawable) { invalidateSelf(); host.invalidateOutline(); }
    @Override public void scheduleDrawable(Drawable drawable, Runnable work, long time) { scheduleSelf(work, time); }
    @Override public void unscheduleDrawable(Drawable drawable, Runnable work) { unscheduleSelf(work); }
    @Override public void jumpToCurrentState() { original.jumpToCurrentState(); }
    @Override public void setHotspot(float x, float y) { original.setHotspot(x, y); }
    @Override public boolean onLayoutDirectionChanged(int direction) { return original.setLayoutDirection(direction); }

    private void background(Canvas canvas, RectF bounds, float[] radii, RectF widths) {
      paint.setStyle(Paint.Style.FILL);
      paint.setColor(((BackgroundDrawable)original).getBackgroundColor());
      paint.setAlpha(Math.round(opacity / 255f * Color.alpha(paint.getColor())));
      if ((widths.left != 0 || widths.top != 0 || widths.right != 0 || widths.bottom != 0)) bounds.inset(0.8f, 0.8f);
      if (paint.getAlpha() == 0) return;
      if (!rounded(radii)) canvas.drawRect(bounds, paint);
      else if (uniform(radii)) canvas.drawRoundRect(bounds, radii[0], radii[1], paint);
      else canvas.drawPath(rounded(bounds, radii), paint);
    }

    private void outline(Canvas canvas, RectF bounds, float[] radii) {
      OutlineDrawable source = (OutlineDrawable)original;
      float width = source.getOutlineWidth(), offset = source.getOutlineOffset();
      if (width == 0) return;
      paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(width); paint.setColor(source.getOutlineColor());
      paint.setAlpha(Math.round(opacity / 255f * Color.alpha(source.getOutlineColor()))); paint.setColorFilter(filter);
      effect(paint, source.getOutlineStyle().name(), width);
      bounds.inset(-(width * 0.5f + offset - 0.8f), -(width * 0.5f + offset - 0.8f));
      for (int axis = 0; axis < 8; axis++) if (radii[axis] != 0) radii[axis] += width * 0.5f + offset;
      canvas.drawPath(rounded(bounds, radii), paint);
    }

    private void shadow(Canvas canvas, RectF bounds, float[] radii, RectF widths) {
      int color = shadow.getColor() == null ? Color.BLACK : shadow.getColor();
      float blur = shadow.getBlurRadius() == null ? 0 : shadow.getBlurRadius();
      float spread = px(shadow.getSpreadDistance() == null ? 0 : shadow.getSpreadDistance());
      float x = px(shadow.getOffsetX()), y = px(shadow.getOffsetY());
      paint.setAntiAlias(false); paint.setColor(color); paint.setAlpha(Math.round(opacity / 255f * Color.alpha(color))); paint.setColorFilter(filter);
      float maskRadius = blurRadius(blur * 0.5f);
      if (maskRadius > 0) paint.setMaskFilter(new BlurMaskFilter(maskRadius, BlurMaskFilter.Blur.NORMAL));
      int saved = canvas.save();
      if (!Boolean.TRUE.equals(shadow.getInset())) {
        RectF shadowBounds = new RectF(bounds); shadowBounds.inset(-spread, -spread); shadowBounds.offset(x, y);
        if (rounded(radii)) { RectF clip = new RectF(bounds); clip.inset(0.4f, 0.4f); canvas.clipOutPath(rounded(clip, radii)); }
        else canvas.clipOutRect(bounds);
        if (rounded(radii)) { for (int axis = 0; axis < 8; axis++) radii[axis] = spreadRadius(radii[axis], spread); canvas.drawPath(rounded(shadowBounds, radii), paint); }
        else canvas.drawRect(shadowBounds, paint);
      } else {
        RectF padding = inset(bounds, widths, 1); float[] paddingRadii = innerRadii(radii, widths, 1);
        RectF hole = new RectF(padding);
        if (2 * spread > padding.width()) hole.setEmpty(); else hole.inset(spread, spread);
        hole.offset(x, y);
        float extent = blurRadius(blur);
        RectF outer = new RectF(padding); outer.inset(-extent, -extent); outer.union(hole);
        canvas.clipPath(rounded(padding, paddingRadii));
        for (int axis = 0; axis < 8; axis++) paddingRadii[axis] = spreadRadius(paddingRadii[axis], -spread);
        canvas.drawDoubleRoundRect(outer, new float[8], hole, paddingRadii, paint);
      }
      canvas.restoreToCount(saved);
    }

    private void border(Canvas canvas, RectF bounds, float[] radii, RectF widths) {
      BorderDrawable source = (BorderDrawable)original;
      BorderStyle style = source.getBorderStyle();
      float fullWidth = source.getBorderWidth() == null ? Float.NaN : source.getBorderWidth().getRaw(Spacing.ALL);
      if (Float.isNaN(fullWidth)) fullWidth = 0;
      effect(paint, style == null ? null : style.name(), fullWidth);
      int[] colors = colors();
      if (composite.getBorderRadius() == null || !composite.getBorderRadius().hasRoundedBorders()) {
        if (!hasCorrections) { rectangularBorder(canvas, bounds, widths, colors, style); return; }
      }
      int saved = canvas.save(); canvas.clipPath(rounded(bounds, radii));
      int allColor = color(LogicalEdge.ALL);
      if (widths.left == fullWidth && widths.top == fullWidth && widths.right == fullWidth && widths.bottom == fullWidth && colors[0] == allColor && colors[1] == allColor && colors[2] == allColor && colors[3] == allColor) {
        if (fullWidth > 0) {
          paint.setColor(alpha(allColor, opacity)); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(fullWidth);
          RectF center = inset(bounds, widths, 0.5f); float[] centerRadii = radii.clone();
          float[] edgeWidths = {widths.left, widths.top, widths.right, widths.top, widths.right, widths.bottom, widths.left, widths.bottom};
          for (int axis = 0; axis < 8; axis++) centerRadii[axis] -= edgeWidths[axis] * 0.5f;
          if (uniform(radii)) canvas.drawRoundRect(center, radii[0] - widths.left * 0.5f, radii[1] - widths.top * 0.5f, paint);
          else canvas.drawPath(rounded(center, centerRadii), paint);
        }
      } else if (widths.left > 0 || widths.top > 0 || widths.right > 0 || widths.bottom > 0) {
        paint.setStyle(Paint.Style.FILL);
        boolean visible = Color.alpha(colors[0]) != 0 || Color.alpha(colors[1]) != 0 || Color.alpha(colors[2]) != 0 || Color.alpha(colors[3]) != 0;
        RectF inner = visible ? inset(bounds, widths, 1) : new RectF(bounds); float[] innerRadii = innerRadii(radii, widths, 1);
        canvas.clipOutPath(rounded(inner, innerRadii));
        PointF tl = intersection(inner.left, inner.top, inner.left + 2 * innerRadii[0], inner.top + 2 * innerRadii[1], bounds.left, bounds.top, inner.left, inner.top);
        PointF tr = intersection(inner.right - 2 * innerRadii[2], inner.top, inner.right, inner.top + 2 * innerRadii[3], bounds.right, bounds.top, inner.right, inner.top);
        PointF br = intersection(inner.right - 2 * innerRadii[4], inner.bottom - 2 * innerRadii[5], inner.right, inner.bottom, bounds.right, bounds.bottom, inner.right, inner.bottom);
        PointF bl = intersection(inner.left, inner.bottom - 2 * innerRadii[7], inner.left + 2 * innerRadii[6], inner.bottom, bounds.left, bounds.bottom, inner.left, inner.bottom);
        float gap = 0.8f;
        if (widths.left > 0) quad(canvas, colors[0], bounds.left, bounds.top-gap, tl.x, tl.y-gap, bl.x, bl.y+gap, bounds.left, bounds.bottom+gap);
        if (widths.top > 0) quad(canvas, colors[1], bounds.left-gap, bounds.top, tl.x-gap, tl.y, tr.x+gap, tr.y, bounds.right+gap, bounds.top);
        if (widths.right > 0) quad(canvas, colors[2], bounds.right, bounds.top-gap, tr.x, tr.y-gap, br.x, br.y+gap, bounds.right, bounds.bottom+gap);
        if (widths.bottom > 0) quad(canvas, colors[3], bounds.left-gap, bounds.bottom, bl.x-gap, bl.y, br.x+gap, br.y, bounds.right+gap, bounds.bottom);
      }
      canvas.restoreToCount(saved);
    }

    private void rectangularBorder(Canvas canvas, RectF bounds, RectF widths, int[] colors, BorderStyle style) {
      int left = Math.round(widths.left), top = Math.round(widths.top), right = Math.round(widths.right), bottom = Math.round(widths.bottom);
      int and = (left > 0 ? colors[0] : -1) & (top > 0 ? colors[1] : -1) & (right > 0 ? colors[2] : -1) & (bottom > 0 ? colors[3] : -1);
      int or = (left > 0 ? colors[0] : 0) | (top > 0 ? colors[1] : 0) | (right > 0 ? colors[2] : 0) | (bottom > 0 ? colors[3] : 0);
      boolean fast = and == or && and != 0;
      for (int color : colors) fast &= Color.alpha(color) == 255;
      if (fast) {
        paint.setColor(alpha(and, opacity)); paint.setStyle(Paint.Style.STROKE);
        int[] sizes = {left, top, right, bottom};
        for (int edge = 0; edge < 4; edge++) if (sizes[edge] > 0) {
          int width = sizes[edge]; paint.setStrokeWidth(width); effect(paint, style == null ? null : style.name(), width);
          Path path = new Path();
          if (edge == 0 || edge == 2) { float x = edge == 0 ? bounds.left + width / 2 : bounds.right - width / 2; path.moveTo(x, bounds.top); path.lineTo(x, bounds.bottom); }
          else { float y = edge == 1 ? bounds.top + width / 2 : bounds.bottom - width / 2; path.moveTo(bounds.left, y); path.lineTo(bounds.right, y); }
          canvas.drawPath(path, paint);
        }
      } else {
        paint.setAntiAlias(false);
        if (left > 0) quad(canvas, colors[0], bounds.left, bounds.top, bounds.left+left, bounds.top+top, bounds.left+left, bounds.bottom-bottom, bounds.left, bounds.bottom);
        if (top > 0) quad(canvas, colors[1], bounds.left, bounds.top, bounds.left+left, bounds.top+top, bounds.right-right, bounds.top+top, bounds.right, bounds.top);
        if (right > 0) quad(canvas, colors[2], bounds.right, bounds.top, bounds.right, bounds.bottom, bounds.right-right, bounds.bottom-bottom, bounds.right-right, bounds.top+top);
        if (bottom > 0) quad(canvas, colors[3], bounds.left, bounds.bottom, bounds.right, bounds.bottom, bounds.right-right, bounds.bottom-bottom, bounds.left+left, bounds.bottom-bottom);
      }
    }
    private void quad(Canvas canvas, int color, float... points) {
      if (color == Color.TRANSPARENT) return;
      paint.setColor(alpha(color, opacity)); Path path = new Path(); path.moveTo(points[0], points[1]);
      for (int index = 2; index < 8; index += 2) path.lineTo(points[index], points[index + 1]);
      path.lineTo(points[0], points[1]); canvas.drawPath(path, paint);
    }

    private void images(Canvas canvas, RectF bounds, float[] radii, RectF widths) {
      BackgroundImageDrawable source = (BackgroundImageDrawable)original;
      List<BackgroundImageLayer> images = source.getBackgroundImageLayers();
      if (images == null || images.isEmpty()) return;
      RectF positioning = inset(bounds, widths, 1);
      if (positioning.width() <= 0 || positioning.height() <= 0 || bounds.width() <= 0 || bounds.height() <= 0) return;
      int saved = canvas.save(); canvas.clipPath(rounded(bounds, radii)); paint.setStyle(Paint.Style.FILL); paint.setAlpha(opacity);
      for (int index = images.size() - 1; index >= 0; index--) {
        BackgroundSize size = cycle(source.getBackgroundSize(), index);
        BackgroundRepeat repeat = cycle(source.getBackgroundRepeat(), index);
        BackgroundPosition position = cycle(source.getBackgroundPosition(), index);
        BackgroundRepeatKeyword repeatX = repeat == null ? BackgroundRepeatKeyword.Repeat : repeat.getX();
        BackgroundRepeatKeyword repeatY = repeat == null ? BackgroundRepeatKeyword.Repeat : repeat.getY();
        float tileWidth = positioning.width(), tileHeight = positioning.height();
        if (size instanceof BackgroundSize.LengthPercentageAuto) {
          BackgroundSizeLengthPercentage dimensions = ((BackgroundSize.LengthPercentageAuto)size).getLengthPercentage();
          if (dimensions.getX() != null && dimensions.getY() != null) { tileWidth = length(dimensions.getX(), positioning.width()); tileHeight = length(dimensions.getY(), positioning.height()); }
        }
        if (repeatX == BackgroundRepeatKeyword.Round && tileWidth > 0 && !equal(positioning.width() % tileWidth, 0)) { float count = round(positioning.width()/tileWidth); if (count > 0) tileWidth = positioning.width()/count; }
        if (repeatY == BackgroundRepeatKeyword.Round && tileHeight > 0 && !equal(positioning.height() % tileHeight, 0)) { float count = round(positioning.height()/tileHeight); if (count > 0) tileHeight = positioning.height()/count; }
        if (tileWidth <= 0 || tileHeight <= 0) continue;
        paint.setShader(images.get(index).getShader(tileWidth, tileHeight));
        float availableX = positioning.width() - tileWidth, availableY = positioning.height() - tileHeight;
        float x = positioning.left + (position != null && position.getLeft() != null ? length(position.getLeft(), availableX) : position != null && position.getRight() != null ? availableX-length(position.getRight(), availableX) : 0);
        float y = positioning.top + (position != null && position.getTop() != null ? length(position.getTop(), availableY) : position != null && position.getBottom() != null ? availableY-length(position.getBottom(), availableY) : 0);
        float[] horizontal = tiles(bounds.left, bounds.width(), tileWidth, x, repeatX), vertical = tiles(bounds.top, bounds.height(), tileHeight, y, repeatY);
        for (int column = 0; column < (int)horizontal[2]; column++) for (int row = 0; row < (int)vertical[2]; row++) {
          int tileSaved = canvas.save(); canvas.translate(horizontal[0] + column * (tileWidth + horizontal[1]), vertical[0] + row * (tileHeight + vertical[1]));
          canvas.drawRect(0, 0, tileWidth, tileHeight, paint); canvas.restoreToCount(tileSaved);
        }
      }
      canvas.restoreToCount(saved);
    }
    private float length(LengthPercentage length, float available) { return length.getType() == LengthPercentageType.PERCENT ? length.resolve(available) : px(length.resolve(available)); }
  }

  private float blurRadius(float sigma) {
    float pixels = px(sigma);
    return pixels > 0.5f ? (pixels - 0.5f) / 0.57735f : 0;
  }
  private static LengthPercentage first(LengthPercentage... values) { for (LengthPercentage value : values) if (value != null) return value; return null; }
  private static float spreadRadius(float radius, float spread) {
    float multiplier = radius < Math.abs(spread) ? 1 + (float)Math.pow(radius / Math.abs(spread) - 1, 3) : 1;
    return Math.max(0, radius + spread * multiplier);
  }
  private static <T> T cycle(List<T> values, int index) { return values == null || values.isEmpty() ? null : values.get(index % values.size()); }
  private static boolean equal(float a, float b) { return com.facebook.react.uimanager.FloatUtil.floatsEqual(a, b); }
  private static float round(float value) { return (float)Math.rint(value); }
  private static float[] tiles(float start, float extent, float size, float initial, BackgroundRepeatKeyword repeat) {
    int count = 1; float spacing = 0;
    if (repeat == BackgroundRepeatKeyword.Space) {
      float available = extent - size * 2, rounded = round(size);
      if (rounded > 0 && (available > 0 || equal(available, 0))) { int middle = (int)Math.floor(round(available)/rounded); float free = available - middle*size; count = middle+2; spacing = free/(count-1); initial = start; }
    } else if (repeat == BackgroundRepeatKeyword.Round || repeat == BackgroundRepeatKeyword.Repeat) {
      float rounded = round(size);
      if (rounded > 0) { int before = (int)Math.ceil(round(initial)/rounded), after = (int)Math.ceil(round(extent-initial)/rounded); count = before+after; initial -= before*size; }
    }
    return new float[] {initial, spacing, count};
  }
  private static PointF intersection(double left, double top, double right, double bottom, double startX, double startY, double endX, double endY) {
    PointF result = new PointF((float)endX, (float)endY);
    double centerX = (left+right)/2, centerY = (top+bottom)/2;
    startX -= centerX; startY -= centerY; endX -= centerX; endY -= centerY;
    double a = Math.abs(right-left)/2, b = Math.abs(bottom-top)/2, m = (endY-startY)/(endX-startX), c = startY-m*startX;
    double A = b*b+a*a*m*m, B = 2*a*a*c*m, C = a*a*(c*c-b*b);
    double determinant = Math.sqrt(-C/A+Math.pow(B/(2*A), 2));
    double x = -B/(2*A)-determinant, y = m*x+c; x += centerX; y += centerY;
    if (!Double.isNaN(x) && !Double.isNaN(y)) result.set((float)x, (float)y);
    return result;
  }
}
