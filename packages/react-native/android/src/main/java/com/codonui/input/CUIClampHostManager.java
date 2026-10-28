package com.codonui.input;

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ReactStylesDiffMap;
import com.facebook.react.uimanager.StateWrapper;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

@ReactModule(name = CUIClampHostManager.NAME)
public final class CUIClampHostManager extends ReactViewManager {
  static final String NAME = "CUIClampHost";
  @Override public String getName() { return NAME; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUIClampHost(context); }
  @Override public Object updateState(ReactViewGroup view, ReactStylesDiffMap props, StateWrapper state) {
    ReadableMap plan = state.getStateData();
    ((CUIClampHost)view).setPlan(plan);
    return null;
  }
  @ReactProp(name = "hasClamp") public void setHasClamp(ReactViewGroup view, boolean value) { ((CUIClampHost)view).setHasClamp(value); }
  @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) {}
  @ReactProp(name = "windowId") public void setWindowId(ReactViewGroup view, String value) {}
  @ReactProp(name = "epoch") public void setEpoch(ReactViewGroup view, String value) {}
  @ReactProp(name = "maximumLines") public void setMaximumLines(ReactViewGroup view, double value) {}
  @ReactProp(name = "noWrap") public void setNoWrap(ReactViewGroup view, boolean value) {}
  @Override public void onDropViewInstance(ReactViewGroup view) { ((CUIClampHost)view).recycleClamp(); super.onDropViewInstance(view); }
  @Override protected ReactViewGroup prepareToRecycleView(ThemedReactContext context, ReactViewGroup view) {
    ((CUIClampHost)view).recycleClamp();
    return super.prepareToRecycleView(context,view);
  }
}
