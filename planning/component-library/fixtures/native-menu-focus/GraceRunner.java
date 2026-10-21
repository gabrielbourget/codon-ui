package com.codonui.input;

import java.util.Scanner;

/** Nonshipping runner of the production Java state machine; the oracle supplies all observations. */
public final class GraceRunner {
  public static void main(String[] arguments) {
    CUIMenuPointerGrace grace = new CUIMenuPointerGrace();
    Scanner input = new Scanner(System.in);
    double now = 10000;
    int handoffs = 0;
    while (input.hasNext()) {
      String operation = input.next();
      if (operation.equals("new")) { grace = new CUIMenuPointerGrace(); now = 10000; handoffs = 0; }
      else if (operation.equals("rect")) grace.setSubmenu(new CUIMenuPointerGrace.Rect(input.nextDouble(), input.nextDouble(), input.nextDouble(), input.nextDouble()));
      else if (operation.equals("retire")) grace.retire();
      else if (operation.equals("move")) grace.move(input.nextDouble(), input.nextDouble(), now, new CUIMenuPointerGrace.Rect(input.nextDouble(), input.nextDouble(), input.nextDouble(), input.nextDouble()));
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
