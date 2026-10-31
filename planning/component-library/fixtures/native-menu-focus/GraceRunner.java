package com.codonui.input;

import java.util.Scanner;

/** Nonshipping runner of the production Java state machine; the oracle supplies all observations. */
public final class GraceRunner {
  public static void main(String[] arguments) {
    CUIMenuPointerGrace grace = new CUIMenuPointerGrace();
    Scanner input = new Scanner(System.in);
    double now = 10000;
    int handoffs = 0;
    boolean enabled = true;
    CUIMenuPointerGrace.Rect rectangle = null;
    while (input.hasNext()) {
      String operation = input.next();
      if (operation.equals("new")) { grace = new CUIMenuPointerGrace(); now = 10000; handoffs = 0; enabled = true; }
      else if (operation.equals("rect") || operation.equals("position")) {
        rectangle = new CUIMenuPointerGrace.Rect(input.nextDouble(), input.nextDouble(), input.nextDouble(), input.nextDouble());
        if (operation.equals("rect")) grace.setSubmenu(rectangle);
      }
      else if (operation.equals("modality")) {
        boolean pointer = input.nextInt() == 1;
        if (grace.setPointerMode(pointer) && pointer && rectangle != null) grace.activateSubmenu(rectangle);
      }
      else if (operation.equals("enabled")) {
        enabled = input.nextInt() == 1;
        if (!enabled) grace.retire(); else if (rectangle != null) grace.activateSubmenu(rectangle);
      }
      else if (operation.equals("retire")) grace.retire();
      else if (operation.equals("move")) {
        double x = input.nextDouble(), y = input.nextDouble();
        CUIMenuPointerGrace.Rect parent = new CUIMenuPointerGrace.Rect(input.nextDouble(), input.nextDouble(), input.nextDouble(), input.nextDouble());
        if (enabled) grace.move(x, y, now, parent);
      }
      else if (operation.equals("wait")) {
        double until = now + input.nextDouble();
        while (grace.deadline() >= 0 && grace.deadline() <= until) {
          now = grace.deadline(); if (grace.expire(now)) handoffs++;
        }
        now = until;
      } else if (operation.equals("read")) System.out.println((grace.suppressed() ? "1" : "0") + " " + handoffs);
      else throw new IllegalArgumentException(operation);
    }
  }
}
