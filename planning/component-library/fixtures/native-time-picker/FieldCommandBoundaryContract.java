import java.util.ArrayDeque;

// The runner supplies the exact pinned FabricUIManager method separately.
// These queue/flag/value types are source-order test doubles, not Android UI.
@interface Nullable {}
final class ReadableArray {}
final class Command {
  final int target;
  final String name;
  final ReadableArray arguments;
  Command(int target, String name, ReadableArray arguments) { this.target = target; this.name = name; this.arguments = arguments; }
}
final class MountItemFactory {
  static Command createDispatchCommandMountItem(int surface, int target, String name, ReadableArray arguments) {
    return new Command(target, name, arguments);
  }
}
final class ReactNativeNewArchitectureFeatureFlags {
  static boolean interop;
  static boolean useFabricInterop() { return interop; }
}
final class CommandQueue {
  final ArrayDeque<Command> pending = new ArrayDeque<>();
  int focused = 10, calls;
  void addViewCommandMountItem(Command command) { pending.add(command); }
  void resumeOriginalUIQueue() {
    while (!pending.isEmpty()) { focused = pending.remove().target; calls++; }
  }
}

public final class FieldCommandBoundaryContract {
  private static int assertions;
  private static void check(boolean condition) {
    if (!condition) throw new AssertionError("Android command queue boundary failed");
    assertions++;
  }
  public static void main(String[] arguments) {
    for (boolean interop : new boolean[]{false, true}) {
      ReactNativeNewArchitectureFeatureFlags.interop = interop;
      FabricUIManager manager = new FabricUIManager();
      ReadableArray originalArguments = new ReadableArray();
      manager.dispatchCommand(11, 12, "focus", originalArguments);
      check(manager.mMountItemDispatcher.pending.size() == 1);
      Command command = manager.mMountItemDispatcher.pending.peek();
      check(command.target == 12 && command.name.equals("focus") && command.arguments == originalArguments);
      check(manager.mMountItemDispatcher.focused == 10 && manager.mMountItemDispatcher.calls == 0);
      manager.mMountItemDispatcher.resumeOriginalUIQueue();
      check(manager.mMountItemDispatcher.focused == 12 && manager.mMountItemDispatcher.calls == 1);
      manager.mMountItemDispatcher.resumeOriginalUIQueue();
      check(manager.mMountItemDispatcher.calls == 1);
    }
    System.out.println(assertions + " exact FabricUIManager excerpt assertions passed; original command queues before execution; no installed SDK verdict");
  }
}
