"""Historical unchanged-RN diagnosis only. SDK candidates are retired; Tag is owner-stopped."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def method(source, signature):
    start = source.index(signature)
    opening = source.index("{", start)
    depth = 1
    position = opening + 1
    while depth:
        if source[position] == "{": depth += 1
        if source[position] == "}": depth -= 1
        position += 1
    return source[start:position]


STUBS = r'''
import java.util.*;
class MixedDescriptionProbe<T extends MixedDescriptionProbe.View> {
  @interface NonNull {} @interface Nullable {}
  static final String STATE_CHECKED="checked",STATE_MIXED="mixed",STATE_BUSY="busy",STATE_EXPANDED="expanded";
  static class R {
    static class id {static final int accessibility_state_expanded=1,accessibility_state=2,accessibility_label=3,accessibility_value=4;}
    static class string {static final int state_unselected_description=1,state_mixed_description=2,state_busy_description=3;}
  }
  enum ReadableType {String,Boolean}
  static class Dynamic {
    Object value; Dynamic(Object value){this.value=value;}
    ReadableType getType(){return value instanceof String?ReadableType.String:ReadableType.Boolean;}
    String asString(){return (String)value;} boolean asBoolean(){return (Boolean)value;}
  }
  static class ReadableMapKeySetIterator {
    Iterator<String> keys; ReadableMapKeySetIterator(Set<String> keys){this.keys=keys.iterator();}
    boolean hasNextKey(){return keys.hasNext();} String nextKey(){return keys.next();}
  }
  static class ReadableMap {
    LinkedHashMap<String,Object> values=new LinkedHashMap<>();
    ReadableMap(Object checked){values.put("checked",checked);values.put("disabled",false);}
    boolean hasKey(String key){return values.containsKey(key);}
    boolean getBoolean(String key){return (Boolean)values.get(key);}
    ReadableType getType(String key){return new Dynamic(values.get(key)).getType();}
    Dynamic getDynamic(String key){return new Dynamic(values.get(key));}
    ReadableMapKeySetIterator keySetIterator(){return new ReadableMapKeySetIterator(values.keySet());}
  }
  static class Context {String getString(int key){return key==2?"mixed":key==3?"busy":"unselected";}}
  static class View {
    Map<Integer,Object> tags=new HashMap<>(); boolean selected,enabled=true; String description="Controlled tag";
    Object getTag(int key){return tags.get(key);} void setTag(int key,Object value){tags.put(key,value);}
    boolean isSelected(){return selected;} void setSelected(boolean value){selected=value;}
    boolean isAccessibilityFocused(){return false;} Context getContext(){return new Context();}
    void announceForAccessibility(String value){} void sendAccessibilityEvent(int type){} void setEnabled(boolean value){enabled=value;}
    void setContentDescription(String value){description=value;}
  }
  static class AccessibilityEvent {static final int TYPE_VIEW_CLICKED=1;}
  static class TextUtils {static String join(String delimiter,List<String> values){return String.join(delimiter,values);}}
'''

CONTROL = r'''
  static void check(boolean value){if(!value)throw new AssertionError();}
  public static void main(String[] args) {
    MixedDescriptionProbe<View> manager=new MixedDescriptionProbe<>();View view=new View();
    view.setTag(R.id.accessibility_label,"Controlled tag");
    manager.setViewState(view,new ReadableMap("mixed"));check(view.description.equals("Controlled tag, mixed"));
    ReadableMap reset=new ReadableMap(true);manager.setViewState(view,reset);
    check(view.getTag(R.id.accessibility_state)==reset&&reset.getBoolean("checked"));
    check(view.description.equals("Controlled tag, mixed"));
    // Counterfactual diagnosis only: the existing recomputation can clear the stale suffix.
    manager.updateViewContentDescription(view);check(view.description.equals("Controlled tag"));
    View unnamed=new View();unnamed.description=null;manager.setViewState(unnamed,new ReadableMap("mixed"));check(unnamed.description.equals("mixed"));
    ReadableMap ordinary=new ReadableMap(true);ordinary.values.put("busy",false);manager.setViewState(unnamed,ordinary);
    check(unnamed.description.equals("mixed"));
    System.out.println("REPRODUCED: mixed-to-boolean updates checked state but leaves mixed description; existing recomputation clears it");
    System.out.println("INCOMPLETE COMPONENT WORKAROUND: forcing recomputation via busy=false still leaves mixed on an unnamed Tag");
  }
}
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(exist_ok=False)
    original = args.source.read_text()
    source = original
    methods = [method(source, signature) for signature in ["public void setViewState(", "private void updateViewContentDescription("]]
    java = args.out / "MixedDescriptionProbe.java"
    java.write_text(STUBS + "\n".join(methods) + CONTROL)
    jdk = Path.home() / ".local/share/codon-native-lab/jdk/Contents/Home/bin"
    steps = []
    for name, argv in [("compile", [str(jdk / "javac"), str(java)]), ("run", [str(jdk / "java"), "-cp", str(args.out), "MixedDescriptionProbe"])]:
        result = subprocess.run(argv, capture_output=True, text=True, timeout=20)
        (args.out / (name + ".stdout")).write_text(result.stdout)
        (args.out / (name + ".stderr")).write_text(result.stderr)
        steps.append({"argv": argv, "exitCode": result.returncode})
        if result.returncode: raise RuntimeError(result.stderr)
    assert "REPRODUCED:" in (args.out / "run.stdout").read_text()
    assert args.source.read_text() == original
    report = {"status": "REPRODUCED_SOURCE_STALE_MIXED_DESCRIPTION", "scope": "Historical unchanged-source diagnosis only; Tag is owner-stopped and SDK candidate approach is rejected", "source": str(args.source.resolve()), "sourceSHA256": hashlib.sha256(args.source.read_bytes()).hexdigest(), "methodSHA256": [hashlib.sha256(body.encode()).hexdigest() for body in methods], "generatedControlSHA256": hashlib.sha256(java.read_bytes()).hexdigest(), "steps": steps, "sdkOrShippingChanges": 0}
    (args.out / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
