"""Execute the production reference resolvers with host SDK seams, not native UI proof."""
from pathlib import Path
import argparse
import json
import subprocess
import tempfile

REPO = Path(__file__).resolve().parents[4]
JAVA_ROOT = REPO / "packages/react-native/android/src/main/java"
IOS_ROOT = REPO / "packages/react-native/ios"

JAVA_SEAMS = {
    "android/text/TextUtils.java": """package android.text; public final class TextUtils { public static String join(CharSequence delimiter, Iterable<?> values) { java.util.ArrayList<String> text=new java.util.ArrayList<>(); for(Object value:values)text.add(value.toString()); return String.join(delimiter,text); } }""",
    "android/os/Build.java": """package android.os; public final class Build { public static final class VERSION { public static int SDK_INT=36; } }""",
    "android/os/Bundle.java": """package android.os; public final class Bundle { private final java.util.Map<String,CharSequence> values=new java.util.HashMap<>(); public void putCharSequence(String key,CharSequence value){values.put(key,value);} public CharSequence getCharSequence(String key){return values.get(key);} }""",
    "android/view/View.java": """package android.view; public class View { public View parent; public Object window; public String nativeId; public int id; public CharSequence label; private final java.util.Map<Integer,Object> tags=new java.util.HashMap<>(); public boolean isAttachedToWindow(){return window!=null;} public Object getWindowToken(){return window;} public View getRootView(){View value=this;while(value.parent!=null)value=value.parent;return value;} public Object getTag(int key){return tags.get(key);} public void setTag(int key,Object value){tags.put(key,value);} public CharSequence getContentDescription(){return label;} public View findViewById(int key){if(id==key)return this;if(this instanceof ViewGroup)for(View child:((ViewGroup)this).children){View found=child.findViewById(key);if(found!=null)return found;}return null;} }""",
    "android/view/ViewGroup.java": """package android.view; public class ViewGroup extends View { public final java.util.List<View> children=new java.util.ArrayList<>(); public void add(View child){children.add(child);child.parent=this;child.window=window;} public int getChildCount(){return children.size();} public View getChildAt(int index){return children.get(index);} }""",
    "android/widget/TextView.java": """package android.widget; public class TextView extends android.view.View { public CharSequence text; public CharSequence getText(){return text;} }""",
    "android/view/accessibility/AccessibilityNodeInfo.java": """package android.view.accessibility; public class AccessibilityNodeInfo { private CharSequence details; public void setSupplementalDescription(CharSequence value){details=value;} public CharSequence getSupplementalDescription(){return details;} }""",
    "androidx/annotation/RequiresApi.java": """package androidx.annotation; public @interface RequiresApi { int value(); }""",
    "androidx/core/view/accessibility/AccessibilityNodeInfoCompat.java": """package androidx.core.view.accessibility; public class AccessibilityNodeInfoCompat { private final android.os.Bundle extras=new android.os.Bundle(); private final android.view.accessibility.AccessibilityNodeInfo node=new android.view.accessibility.AccessibilityNodeInfo(); public android.view.accessibility.AccessibilityNodeInfo unwrap(){return node;} public android.os.Bundle getExtras(){return extras;} }""",
    "com/facebook/react/R.java": """package com.facebook.react; public final class R { public static final class id { public static final int accessibility_label=1; } }""",
    "com/facebook/react/uimanager/util/ReactFindViewUtil.java": """package com.facebook.react.uimanager.util; public final class ReactFindViewUtil { public static android.view.View findView(android.view.View root,String id){if(id.equals(root.nativeId))return root;if(root instanceof android.view.ViewGroup)for(android.view.View child:((android.view.ViewGroup)root).children){android.view.View found=findView(child,id);if(found!=null)return found;}return null;} }""",
    "com/codonui/input/CUIFocusView.java": """package com.codonui.input; public class CUIFocusView extends android.view.ViewGroup { public java.util.List<String> references=new java.util.ArrayList<>(); CharSequence accessibilityReferenceLabel(){CUIAccessibilityReferences.Text result=CUIAccessibilityReferences.resolve(this,references,0,false);return result.available?result.value:label;} }""",
}

JAVA_CASES = r"""package com.codonui.input;
import android.view.*; import android.widget.TextView; import java.util.*;
public final class LabelModelCases {
  static int count;
  static void expect(View source,List<String> ids,boolean body,String expected){
    CUIAccessibilityReferences.Text value=CUIAccessibilityReferences.resolve(source,ids,0,body);
    if(expected==null ? value.available : !value.available || !expected.equals(value.value))throw new AssertionError("expected="+expected+" actual="+value.value+" available="+value.available);
    count++;
  }
  public static void main(String[] args){
    Object window=new Object(); ViewGroup root=new ViewGroup(); root.window=window;
    CUIFocusView source=new CUIFocusView(); source.nativeId="source"; source.label="Own"; source.setTag(com.facebook.react.R.id.accessibility_label,"Own"); root.add(source);
    TextView reference=new TextView(); reference.nativeId="reference"; reference.label="Referenced"; reference.text="Visible body"; root.add(reference);
    expect(source,Arrays.asList("source","reference"),false,"Own Referenced");
    expect(source,Arrays.asList("reference","source"),false,"Referenced Own");
    expect(source,Arrays.asList("source"),false,"Own");
    expect(source,Arrays.asList("reference"),false,"Referenced");
    expect(source,Arrays.asList("source","reference"),true,"Visible body");
    source.setTag(com.facebook.react.R.id.accessibility_label,""); expect(source,Arrays.asList("source"),false,null);
    source.setTag(com.facebook.react.R.id.accessibility_label,null); expect(source,Arrays.asList("source","reference"),false,"Referenced");
    source.setTag(com.facebook.react.R.id.accessibility_label,"Current"); expect(source,Arrays.asList("source","reference"),false,"Current Referenced");
    reference.window=new Object(); expect(source,Arrays.asList("reference"),false,null); reference.window=window;
    reference.window=null; expect(source,Arrays.asList("reference"),false,null); reference.window=window;
    source.window=null; expect(source,Arrays.asList("source","reference"),false,null); source.window=window;
    CUIFocusView other=new CUIFocusView(); other.nativeId="other"; other.label="Other"; other.setTag(com.facebook.react.R.id.accessibility_label,"Other"); root.add(other);
    source.references=Arrays.asList("source","other"); other.references=Arrays.asList("other","source");
    expect(source,source.references,false,"Current Other"); expect(other,other.references,false,"Other Current");
    if(source.getTag(com.facebook.react.R.id.accessibility_label)!="Current" || source.window!=window || reference.parent!=root || !source.references.equals(Arrays.asList("source","other")))throw new AssertionError("original native-seam state changed");
    System.out.println("label-model-java: "+count+" cases passed");
  }
}
"""

UIKIT_SEAM = r"""#import <Foundation/Foundation.h>
@class UIWindow;
@interface UIView : NSObject
@property(nonatomic,weak) UIWindow *window;
@property(nonatomic,copy) NSString *nativeID;
@property(nonatomic,copy) NSString *accessibilityLabel;
@property(nonatomic) NSInteger tag;
@property(nonatomic,strong) NSMutableArray<UIView *> *subviews;
- (void)addSubview:(UIView *)view;
@end
@interface UIWindow : UIView @end
@interface UILabel : UIView @property(nonatomic,copy) NSString *text; @end
@interface UITextView : UIView @property(nonatomic,copy) NSString *text; @end
@interface UITextField : UIView @property(nonatomic,copy) NSString *text; @end
"""

OBJC_CASES = r"""#import <UIKit/UIKit.h>
#import <React/RCTViewComponentView.h>
#import "CUIAccessibilityReferences.h"
@implementation UIView
- (instancetype)init { if((self=[super init]))_subviews=[NSMutableArray array];return self; }
- (void)addSubview:(UIView *)view { [_subviews addObject:view];view.window=self.window; }
@end
@implementation UIWindow @end
@implementation UILabel @end
@implementation UITextView @end
@implementation UITextField @end
@implementation RCTViewComponentView @end
@interface ReferenceView : RCTViewComponentView
@property(nonatomic,copy) NSString *ownLabel;
@property(nonatomic,copy) NSArray<NSString *> *references;
@end
@implementation ReferenceView
- (NSString *)accessibilityLabel { if(CUIAccessibilityIsResolving(self))return nil;NSString *value=CUIAccessibilityResolveLabel(self,self.references,self.ownLabel.length?self.ownLabel:nil);return value?:self.ownLabel; }
@end
static int count;
static void expect(UIView *source,NSArray<NSString *> *ids,NSString *own,NSString *expected){
  NSString *value=CUIAccessibilityResolveLabel(source,ids,own);
  if(value!=expected && ![value isEqualToString:expected]){fprintf(stderr,"expected=%s actual=%s\n",expected.UTF8String,value.UTF8String);exit(1);}count++;
}
int main(){@autoreleasepool{
  UIWindow *window=[UIWindow new];window.window=window;
  ReferenceView *source=[ReferenceView new];source.nativeId=@"source";source.ownLabel=@"Own";[window addSubview:source];
  UILabel *reference=[UILabel new];reference.nativeID=@"reference";reference.accessibilityLabel=@"Referenced";reference.text=@"Visible body";[window addSubview:reference];
  expect(source,@[@"source",@"reference"],source.ownLabel,@"Own Referenced");
  expect(source,@[@"reference",@"source"],source.ownLabel,@"Referenced Own");
  expect(source,@[@"source"],source.ownLabel,@"Own"); expect(source,@[@"reference"],source.ownLabel,@"Referenced");
  if(![CUIAccessibilityResolve(source,@[@"source",@"reference"],0,YES) isEqualToString:@"Visible body"])exit(2);count++;
  expect(source,@[@"source"],nil,nil);expect(source,@[@"source",@"reference"],nil,@"Referenced");
  source.ownLabel=@"Current";expect(source,@[@"source",@"reference"],source.ownLabel,@"Current Referenced");
  UIWindow *otherWindow=[UIWindow new];otherWindow.window=otherWindow;reference.window=otherWindow;expect(source,@[@"reference"],source.ownLabel,nil);
  reference.window=nil;expect(source,@[@"reference"],source.ownLabel,nil);reference.window=window;
  source.window=nil;expect(source,@[@"source",@"reference"],source.ownLabel,nil);source.window=window;
  ReferenceView *other=[ReferenceView new];other.nativeId=@"other";other.ownLabel=@"Other";[window addSubview:other];
  source.references=@[@"source",@"other"];other.references=@[@"other",@"source"];
  expect(source,source.references,source.ownLabel,@"Current Other");expect(other,other.references,other.ownLabel,@"Other Current");
  if(source.window!=window || ![source.ownLabel isEqualToString:@"Current"] || reference.window!=window || ![source.references isEqualToArray:@[@"source",@"other"]])exit(3);
  printf("label-model-objc: %d cases passed\n",count);
}return 0;}
"""


def run(command):
    result = subprocess.run(command, text=True, capture_output=True, timeout=60)
    print(result.stdout, end="")
    print(result.stderr, end="")
    if result.returncode:
        raise SystemExit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("platform", choices=["java", "objc"])
    parser.add_argument("--source-ref", help="Java-only historical production resolver for the preserved red reproduction")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="codon-label-model-") as directory:
        temporary = Path(directory)
        if args.platform == "java":
            for relative, content in JAVA_SEAMS.items():
                target = temporary / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)
            production = temporary / "com/codonui/input/CUIAccessibilityReferences.java"
            relative = "packages/react-native/android/src/main/java/com/codonui/input/CUIAccessibilityReferences.java"
            production.write_bytes(subprocess.check_output(["git", "show", args.source_ref + ":" + relative], cwd=REPO) if args.source_ref else (REPO / relative).read_bytes())
            (production.parent / "LabelModelCases.java").write_text(JAVA_CASES)
            java_home = Path.home() / ".local/share/codon-native-lab/jdk/Contents/Home/bin"
            run([str(java_home / "javac"), "-d", str(temporary / "classes"), *map(str, temporary.rglob("*.java"))])
            run([str(java_home / "java"), "-cp", str(temporary / "classes"), "com.codonui.input.LabelModelCases"])
        else:
            if args.source_ref:
                parser.error("--source-ref is supported only by the Java baseline")
            for relative, content in {
                "UIKit/UIKit.h": UIKIT_SEAM,
                "React/RCTViewComponentView.h": '#import <UIKit/UIKit.h>\n@interface RCTViewComponentView : UIView\n@property(nonatomic,copy) NSString *nativeId;\n@end\n',
                "React/UIView+React.h": '#import <UIKit/UIKit.h>\n',
                "Cases.mm": OBJC_CASES,
            }.items():
                target = temporary / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content)
            run(["xcrun", "--sdk", "macosx", "clang++", "-fobjc-arc", "-std=c++20", "-framework", "Foundation", "-I", str(temporary), "-I", str(IOS_ROOT), str(temporary / "Cases.mm"), str(IOS_ROOT / "CUIAccessibilityReferences.mm"), "-o", str(temporary / "cases")])
            run([str(temporary / "cases")])
    print(json.dumps({"tier": "production resolver with host SDK seams", "platform": args.platform, "nativeUIVerdict": False}))


if __name__ == "__main__":
    main()
