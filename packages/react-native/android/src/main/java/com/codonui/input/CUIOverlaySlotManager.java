package com.codonui.input;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

@ReactModule(name = CUIOverlaySlotManager.NAME)
public final class CUIOverlaySlotManager extends ReactViewManager {
  static final String NAME = "CUIOverlaySlot";
  @Override public String getName() { return NAME; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new ReactViewGroup(context); }
  @ReactProp(name = "slotRole") public void setSlotRole(ReactViewGroup view, String value) {}
}
