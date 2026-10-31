package com.codonui.input;

import android.view.View;
import android.view.ViewGroup;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import com.facebook.react.uimanager.ReactAccessibilityProjection;
import com.facebook.react.uimanager.TouchTargetHelper;
import android.view.MotionEvent;
import com.facebook.react.views.view.ReactViewGroup;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.WeakHashMap;

/** Cooperative producers call these functions after original node/child metadata, before return.
 * Original virtual ids, values, selection, actions and default callbacks stay producer-owned. */
public final class CUIVirtualDragAccessibility {
  public interface Source {
    boolean appliesVirtualDragAccessibilityProjection();
    View originalViewForAccessibilityNode(AccessibilityNodeInfoCompat original);
  }
  private static final WeakHashMap<View,WeakReference<Source>> sources=new WeakHashMap<>();
  private static final ReactAccessibilityProjection.Receiver receiver=new ReactAccessibilityProjection.Receiver() {
    @Override public int mode(View view) {
      CUIVirtualDragFocus owner=owner(view);
      return owner==null?ReactAccessibilityProjection.ORIGINAL:owner.accessibilityMode(view);
    }
    @Override public void projectChildren(View host,ArrayList<View> children,int start) {
      CUIVirtualDragFocus owner=owner(host); if (owner==null) return;
      if (start<0 || start>children.size()) throw new IllegalArgumentException("Original accessibility child range required");
      for (int index=children.size()-1;index>=start;index--)
        if (owner.accessibilityMode(children.get(index))==ReactAccessibilityProjection.EXCLUDED) children.remove(index);
      // A grouping parent can omit physical children. Traverse its original children in their
      // authored order only when no explicit accessibility order replaces that traversal.
      if (children.size()==start && owner.accessibilityMode(host)==ReactAccessibilityProjection.TRAVERSE && host instanceof ViewGroup) {
        if (host instanceof ReactViewGroup && ((ReactViewGroup)host).getAxOrderList()!=null) {
          owner.rejectAccessibilityProjection("native-virtual-accessibility-authored-order-excludes-target"); return;
        }
        ViewGroup group=(ViewGroup)host;
        for (int index=0;index<group.getChildCount();index++) {
          View child=group.getChildAt(index);
          if (owner.accessibilityMode(child)!=ReactAccessibilityProjection.EXCLUDED) children.add(child);
        }
      }
    }
  };
  private CUIVirtualDragAccessibility() {}
  static CUIVirtualDragFocus owner(View view) {
    CUIVirtualDragFocus found=null;
    for (CUIKeyboardScope scope:CUIInputWindow.scopes(view)) if (scope.dragInteractions.virtualFocus.active()) {
      CUIVirtualDragFocus candidate=scope.dragInteractions.virtualFocus;
      if (found!=null && found!=candidate) {
        found.rejectAccessibilityProjection("native-virtual-accessibility-owners-ambiguous");
        candidate.rejectAccessibilityProjection("native-virtual-accessibility-owners-ambiguous");
      }
      found=candidate;
    }
    return found;
  }
  static void install() {
    if (!ReactAccessibilityProjection.register(receiver)) throw new IllegalStateException("Native accessibility projection receiver already owned");
  }
  public static void registerSource(View view,Source source) {
    if (view==null || source==null || !source.appliesVirtualDragAccessibilityProjection())
      throw new IllegalArgumentException("Complete native accessibility source required");
    Source previous=source(view);
    if (previous!=null && previous!=source) throw new IllegalStateException("Original native accessibility source already owned");
    sources.put(view,new WeakReference<>(source)); install();
  }
  public static void unregisterSource(View view,Source source) { if (source(view)==source) sources.remove(view); }
  private static Source source(View view) {
    WeakReference<Source> reference=sources.get(view); Source value=reference==null?null:reference.get();
    return value!=null && value.appliesVirtualDragAccessibilityProjection()?value:null;
  }
  static boolean supports(View view) {
    if (source(view)!=null) return true;
    String name=view.getClass().getName();
    return name.equals("com.facebook.react.views.view.ReactViewGroup") ||
      name.equals("com.facebook.react.views.text.ReactTextView") ||
      name.equals("com.facebook.react.views.text.PreparedLayoutTextView") ||
      name.equals("com.facebook.react.views.textinput.ReactEditText");
  }
  public static void projectNode(View host,AccessibilityNodeInfoCompat original) {
    Source source=source(host);
    View owner=source==null?host:source.originalViewForAccessibilityNode(original);
    if (owner==null || owner.getRootView()!=host.getRootView() || !contains(host,owner)) {
      CUIVirtualDragFocus focus=owner(host);
      if (focus!=null) focus.rejectAccessibilityProjection("native-virtual-accessibility-original-node-unregistered");
      original.setVisibleToUser(false); return;
    }
    ReactAccessibilityProjection.projectNode(owner,original);
  }
  public static void projectChildren(View host,ArrayList<View> original,int start) { ReactAccessibilityProjection.projectChildren(host,original,start); }
  public static boolean allowsInteraction(View view) {
    CUIVirtualDragFocus owner=owner(view); return owner==null || owner.allowsInteraction(view);
  }
  static boolean allowsPointer(CUIKeyboardScope scope,MotionEvent event) {
    CUIVirtualDragFocus owner=owner(scope); if (owner==null) return true;
    for (TouchTargetHelper.ViewTarget target:TouchTargetHelper.findTargetPathAndCoordinatesForTouch(event.getX(),event.getY(),scope,new float[2])) {
      View view=scope.dragInteractions.resolveFocusTarget(target.getViewId());
      if (view==null) continue;
      if (owner.allowsInteraction(view)) return true;
      if (view.isClickable() || view.isFocusable() || view instanceof android.widget.EditText) return false;
    }
    return false;
  }
  private static boolean contains(View parent,View child) {
    for (View view=child;view!=null;view=view.getParent() instanceof View?(View)view.getParent():null) if (view==parent) return true;
    return false;
  }
}
