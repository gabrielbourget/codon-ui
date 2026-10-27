package com.codonui.input;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

@ReactModule(name = CUIOverlayViewportManager.NAME)
public final class CUIOverlayViewportManager extends ReactViewManager {
  static final String NAME = "CUIOverlayViewport";
  @Override public String getName() { return NAME; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new ReactViewGroup(context); }
  @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) {}
}
