package com.codonui.input;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Retained original getItems snapshots. A reader owns its immutable snapshot even
// after module cleanup retires new opens. Drag end/source unmount never release it.
final class CUIDragMimePayloads {
  private static final Map<String, Snapshot> entries = new LinkedHashMap<>();

  static final class Snapshot {
    final String moduleId, token;
    private final Map<String, String> values;
    Snapshot(String moduleId, Map<String, String> values) {
      this.moduleId = moduleId; token = UUID.randomUUID().toString();
      LinkedHashMap<String, String> copied = new LinkedHashMap<>();
      for (Map.Entry<String, String> entry : values.entrySet()) {
        if (entry.getKey() == null || entry.getValue() == null)
          throw new IllegalArgumentException("Native drag export: original MIME strings required");
        copied.put(entry.getKey(), entry.getValue());
      }
      this.values = Collections.unmodifiableMap(copied);
    }
    String[] types() { return values.keySet().toArray(new String[0]); }
    byte[] bytes(String type) {
      String value = values.get(type);
      if (value == null) throw new IllegalArgumentException("Native drag export: original MIME unavailable");
      return value.getBytes(StandardCharsets.UTF_8);
    }
  }

  static synchronized Snapshot retain(String moduleId, Map<String, String> values) {
    if (moduleId == null || moduleId.isEmpty() || values == null)
      throw new IllegalArgumentException("Native drag export: original module snapshot required");
    Snapshot result = new Snapshot(moduleId, values);
    entries.put(result.token, result); return result;
  }
  static synchronized Snapshot open(String token) {
    Snapshot result = entries.get(token);
    if (result == null) throw new IllegalArgumentException("Native drag export: payload retired or unknown");
    return result;
  }
  static synchronized boolean release(String moduleId, String token) {
    Snapshot result = entries.get(token);
    if (result == null || !result.moduleId.equals(moduleId)) return false;
    entries.remove(token); return true;
  }
  static synchronized List<String> releaseModule(String moduleId) {
    List<String> tokens = new ArrayList<>();
    entries.entrySet().removeIf(entry -> {
      if (!entry.getValue().moduleId.equals(moduleId)) return false;
      tokens.add(entry.getKey()); return true;
    });
    return tokens;
  }
}
