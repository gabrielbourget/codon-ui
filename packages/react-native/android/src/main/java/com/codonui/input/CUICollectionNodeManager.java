package com.codonui.input;

import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUICollectionNodeManagerDelegate;
import com.facebook.react.viewmanagers.CUICollectionNodeManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

@ReactModule(name = CUICollectionNodeManager.NAME)
public final class CUICollectionNodeManager extends ReactViewManager implements CUICollectionNodeManagerInterface<ReactViewGroup> {
  static final String NAME = "CUICollectionNode";
  private final ViewManagerDelegate<ReactViewGroup> inherited = new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUICollectionNodeManagerDelegate<ReactViewGroup, CUICollectionNodeManager> delegate = new CUICollectionNodeManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view, String name, Object value) {
      if ("ownerId".equals(name) || "rootId".equals(name) || "descriptorId".equals(name) || "descriptorRevision".equals(name)) super.setProperty(view, name, value);
      else inherited.setProperty(view, name, value);
    }
  };
  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUICollectionNode(context); }
  @Override @ReactProp(name = "ownerId") public void setOwnerId(ReactViewGroup view, String value) { ((CUICollectionNode)view).ownerId = value == null ? "" : value; }
  @Override @ReactProp(name = "rootId") public void setRootId(ReactViewGroup view, String value) { ((CUICollectionNode)view).rootId = value == null ? "" : value; }
  @Override @ReactProp(name = "descriptorId") public void setDescriptorId(ReactViewGroup view, String value) { ((CUICollectionNode)view).descriptorId = value == null ? "" : value; }
  @Override @ReactProp(name = "descriptorRevision") public void setDescriptorRevision(ReactViewGroup view, String value) { ((CUICollectionNode)view).descriptorRevision = value == null ? "" : value; }
  @Override public void onDropViewInstance(ReactViewGroup view) {
    CUICollectionNode node = (CUICollectionNode)view; node.ownerId = ""; node.rootId = ""; node.descriptorId = ""; node.descriptorRevision = ""; super.onDropViewInstance(view);
  }
  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) { super.onAfterUpdateTransaction(view); ((CUICollectionNode)view).enforceMetadata(); }
}
