import UIKit
import CodonNativeInput

func checkNativePublicModule(_ view: UIView) -> Bool {
  CUIValidateVirtualDragAccessibilityView(view)
}
