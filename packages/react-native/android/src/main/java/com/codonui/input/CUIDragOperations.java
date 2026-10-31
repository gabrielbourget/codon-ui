package com.codonui.input;

final class CUIDragOperations {
  private CUIDragOperations() {}
  // Android's boolean result authenticates no foreign move/link. Only the
  // admitted live local source can supply those original business operations.
  static String completed(boolean nativeResult, boolean localAttempted, boolean localAccepted,
      String selected, boolean selectedAllowed, boolean exportedCopy) {
    if (!nativeResult) return "cancel";
    if (localAttempted) {
      boolean known = "copy".equals(selected) || "move".equals(selected) || "link".equals(selected);
      return localAccepted && selectedAllowed && known ? selected : "cancel";
    }
    return exportedCopy ? "copy" : "cancel";
  }
}
