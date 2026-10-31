package com.codonui.input;

import android.content.Context;
import android.graphics.Rect;
import android.view.MotionEvent;
import android.view.View;
import com.facebook.react.views.view.ReactViewGroup;
import java.util.ArrayList;

class CUICollectionNode extends ReactViewGroup {
  String ownerId = "", rootId = "", descriptorId = "", descriptorRevision = "";

  CUICollectionNode(Context context) { super(context); enforceMetadata(); }

  final void enforceMetadata() {
    setAlpha(0); setFocusable(false); setFocusableInTouchMode(false); setClickable(false); setLongClickable(false);
    setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    setRemoveClippedSubviews(false);
  }

  final boolean isMetadataOnly() {
    return getAlpha() == 0 && getWidth() == 0 && getHeight() == 0 && !isFocusable() && !isClickable()
      && getImportantForAccessibility() == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS;
  }

  @Override public boolean requestFocus(int direction, Rect previous) { return false; }
  @Override public boolean dispatchTouchEvent(MotionEvent event) { return false; }
  @Override public void addChildrenForAccessibility(ArrayList<View> children) {}
}
