package com.codonui.input;

import java.util.ArrayDeque;

/** Authority is scoped to the stack of original native key dispatches, never a retained event. */
final class CUIEditorKeyboardDefaultFrames {
  static final class Identity {
    final String ownerId, bindingId, bindingRevision, windowId;
    final int target;
    final long epoch;
    Identity(String ownerId, String bindingId, String bindingRevision, int target, String windowId, long epoch) {
      this.ownerId = ownerId; this.bindingId = bindingId; this.bindingRevision = bindingRevision;
      this.target = target; this.windowId = windowId; this.epoch = epoch;
    }
    boolean matches(Identity other) {
      return other != null && ownerId.equals(other.ownerId) && bindingId.equals(other.bindingId) &&
        bindingRevision.equals(other.bindingRevision) && target == other.target && windowId.equals(other.windowId) && epoch == other.epoch;
    }
    boolean valid() {
      return ownerId != null && !ownerId.isEmpty() && bindingId != null && !bindingId.isEmpty() &&
        bindingRevision != null && !bindingRevision.isEmpty() && target > 0 && windowId != null && !windowId.isEmpty() && epoch > 0;
    }
  }
  enum Disposition { ALLOWED, PREVENTED, UNACKNOWLEDGED, RETIRED }
  private static final class Frame {
    final long token, eventId;
    final Identity identity;
    final String phase;
    boolean acknowledged, current, preventDefault;
    Frame(long token, Identity identity, long eventId, String phase) {
      this.token = token; this.identity = identity; this.eventId = eventId; this.phase = phase;
    }
  }
  private final ArrayDeque<Frame> frames = new ArrayDeque<>();
  private long serial;
  synchronized long begin(Identity identity, long eventId, String phase) {
    if (identity == null || !identity.valid() || eventId <= 0 || eventId > 9007199254740991L ||
      !("down".equals(phase) || "up".equals(phase) || "cancel".equals(phase))) return 0;
    long token = ++serial;
    frames.push(new Frame(token, identity, eventId, phase));
    return token;
  }
  synchronized boolean acknowledge(Identity identity, long eventId, String phase, boolean current, boolean preventDefault) {
    Frame frame = frames.peek();
    if (frame == null || frame.acknowledged || !frame.identity.matches(identity) || frame.eventId != eventId || !frame.phase.equals(phase)) return false;
    frame.acknowledged = true;
    frame.current = current;
    frame.preventDefault = current && !"cancel".equals(phase) && preventDefault;
    return true;
  }
  synchronized Disposition end(long token, boolean originalStillCurrent) {
    Frame frame = frames.peek();
    if (frame == null || frame.token != token) return Disposition.RETIRED;
    frames.pop();
    if (!originalStillCurrent || (frame.acknowledged && !frame.current)) return Disposition.RETIRED;
    if (!frame.acknowledged) return Disposition.UNACKNOWLEDGED;
    return frame.preventDefault ? Disposition.PREVENTED : Disposition.ALLOWED;
  }
  synchronized void retire() { frames.clear(); }
}
