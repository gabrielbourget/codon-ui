package com.codonui.input;

import android.graphics.Canvas;
import android.view.ViewGroup;

/** Selects Android's protected child traversal while retaining virtual RN drawChild/z-order. */
final class CUIMotionDrawingDispatch {
  static { System.loadLibrary("codon_motion"); }
  private CUIMotionDrawingDispatch() {}
  static native void dispatchChildren(ViewGroup host, Canvas canvas);
}
