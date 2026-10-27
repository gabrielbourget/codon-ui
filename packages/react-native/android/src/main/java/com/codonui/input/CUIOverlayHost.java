package com.codonui.input;

import android.graphics.Canvas;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.view.ReactViewGroup;

final class CUIOverlayHost extends ReactViewGroup {
  final CUIForegroundRenderer foreground = new CUIForegroundRenderer(this, this::drawForegroundSource);
  CUIOverlayHost(ThemedReactContext context) { super(context); foreground.setEnabled(true); }
  private void drawForegroundSource(Canvas canvas) { super.draw(canvas); }
  void setPaintOpacity(double value) {
    if (!Double.isFinite(value) || value < 0 || value > 1)
      throw new IllegalArgumentException("Overlay paint opacity must be calibrated before native admission");
    foreground.setPaintOpacity((float)value);
  }
  @Override public void draw(Canvas canvas) { if (!foreground.draw(canvas)) super.draw(canvas); }
  @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); foreground.attached(); }
  @Override protected void onDetachedFromWindow() { foreground.detached(); super.onDetachedFromWindow(); }
  @Override public void onWindowFocusChanged(boolean focused) { if (!focused) foreground.detached(); else foreground.attached(); super.onWindowFocusChanged(focused); }
}
