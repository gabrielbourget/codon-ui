package com.codonui.input;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUICollectionRootManagerDelegate;
import com.facebook.react.viewmanagers.CUICollectionRootManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@ReactModule(name = CUICollectionRootManager.NAME)
public final class CUICollectionRootManager extends ReactViewManager implements CUICollectionRootManagerInterface<ReactViewGroup> {
  static final String NAME = "CUICollectionRoot";
  private final ViewManagerDelegate<ReactViewGroup> inherited = new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUICollectionRootManagerDelegate<ReactViewGroup, CUICollectionRootManager> delegate = new CUICollectionRootManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view, String name, Object value) {
      if ("ownerId".equals(name) || "rootId".equals(name) || "rootRevision".equals(name) || "inspectionRequest".equals(name)) super.setProperty(view, name, value);
      else inherited.setProperty(view, name, value);
    }
  };
  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUICollectionRoot(context); }
  @Override @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) { ((CUICollectionRoot)view).ownerId = value == null ? "" : value; }
  @Override @ReactProp(name = "rootId") public void setRootId(ReactViewGroup view, String value) { ((CUICollectionRoot)view).rootId = value == null ? "" : value; }
  @Override @ReactProp(name = "rootRevision") public void setRootRevision(ReactViewGroup view, String value) { ((CUICollectionRoot)view).rootRevision = value == null ? "" : value; }
  @Override @ReactProp(name = "inspectionRequest") public void setInspectionRequest(ReactViewGroup view, String value) { ((CUICollectionRoot)view).inspectionRequest = value == null ? "" : value; }
  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) { super.onAfterUpdateTransaction(view); ((CUICollectionRoot)view).enforceMetadata(); }
  @Override public void onDropViewInstance(ReactViewGroup view) { ((CUICollectionRoot)view).retire(); super.onDropViewInstance(view); }
  @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> events = new HashMap<>(); Map<String, Object> inherited = super.getExportedCustomDirectEventTypeConstants();
    if (inherited != null) events.putAll(inherited);
    events.put("topNativeCollectionCommit", Collections.singletonMap("registrationName", "onNativeCollectionCommit"));
    events.put("topNativeCollectionInspection", Collections.singletonMap("registrationName", "onNativeCollectionInspection")); return events;
  }
}
