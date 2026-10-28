import android.view.View;
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat;
import com.facebook.react.uimanager.ReactAccessibilityProjection;
import java.util.ArrayList;

// Actual patched SDK receiver, with explicit host-only View/node/Looper doubles. No Android run.
public final class ReadTimeProjectionControls {
  private static int assertions;
  private static void require(boolean value,String label) { assertions++; if (!value) throw new AssertionError(label); }
  private static AccessibilityNodeInfoCompat original(View view) {
    AccessibilityNodeInfoCompat info=new AccessibilityNodeInfoCompat();
    info.focusable=view.authoredFocusable; info.visible=!view.authoredHidden;
    return info;
  }
  private static void metadata(AccessibilityNodeInfoCompat info) {
    require(info.text.equals("held editor text"),"original text");
    require(info.selected && info.focused,"original state");
    require(info.role.equals("original role") && info.actions==19,"original role/actions");
  }
  public static void main(String[] args) {
    View source=new View(), outside=new View(), ancestor=new View();
    AccessibilityNodeInfoCompat untouched=original(source);
    ReactAccessibilityProjection.projectNode(source,untouched);
    require(untouched.focusable && untouched.visible,"unregistered receiver preserves original node");
    metadata(untouched);
    int[] childCalls={0};
    ReactAccessibilityProjection.Receiver receiver=new ReactAccessibilityProjection.Receiver() {
      public int mode(View view) { return view.mode; }
      public void projectChildren(View host,ArrayList<View> children,int start) {
        childCalls[0]++;
        for (int i=children.size()-1;i>=start;i--) if (mode(children.get(i))==ReactAccessibilityProjection.EXCLUDED) children.remove(i);
      }
    };
    require(ReactAccessibilityProjection.register(receiver),"owned receiver registration");
    require(ReactAccessibilityProjection.register(receiver),"same owner registration");
    ReactAccessibilityProjection.Receiver other=new ReactAccessibilityProjection.Receiver() {
      public int mode(View view) { return ReactAccessibilityProjection.EXCLUDED; }
      public void projectChildren(View host,ArrayList<View> children,int start) { throw new AssertionError("foreign receiver"); }
    };
    require(!ReactAccessibilityProjection.register(other),"foreign receiver cannot replace owner");
    source.mode=ReactAccessibilityProjection.ALLOWED;
    AccessibilityNodeInfoCompat allowed=original(source); ReactAccessibilityProjection.projectNode(source,allowed);
    require(allowed.focusable && allowed.visible && allowed.important,"allowed original exposure"); metadata(allowed);
    ancestor.mode=ReactAccessibilityProjection.TRAVERSE;
    AccessibilityNodeInfoCompat parent=original(ancestor); ReactAccessibilityProjection.projectNode(ancestor,parent);
    require(!parent.focusable && !parent.screenReaderFocusable && parent.visible,"traversal parent"); metadata(parent);
    outside.mode=ReactAccessibilityProjection.EXCLUDED;
    AccessibilityNodeInfoCompat hidden=original(outside); ReactAccessibilityProjection.projectNode(outside,hidden);
    require(!hidden.focusable && !hidden.visible && !hidden.important,"outside exclusion"); metadata(hidden);
    require(outside.authoredFocusable && !outside.authoredHidden,"no original view property overwrite");
    ReactAccessibilityProjection.beginOriginalMetadata();
    ReactAccessibilityProjection.beginOriginalMetadata();
    AccessibilityNodeInfoCompat nested=original(outside); ReactAccessibilityProjection.projectNode(outside,nested);
    require(nested.visible && nested.focusable,"nested original metadata stays original"); metadata(nested);
    require(!ReactAccessibilityProjection.allowsAction(outside),"original metadata read cannot admit an outside action");
    ReactAccessibilityProjection.endOriginalMetadata();
    require(ReactAccessibilityProjection.mode(outside)==ReactAccessibilityProjection.ORIGINAL,"outer original read remains current");
    ReactAccessibilityProjection.endOriginalMetadata();
    require(ReactAccessibilityProjection.mode(outside)==ReactAccessibilityProjection.EXCLUDED,"final result resumes current exclusion");
    boolean unbalanced=false;
    try { ReactAccessibilityProjection.endOriginalMetadata(); } catch (IllegalStateException expected) { unbalanced=true; }
    require(unbalanced,"unbalanced original read refuses");
    outside.authoredFocusable=false; outside.authoredHidden=true;
    ReactAccessibilityProjection.projectNode(outside,original(outside));
    outside.authoredFocusable=false; outside.authoredHidden=true;
    outside.mode=ReactAccessibilityProjection.ORIGINAL;
    AccessibilityNodeInfoCompat retired=original(outside); ReactAccessibilityProjection.projectNode(outside,retired);
    require(!retired.focusable && !retired.visible,"concurrent same-value authored updates survive retirement"); metadata(retired);
    source.authoredFocusable=false;
    AccessibilityNodeInfoCompat disabled=original(source); ReactAccessibilityProjection.projectNode(source,disabled);
    require(!disabled.focusable,"allowed target cannot invent authored focusability");
    ArrayList<View> children=new ArrayList<>(); children.add(outside); children.add(source); children.add(ancestor); children.add(outside);
    outside.mode=ReactAccessibilityProjection.EXCLUDED;
    ReactAccessibilityProjection.projectChildren(ancestor,children,1);
    require(children.size()==3 && children.get(0)==outside && children.get(1)==source && children.get(2)==ancestor,"original child identity/order and prior caller prefix");
    require(childCalls[0]==1,"one original child result projection");
    require(ReactAccessibilityProjection.allowsAction(source),"allowed original action");
    require(!ReactAccessibilityProjection.allowsAction(outside),"cached outside action refused");
    require(!ReactAccessibilityProjection.allowsAction(ancestor),"traversal parent cannot activate");
    source.mode=ReactAccessibilityProjection.ORIGINAL;
    require(ReactAccessibilityProjection.allowsAction(source),"inactive policy restores original action admission");
    System.out.println("PASS "+assertions+" actual SDK receiver source assertions; host doubles only");
  }
}
