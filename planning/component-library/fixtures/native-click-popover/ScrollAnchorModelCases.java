package com.codonui.input;

import java.util.Locale;
import java.util.Scanner;

final class ScrollAnchorModelCases {
  public static void main(String[] arguments) {
    Scanner input = new Scanner(System.in).useLocale(Locale.ROOT);
    while (input.hasNextDouble()) {
      double a = input.nextDouble(), b = input.nextDouble(), c = input.nextDouble(), d = input.nextDouble();
      double e = input.nextDouble(), f = input.nextDouble(), g = input.nextDouble(), h = input.nextDouble();
      double current = input.nextDouble(), minimum = input.nextDouble(), maximum = input.nextDouble();
      CUIFloatingScrollAnchorModel.Anchor anchor = CUIFloatingScrollAnchorModel.capture(a, b, c, d);
      Double next = CUIFloatingScrollAnchorModel.restore(anchor, e, f, g, h, current, minimum, maximum);
      if (next == null) throw new AssertionError("Unexpected invalid geometry");
      System.out.println(next);
    }
    if (CUIFloatingScrollAnchorModel.capture(0, -1, 0, 100) != null || CUIFloatingScrollAnchorModel.capture(0, 1, Double.NaN, 100) != null) throw new AssertionError("Invalid geometry admitted");
  }
}
