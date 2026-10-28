package com.codonui.input;

import android.graphics.Rect;
import android.view.View;
import android.view.ViewGroup;
import com.facebook.proguard.annotations.DoNotStrip;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.text.ReactTextView;
import com.facebook.react.views.view.ReactViewGroup;
import java.lang.ref.WeakReference;
import java.util.ArrayList;

@DoNotStrip
final class CUIClampHost extends ReactViewGroup {
  static { System.loadLibrary("react_codegen_CodonNativeOverlay"); }
  private static native void nativePresent(String owner, double x, double y);
  private static native void nativeRetire(String owner);
  private ReadableMap plan;
  private boolean hasClamp;
  private final ArrayList<WeakReference<ReactTextView>> paragraphs = new ArrayList<>();

  CUIClampHost(ThemedReactContext context) { super(context); }
  void setHasClamp(boolean next) { hasClamp = next; setClipChildren(next); }
  void setPlan(ReadableMap next) {
    retire(); plan = next;
    invalidate();
  }
  private String owner() { return plan == null || !plan.hasKey("owner") ? "" : plan.getString("owner"); }
  private View originalView(View view, int tag) {
    if (view.getId() == tag) return view;
    if (view instanceof ViewGroup) {
      ViewGroup group = (ViewGroup)view;
      for (int index=0;index<group.getChildCount();index++) {
        View found = originalView(group.getChildAt(index), tag);
        if (found != null) return found;
      }
    }
    return null;
  }
  private void present() {
    UiThreadUtil.assertOnUiThread();
    String owner = owner();
    if (owner.isEmpty() || !isAttachedToWindow() || !hasWindowFocus()) return;
    try {
      ReadableArray projections = plan.getArray("paragraphs");
      for (int index=0;index<projections.size();index++) {
        ReadableMap projection = projections.getMap(index);
        View view = originalView(this, projection.getInt("tag"));
        if (view == null) return;
        if (!(view instanceof ReactTextView) || view.getWindowToken() != getWindowToken())
          throw new IllegalStateException("Table clamp lost its original paragraph/window");
        ReactTextView text = (ReactTextView)view;
        int lines = projection.getBoolean("noWrap") ? 1 : getScrollX() == 0 && getScrollY() == 0 ? projection.getInt("lines") : 0;
        if (!text.setCuiClamp(owner, lines, projection.getString("props"), projection.getString("state")))
          throw new IllegalStateException("Table clamp paragraph props/state changed before presentation");
        boolean retained = false;
        for (WeakReference<ReactTextView> previous : paragraphs) if (previous.get() == text) retained = true;
        if (!retained) paragraphs.add(new WeakReference<>(text));
      }
      nativePresent(owner, PixelUtil.toDIPFromPixel(getScrollX()), PixelUtil.toDIPFromPixel(getScrollY()));
    } catch (RuntimeException error) { retire(); throw error; }
  }
  void retire() {
    String owner = owner();
    if (owner.isEmpty()) return;
    for (WeakReference<ReactTextView> paragraph : paragraphs) {
      ReactTextView text = paragraph.get();
      if (text != null) text.clearCuiClamp(owner);
    }
    paragraphs.clear();
    nativeRetire(owner);
  }
  private void reveal(View child, Rect rectangle) {
    if (!hasClamp || plan == null || child.getWindowToken() != getWindowToken()) return;
    Rect target = new Rect(rectangle);
    offsetDescendantRectToMyCoords(child, target);
    target.offset(getScrollX(), getScrollY());
    double contentHeight = PixelUtil.toPixelFromDIP(plan.getDouble("contentHeight"));
    double originY = PixelUtil.toPixelFromDIP(plan.getDouble("contentOriginY"));
    int offset = getScrollY();
    if (target.height() > getHeight() || target.top < offset) offset = target.top;
    else if (target.bottom > offset + getHeight()) offset = target.bottom - getHeight();
    offset = Math.max((int)Math.floor(originY), Math.min(offset,
        (int)Math.ceil(Math.max(originY,originY+contentHeight-getHeight()))));
    double contentWidth = PixelUtil.toPixelFromDIP(plan.getDouble("contentWidth"));
    double originX = PixelUtil.toPixelFromDIP(plan.getDouble("contentOriginX"));
    int x = getScrollX();
    if (target.width() > getWidth() || target.left < x) x = target.left;
    else if (target.right > x + getWidth()) x = target.right - getWidth();
    x = Math.max((int)Math.floor(originX), Math.min(x,
        (int)Math.ceil(Math.max(originX,originX+contentWidth-getWidth()))));
    scrollTo(x,offset);
    present();
  }
  @Override public void requestChildFocus(View child, View focused) {
    super.requestChildFocus(child, focused);
    if (focused != null) reveal(focused, new Rect(0,0,focused.getWidth(),focused.getHeight()));
  }
  @Override public boolean requestChildRectangleOnScreen(View child, Rect rectangle, boolean immediate) {
    int before = getScrollY(), beforeX = getScrollX();
    reveal(child, rectangle);
    return before != getScrollY() || beforeX != getScrollX() || super.requestChildRectangleOnScreen(child,rectangle,immediate);
  }
  @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
    super.onLayout(changed,left,top,right,bottom);
    View focused = findFocus();
    if (focused != null && focused != this) reveal(focused,new Rect(0,0,focused.getWidth(),focused.getHeight()));
    present();
  }
  @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); present(); }
  @Override protected void onDetachedFromWindow() { retire(); super.onDetachedFromWindow(); }
  @Override public void onWindowFocusChanged(boolean active) {
    super.onWindowFocusChanged(active);
    if (active) present(); else retire();
  }
  void recycleClamp() { retire(); plan = null; hasClamp = false; scrollTo(0,0); }
}
