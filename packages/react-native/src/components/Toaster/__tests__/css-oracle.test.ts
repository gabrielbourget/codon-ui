import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativeToastMotionFrame } from "../motion"
import { getNativeToastStyles } from "../styles"
import type { TNativeToastProps } from "../types"

import oracle from "./fixtures/toast-css-scale.json"

it.each(oracle.frames)(
  "CAP.toaster.007 native collapsed index $index matches the actual canonical CSS browser matrix",
  ({ index, matrix }) => {
    const props: TNativeToastProps = {
      toast: { id: 0 },
      index,
      numToasts: 21,
      position: "top-right",
      offset: 0,
      firstHeight: 100,
      maxVisibleToasts: 30,
      toasterExpanded: false,
      interacting: false,
      removeToast: jest.fn(),
      onHeight: jest.fn(),
    }
    const styles = getNativeToastStyles(resolveNativeTheme("light"), props, false)
    expect(styles.root.transform).toEqual([{ translateY: matrix[5] }, { scale: matrix[0] }])
    expect(
      getNativeToastMotionFrame(
        props,
        { entered: true, removed: false, swiped: false, naturalHeight: 100 },
        styles.root,
        {},
      ).scale,
    ).toBeCloseTo(matrix[0])
  },
)
