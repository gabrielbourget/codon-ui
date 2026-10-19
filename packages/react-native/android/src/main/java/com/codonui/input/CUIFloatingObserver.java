package com.codonui.input;

import android.graphics.Rect;
import android.view.View;
import android.view.ViewParent;
import android.view.ViewTreeObserver;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.PixelUtil;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

final class CUIFloatingObserver implements ViewTreeObserver.OnPreDrawListener {
  static final class Target {
    final String id;
    final int tag;
    final int descriptionTag;
    Target(String id, int tag, int descriptionTag) { this.id = id; this.tag = tag; this.descriptionTag = descriptionTag; }
  }
  private static final class Sample {
    WeakReference<View> anchor;
    List<WeakReference<View>> ancestors = new ArrayList<>();
    List<Integer> offsets = new ArrayList<>();
    Rect visible;
    int revision;
  }
  private final View host;
  private final Consumer<WritableMap> publish;
  private final Map<String, Sample> samples = new HashMap<>();
  private final Map<String, CUINativeDescription> descriptions = new HashMap<>();
  private List<Target> targets = new ArrayList<>();
  private ViewTreeObserver observer;
  private long revision;
  CUIFloatingObserver(View host, Consumer<WritableMap> publish) { this.host = host; this.publish = publish; }
  void update(List<Target> next, boolean active) {
    targets = next;
    samples.keySet().removeIf(id -> next.stream().noneMatch(target -> target.id.equals(id)));
    descriptions.entrySet().removeIf(entry -> {
      if (next.stream().anyMatch(target -> target.id.equals(entry.getKey()) && target.descriptionTag > 0)) return false;
      entry.getValue().invalidate(); return true;
    });
    if (!active || next.isEmpty() || !host.isAttachedToWindow()) { stop(); return; }
    if (observer == null || !observer.isAlive()) {
      observer = host.getViewTreeObserver(); observer.addOnPreDrawListener(this);
      host.postInvalidateOnAnimation();
    }
    host.postInvalidateOnAnimation();
  }
  void stop() {
    if (observer != null && observer.isAlive()) observer.removeOnPreDrawListener(this);
    observer = null;
    for (Sample sample : samples.values()) { sample.ancestors.clear(); sample.offsets.clear(); sample.visible = null; }
    for (CUINativeDescription binding : descriptions.values()) binding.invalidate();
    descriptions.clear();
  }
  @Override public boolean onPreDraw() {
    if (!host.isAttachedToWindow() || !host.hasWindowFocus()) return true;
    View root = host.getRootView();
    Rect visible = new Rect(); root.getWindowVisibleDisplayFrame(visible);
    int[] rootLocation = new int[2]; root.getLocationOnScreen(rootLocation);
    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(root);
    if (insets != null && insets.isVisible(WindowInsetsCompat.Type.ime())) {
      Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
      visible.bottom = Math.min(visible.bottom, rootLocation[1] + root.getHeight() - ime.bottom);
    }
    int[] location = new int[2]; host.getLocationOnScreen(location);
    Rect hostFrame = new Rect(location[0], location[1], location[0] + host.getWidth(), location[1] + host.getHeight());
    if (!visible.intersect(hostFrame)) visible.set(hostFrame.left, hostFrame.top, hostFrame.left, hostFrame.top);
    visible.offset(-location[0], -location[1]);
    for (Target target : targets) {
      View anchor = target.tag > 0 ? root.findViewById(target.tag) : null;
      if (anchor == null || !anchor.isAttachedToWindow() || anchor.getWindowToken() != host.getWindowToken()) {
        samples.remove(target.id); CUINativeDescription retired = descriptions.remove(target.id); if (retired != null) retired.invalidate(); continue;
      }
      View description = target.descriptionTag > 0 ? root.findViewById(target.descriptionTag) : null;
      if (description != null) {
        CUINativeDescription binding = descriptions.get(target.id);
        if (binding == null) { binding = new CUINativeDescription(); descriptions.put(target.id, binding); }
        binding.bind(anchor, description);
      } else { CUINativeDescription retired = descriptions.remove(target.id); if (retired != null) retired.invalidate(); }
      Sample sample = samples.get(target.id);
      if (sample == null || sample.anchor.get() != anchor) { sample = new Sample(); sample.anchor = new WeakReference<>(anchor); samples.put(target.id, sample); }
      List<WeakReference<View>> ancestors = new ArrayList<>(); List<Integer> offsets = new ArrayList<>();
      for (ViewParent parent = anchor.getParent(); parent instanceof View; parent = parent.getParent()) {
        View view = (View) parent;
        ancestors.add(new WeakReference<>(view)); offsets.add(view.getScrollX()); offsets.add(view.getScrollY());
      }
      boolean sameAncestors = ancestors.size() == sample.ancestors.size();
      if (sameAncestors) for (int index = 0; index < ancestors.size(); index++) if (ancestors.get(index).get() != sample.ancestors.get(index).get()) { sameAncestors = false; break; }
      boolean scrolled = sameAncestors && !sample.offsets.equals(offsets);
      if (scrolled) sample.revision++;
      sample.ancestors = ancestors; sample.offsets = offsets;
      if (scrolled || !visible.equals(sample.visible)) {
        sample.visible = new Rect(visible);
        WritableMap data = Arguments.createMap(); data.putString("id", target.id); data.putInt("targetTag", target.tag);
        data.putDouble("x", PixelUtil.toDIPFromPixel(visible.left)); data.putDouble("y", PixelUtil.toDIPFromPixel(visible.top));
        data.putDouble("width", PixelUtil.toDIPFromPixel(visible.width())); data.putDouble("height", PixelUtil.toDIPFromPixel(visible.height()));
        data.putDouble("scrollRevision", sample.revision); data.putDouble("revision", ++revision); publish.accept(data);
      }
    }
    return true;
  }
}
