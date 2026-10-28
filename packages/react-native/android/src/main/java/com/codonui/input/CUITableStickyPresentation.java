package com.codonui.input;

import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.ViewTreeObserver;
import android.widget.HorizontalScrollView;
import android.widget.ScrollView;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.UiThreadUtil;
import com.facebook.react.fabric.FabricUIManager;
import com.facebook.react.uimanager.IllegalViewOperationException;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.HashSet;
import org.json.JSONArray;
import org.json.JSONObject;

final class CUITableStickyPresentation implements ViewTreeObserver.OnPreDrawListener, LifecycleEventListener {
  private static final class Attachment {
    final WeakReference<View> target, root, window;
    final Object token;
    Attachment(View target, View root) {
      this.target = new WeakReference<>(target); this.root = new WeakReference<>(root);
      this.window = new WeakReference<>(target.getRootView()); token = target.getWindowToken();
    }
  }
  private final CUIMotionSnapshotModule owner;
  private final ReactApplicationContext context;
  private final FabricUIManager manager;
  private final HashMap<String, Attachment> attachments = new HashMap<>();
  private final HashSet<ViewTreeObserver> observers = new HashSet<>();
  private boolean valid = true, ticking, suspended;

  CUITableStickyPresentation(CUIMotionSnapshotModule owner, ReactApplicationContext context, FabricUIManager manager) {
    UiThreadUtil.assertOnUiThread();
    this.owner = owner; this.context = context; this.manager = manager;
    context.addLifecycleEventListener(this);
  }
  private static double[] box(View view) {
    double x = 0, y = 0;
    View current = view;
    while (current != null) {
      x += current.getLeft(); y += current.getTop();
      ViewParent parent = current.getParent();
      if (!(parent instanceof View)) break;
      View next = (View)parent;
      x -= next.getScrollX(); y -= next.getScrollY(); current = next;
    }
    return new double[] {x, y, view.getWidth(), view.getHeight()};
  }
  private static boolean isScroll(View view) { return view instanceof ScrollView || view instanceof HorizontalScrollView; }
  private View resolve(int tag) {
    try { return manager.resolveView(tag); }
    catch (IllegalViewOperationException pending) { return null; }
  }
  private static boolean descendant(View target, View root) {
    for (View current = target; current != null;) {
      if (current == root) return true;
      ViewParent parent = current.getParent(); current = parent instanceof View ? (View)parent : null;
    }
    return false;
  }
  void synchronize() {
    UiThreadUtil.assertOnUiThread();
    if (!valid || ticking || suspended) return;
    ticking = true;
    try {
      owner.tableStickySynchronize();
      JSONArray targets = new JSONArray(owner.tableStickyTargets());
      HashSet<String> retained = new HashSet<>();
      HashSet<ViewTreeObserver> currentObservers = new HashSet<>();
      for (int index = 0; index < targets.length(); index++) {
        JSONObject entry = targets.getJSONObject(index);
        String lease = entry.getString("lease"); retained.add(lease);
        View target = resolve(entry.getInt("target")), root = resolve(entry.getInt("containingRoot"));
        Attachment attachment = attachments.get(lease);
        if (target == null || root == null || !target.isAttachedToWindow() || !root.isAttachedToWindow()) {
          if (attachment != null) { owner.tableStickyRetire(lease); attachments.remove(lease); }
          continue;
        }
        if (target.getWindowToken() != root.getWindowToken() || target.getRootView() != root.getRootView() || !descendant(target, root) ||
            (attachment != null && (attachment.target.get() != target || attachment.root.get() != root ||
                attachment.window.get() != target.getRootView() || attachment.token != target.getWindowToken()))) {
          owner.tableStickyRetire(lease); attachments.remove(lease); continue;
        }
        if (attachment == null) { attachment = new Attachment(target, root); attachments.put(lease, attachment); }
        ViewTreeObserver observer = target.getRootView().getViewTreeObserver();
        if (observer.isAlive()) currentObservers.add(observer);
        View nearest = null;
        CUIKeyboardScope scope = null;
        boolean reachedRoot = false, visible = target.getVisibility() == View.VISIBLE;
        double belowX = 0, belowY = 0;
        for (ViewParent parent = target.getParent(); parent instanceof View; parent = parent.getParent()) {
          View ancestor = (View)parent;
          if (ancestor.getVisibility() != View.VISIBLE) visible = false;
          if (scope == null && ancestor instanceof CUIKeyboardScope) scope = (CUIKeyboardScope)ancestor;
          if (isScroll(ancestor)) {
            if (nearest == null) nearest = ancestor;
            if (!reachedRoot) { belowX += ancestor.getScrollX(); belowY += ancestor.getScrollY(); }
          }
          if (ancestor == root) reachedRoot = true;
        }
        if (!visible) continue;
        if (!target.hasWindowFocus()) { owner.tableStickyRetire(lease); continue; }
        if (!entry.isNull("session")) {
          JSONObject expected = entry.getJSONObject("session");
          if (scope == null || !scope.menuPointerOwnerId().equals(expected.getString("scopeOwnerId")) ||
              !CUIInputWindow.identity(scope).equals(expected.getString("windowId")) || scope.menuPointerEpoch() != expected.getDouble("epoch")) {
            owner.tableStickyRetire(lease); continue;
          }
        }
        double[] table = box(root), viewport = box(nearest == null ? target.getRootView() : nearest);
        if (nearest instanceof ViewGroup && ((ViewGroup)nearest).getClipToPadding()) {
          viewport[0] += nearest.getPaddingLeft(); viewport[1] += nearest.getPaddingTop();
          viewport[2] -= nearest.getPaddingLeft() + nearest.getPaddingRight();
          viewport[3] -= nearest.getPaddingTop() + nearest.getPaddingBottom();
        }
        double density = target.getResources().getDisplayMetrics().density;
        owner.tableStickyFrame(lease, new double[] {table[0] / density, table[1] / density,
            viewport[0] / density, viewport[1] / density, Math.max(0, viewport[2]) / density,
            Math.max(0, viewport[3]) / density, belowX / density, belowY / density});
      }
      attachments.keySet().retainAll(retained);
      for (ViewTreeObserver observer : observers) if (!currentObservers.contains(observer) && observer.isAlive()) observer.removeOnPreDrawListener(this);
      for (ViewTreeObserver observer : currentObservers) if (!observers.contains(observer)) observer.addOnPreDrawListener(this);
      observers.clear(); observers.addAll(currentObservers);
    } catch (Exception failure) {
      owner.tableStickyFailure(failure);
      retireTargets();
      invalidate();
    } finally { ticking = false; }
  }
  @Override public boolean onPreDraw() { synchronize(); return true; }
  @Override public void onHostPause() {
    if (!valid) return;
    suspended = true;
    boolean wasTicking = ticking;
    ticking = true;
    retireTargets();
    ticking = wasTicking;
    for (ViewTreeObserver observer : observers) if (observer.isAlive()) observer.removeOnPreDrawListener(this);
    observers.clear(); attachments.clear();
  }
  private void retireTargets() {
    try {
      JSONArray targets = new JSONArray(owner.tableStickyTargets());
      for (int index = 0; index < targets.length(); index++) owner.tableStickyRetire(targets.getJSONObject(index).getString("lease"));
    } catch (Exception failure) { owner.tableStickyFailure(failure); }
  }
  @Override public void onHostResume() { suspended = false; synchronize(); }
  @Override public void onHostDestroy() { onHostPause(); }
  void invalidate() {
    UiThreadUtil.assertOnUiThread();
    valid = false;
    for (ViewTreeObserver observer : observers) if (observer.isAlive()) observer.removeOnPreDrawListener(this);
    observers.clear(); attachments.clear(); context.removeLifecycleEventListener(this);
  }
}
