package com.codonui.input;

import android.graphics.Canvas;
import android.graphics.Rect;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.view.ReactViewGroup;

final class CUIOverlayHost extends ReactViewGroup {
  private double paintOpacity = 1;
  private final Rect paintCoverage = new Rect();

  CUIOverlayHost(ThemedReactContext context) { super(context); }

  void setPaintOpacity(double value) {
    if (!Double.isFinite(value) || value < 0 || value > 1)
      throw new IllegalArgumentException("Overlay paint opacity must be calibrated before native admission");
    if (paintOpacity == value) return;
    paintOpacity = value;
    invalidate();
  }

  @Override public void draw(Canvas canvas) {
    if (paintOpacity == 1) { super.draw(canvas); return; }
    canvas.getClipBounds(paintCoverage);
    int saved = canvas.saveLayerAlpha(paintCoverage.left, paintCoverage.top,
        paintCoverage.right, paintCoverage.bottom, (int)Math.round(paintOpacity * 255));
    try { super.draw(canvas); }
    finally { canvas.restoreToCount(saved); }
  }
}
