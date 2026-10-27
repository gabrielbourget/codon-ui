package com.codonui.input;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUIOverlayHostManagerDelegate;
import com.facebook.react.viewmanagers.CUIOverlayHostManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

@ReactModule(name = CUIOverlayHostManager.NAME)
public final class CUIOverlayHostManager extends ReactViewManager implements CUIOverlayHostManagerInterface<ReactViewGroup> {
  static final String NAME = "CUIOverlayHost";
  private final ViewManagerDelegate<ReactViewGroup> inherited = new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUIOverlayHostManagerDelegate<ReactViewGroup, CUIOverlayHostManager> delegate = new CUIOverlayHostManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view, String name, Object value) {
      if ("paintOpacity".equals(name) || "panelPosition".equals(name) || "panelViewportHeight".equals(name) || "panelViewportWidth".equals(name) || "panelLayoutLengths".equals(name) || "establishesContainingBlock".equals(name)) super.setProperty(view, name, value);
      else inherited.setProperty(view, name, value);
    }
  };

  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUIOverlayHost(context); }
  @Override @ReactProp(name = "paintOpacity", defaultDouble = 1)
  public void setPaintOpacity(ReactViewGroup view, double value) { ((CUIOverlayHost)view).setPaintOpacity(value); }
  // Layout-only fields are consumed by the original Fabric descriptor during the native commit.
  @Override @ReactProp(name = "panelPosition") public void setPanelPosition(ReactViewGroup view, String value) {}
  @Override @ReactProp(name = "panelViewportHeight", defaultBoolean = false) public void setPanelViewportHeight(ReactViewGroup view, boolean value) {}
  @Override @ReactProp(name = "panelViewportWidth", defaultBoolean = false) public void setPanelViewportWidth(ReactViewGroup view, boolean value) {}
  @Override @ReactProp(name = "panelLayoutLengths") public void setPanelLayoutLengths(ReactViewGroup view, ReadableArray value) {}
  @Override @ReactProp(name = "establishesContainingBlock", defaultBoolean = false) public void setEstablishesContainingBlock(ReactViewGroup view, boolean value) {}
  @Override protected ReactViewGroup prepareToRecycleView(ThemedReactContext context, ReactViewGroup view) {
    ((CUIOverlayHost)view).setPaintOpacity(1);
    return super.prepareToRecycleView(context, view);
  }
}
