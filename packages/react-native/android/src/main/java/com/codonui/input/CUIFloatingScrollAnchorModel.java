package com.codonui.input;

final class CUIFloatingScrollAnchorModel {
  static final class Anchor {
    final boolean bottom;
    final double offset;
    Anchor(boolean bottom, double offset) { this.bottom = bottom; this.offset = offset; }
  }
  static Anchor capture(double focusTop, double focusBottom, double viewportTop, double viewportBottom) {
    if (!Double.isFinite(focusTop) || !Double.isFinite(focusBottom) || !Double.isFinite(viewportTop) || !Double.isFinite(viewportBottom) || focusBottom < focusTop || viewportBottom < viewportTop) return null;
    boolean bottom = focusTop - viewportTop > (viewportBottom - viewportTop) / 2;
    double offset = bottom ? focusBottom - viewportBottom : focusTop - viewportTop;
    return Double.isFinite(offset) ? new Anchor(bottom, offset) : null;
  }
  static Double restore(Anchor anchor, double focusTop, double focusBottom, double viewportTop, double viewportBottom, double current, double minimum, double maximum) {
    if (anchor == null || capture(focusTop, focusBottom, viewportTop, viewportBottom) == null || !Double.isFinite(current) || !Double.isFinite(minimum) || !Double.isFinite(maximum) || maximum < minimum) return null;
    double delta = (anchor.bottom ? focusBottom - viewportBottom : focusTop - viewportTop) - anchor.offset;
    if (!Double.isFinite(delta) || !Double.isFinite(current + delta)) return null;
    return delta == 0 ? current : Math.max(minimum, Math.min(maximum, current + delta));
  }
}
