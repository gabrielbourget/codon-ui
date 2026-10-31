package com.codonui.input;

import android.graphics.Matrix;
import android.graphics.RectF;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.ViewTreeObserver;
import android.widget.ScrollView;
import com.facebook.react.views.scroll.ReactScrollView;
import java.lang.ref.WeakReference;

final class CUIFloatingScrollAnchor implements ViewTreeObserver.OnPreDrawListener, ViewTreeObserver.OnGlobalFocusChangeListener {
  private final View root;
  private int tag;
  private String key = "";
  private String revision = "";
  private WeakReference<View> focus = new WeakReference<>(null);
  private WeakReference<ScrollView> scroll = new WeakReference<>(null);
  private ViewTreeObserver observer;
  private CUIFloatingScrollAnchorModel.Anchor anchor;
  private int offsetX;
  private int offsetY;
  private long inputRevision;
  private Object window;

  CUIFloatingScrollAnchor(View root) { this.root = root; }
  private boolean moving(ScrollView view) {
    return CUIInputWindow.pointerActive(root) || CUIInputWindow.dispatchingPointer(root) || (view instanceof ReactScrollView && (((ReactScrollView) view).getFlingAnimator().isRunning() || !((ReactScrollView) view).getReactScrollViewScrollState().isFinished()));
  }
  private boolean contains(View parent, View child) {
    for (View view = child; view != null;) {
      if (view == parent) return true;
      ViewParent next = view.getParent(); view = next instanceof View ? (View) next : null;
    }
    return false;
  }
  private RectF bounds(View target) {
    Matrix transform = new Matrix(target.getMatrix());
    for (View view = target;;) {
      ViewParent candidate = view.getParent();
      View parent = candidate instanceof View ? (View) candidate : null;
      transform.postTranslate(view.getLeft() - (parent == null ? 0 : parent.getScrollX()), view.getTop() - (parent == null ? 0 : parent.getScrollY()));
      if (parent == null) break;
      transform.postConcat(parent.getMatrix()); view = parent;
    }
    RectF rect = new RectF(0, 0, target.getWidth(), target.getHeight()); transform.mapRect(rect); return rect;
  }
  private int maximum(ScrollView view) {
    int content = view.getChildCount() == 0 ? 0 : view.getChildAt(0).getHeight();
    return Math.max(0, content - view.getHeight() + view.getPaddingTop() + view.getPaddingBottom());
  }
  private boolean current() {
    View focused = focus.get(); ScrollView owner = scroll.get();
    if (anchor == null || focused == null || owner == null || !root.isAttachedToWindow() || !root.hasWindowFocus() || root.getWindowToken() != window || root.getRootView().findFocus() != focused || root.getRootView().findViewById(tag) != owner || !contains(owner, focused) || CUIInputWindow.revision(root) != inputRevision || moving(owner)) return false;
    int clamped = Math.max(0, Math.min(maximum(owner), offsetY));
    return owner.getScrollX() == offsetX && (owner.getScrollY() == offsetY || owner.getScrollY() == clamped);
  }
  void prepare(int nextTag, String nextKey, String nextRevision) {
    if (nextKey == null) nextKey = ""; if (nextRevision == null) nextRevision = "";
    boolean replaced = tag != nextTag || !key.equals(nextKey);
    boolean repositioned = !revision.equals(nextRevision);
    if (replaced) invalidate();
    tag = nextTag; key = nextKey; revision = nextRevision;
    if (tag <= 0 || !repositioned) return;
    if (!replaced && current()) return;
    invalidate();
    if (!root.isAttachedToWindow() || !root.hasWindowFocus()) return;
    View candidate = root.getRootView().findViewById(tag), focused = root.getRootView().findFocus();
    if (!(candidate instanceof ScrollView) || focused == null || !contains(candidate, focused)) return;
    ScrollView owner = (ScrollView) candidate;
    if (moving(owner)) return;
    RectF field = bounds(focused), viewport = bounds(owner);
    anchor = CUIFloatingScrollAnchorModel.capture(field.top, field.bottom, viewport.top, viewport.bottom);
    if (anchor == null) return;
    focus = new WeakReference<>(focused); scroll = new WeakReference<>(owner); window = root.getWindowToken();
    offsetX = owner.getScrollX(); offsetY = owner.getScrollY(); inputRevision = CUIInputWindow.revision(root);
    observer = root.getViewTreeObserver(); observer.addOnPreDrawListener(this); observer.addOnGlobalFocusChangeListener(this);
  }
  @Override public void onGlobalFocusChanged(View previous, View next) { if (previous != next) invalidate(); }
  @Override public boolean onPreDraw() {
    if (root.isLayoutRequested()) return true;
    if (!current()) { invalidate(); return true; }
    ScrollView owner = scroll.get(); View focused = focus.get();
    RectF field = bounds(focused), viewport = bounds(owner);
    Double next = CUIFloatingScrollAnchorModel.restore(anchor, field.top, field.bottom, viewport.top, viewport.bottom, owner.getScrollY(), 0, maximum(owner));
    invalidate();
    if (next != null && Math.round(next) != owner.getScrollY()) owner.scrollTo(owner.getScrollX(), (int) Math.round(next));
    return true;
  }
  void invalidate() {
    if (observer != null && observer.isAlive()) { observer.removeOnPreDrawListener(this); observer.removeOnGlobalFocusChangeListener(this); }
    observer = null; anchor = null; focus.clear(); scroll.clear(); window = null;
  }
}
