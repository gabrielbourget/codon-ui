package com.codonui.input;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.ViewManagerPropertyUpdater;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.viewmanagers.CUIDateSegmentManagerDelegate;
import com.facebook.react.viewmanagers.CUIDateSegmentManagerInterface;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@ReactModule(name=CUIDateSegmentManager.NAME)
public final class CUIDateSegmentManager extends ReactViewManager implements CUIDateSegmentManagerInterface<ReactViewGroup> {
  static final String NAME="CUIDateSegment";
  private final ViewManagerDelegate<ReactViewGroup> inherited=new ViewManagerPropertyUpdater.GenericViewManagerDelegate<>(this);
  private final CUIDateSegmentManagerDelegate<ReactViewGroup,CUIDateSegmentManager> delegate=new CUIDateSegmentManagerDelegate<>(this) {
    @Override public void setProperty(ReactViewGroup view,String name,Object value) {
      if ("ownerId".equals(name)||"segmentId".equals(name)||"bindingRevision".equals(name)||"displayText".equals(name)||"locale".equals(name)||"keyboardMode".equals(name)||"segmentDisabled".equals(name)||"segmentReadOnly".equals(name)||"segmentEditable".equals(name)||"segmentPlaceholder".equals(name)) super.setProperty(view,name,value);
      else inherited.setProperty(view,name,value);
    }
  };
  @Override public String getName() { return NAME; }
  @Override protected ViewManagerDelegate<ReactViewGroup> getDelegate() { return delegate; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new CUIDateSegment(context); }
  private static String string(String value) { return value==null?"":value; }
  @Override @ReactProp(name="ownerId") public void setOwnerId(ReactViewGroup view,String value) { CUIDateSegment v=(CUIDateSegment)view;v.configureIdentity(string(value),v.segmentId,v.bindingRevision); }
  @Override @ReactProp(name="segmentId") public void setSegmentId(ReactViewGroup view,String value) { CUIDateSegment v=(CUIDateSegment)view;v.configureIdentity(v.ownerId,string(value),v.bindingRevision); }
  @Override @ReactProp(name="bindingRevision") public void setBindingRevision(ReactViewGroup view,String value) { CUIDateSegment v=(CUIDateSegment)view;v.configureIdentity(v.ownerId,v.segmentId,string(value)); }
  @Override @ReactProp(name="displayText") public void setDisplayText(ReactViewGroup view,String value) { ((CUIDateSegment)view).displayText=string(value); }
  @Override @ReactProp(name="locale") public void setLocale(ReactViewGroup view,String value) { ((CUIDateSegment)view).locale=string(value); }
  @Override @ReactProp(name="keyboardMode") public void setKeyboardMode(ReactViewGroup view,String value) { CUIDateSegment v=(CUIDateSegment)view;String next=value==null?"numeric":value;if(!v.keyboardMode.equals(next)){v.keyboardMode=next;v.traitsChanged();} }
  @Override @ReactProp(name="segmentDisabled") public void setSegmentDisabled(ReactViewGroup view,boolean value) { CUIDateSegment v=(CUIDateSegment)view;if(v.segmentDisabled!=value){v.segmentDisabled=value;v.traitsChanged();} }
  @Override @ReactProp(name="segmentReadOnly") public void setSegmentReadOnly(ReactViewGroup view,boolean value) { CUIDateSegment v=(CUIDateSegment)view;if(v.segmentReadOnly!=value){v.segmentReadOnly=value;v.traitsChanged();} }
  @Override @ReactProp(name="segmentEditable") public void setSegmentEditable(ReactViewGroup view,boolean value) { CUIDateSegment v=(CUIDateSegment)view;if(v.segmentEditable!=value){v.segmentEditable=value;v.traitsChanged();} }
  @Override @ReactProp(name="segmentPlaceholder") public void setSegmentPlaceholder(ReactViewGroup view,boolean value) { ((CUIDateSegment)view).segmentPlaceholder=value; }
  @Override protected void onAfterUpdateTransaction(ReactViewGroup view) { super.onAfterUpdateTransaction(view);((CUIDateSegment)view).mounted(); }
  @Override public void onDropViewInstance(ReactViewGroup view) { ((CUIDateSegment)view).retire();super.onDropViewInstance(view); }
  @Override public void requestSegmentFocus(ReactViewGroup view,String owner,String segment,String revision,String window,double epoch) { ((CUIDateSegment)view).requestSegmentFocus(owner,segment,revision,window,epoch); }
  @Override public void requestSegmentBlur(ReactViewGroup view,String owner,String segment,String revision,String window,double epoch) { ((CUIDateSegment)view).requestSegmentBlur(owner,segment,revision,window,epoch); }
  @Override public void receiveCommand(ReactViewGroup view,String command,ReadableArray args) {
    if("requestSegmentFocus".equals(command)||"requestSegmentBlur".equals(command)) delegate.receiveCommand(view,command,args); else super.receiveCommand(view,command,args);
  }
  @Override public Map<String,Object> getExportedCustomDirectEventTypeConstants() {
    Map<String,Object> events=new HashMap<>();Map<String,Object> parent=super.getExportedCustomDirectEventTypeConstants();if(parent!=null)events.putAll(parent);
    events.put("topNativeSegmentInput",Collections.singletonMap("registrationName","onNativeSegmentInput"));return events;
  }
}
