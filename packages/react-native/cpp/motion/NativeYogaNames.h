/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 * Licensed under the MIT license; see LICENSE.react-native.md.
 */

// Pinned Yoga formatters are not exported by RN0.86.3 Android Release.
#pragma once
#include <yoga/YGEnums.h>

namespace codon::motion {

inline const char* nativeYogaEnumName(const YGAlign value) {
  switch (value) {
    case YGAlignAuto:
      return "auto";
    case YGAlignFlexStart:
      return "flex-start";
    case YGAlignCenter:
      return "center";
    case YGAlignFlexEnd:
      return "flex-end";
    case YGAlignStretch:
      return "stretch";
    case YGAlignBaseline:
      return "baseline";
    case YGAlignSpaceBetween:
      return "space-between";
    case YGAlignSpaceAround:
      return "space-around";
    case YGAlignSpaceEvenly:
      return "space-evenly";
    case YGAlignStart:
      return "start";
    case YGAlignEnd:
      return "end";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGBoxSizing value) {
  switch (value) {
    case YGBoxSizingBorderBox:
      return "border-box";
    case YGBoxSizingContentBox:
      return "content-box";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGDisplay value) {
  switch (value) {
    case YGDisplayFlex:
      return "flex";
    case YGDisplayNone:
      return "none";
    case YGDisplayContents:
      return "contents";
    case YGDisplayGrid:
      return "grid";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGFlexDirection value) {
  switch (value) {
    case YGFlexDirectionColumn:
      return "column";
    case YGFlexDirectionColumnReverse:
      return "column-reverse";
    case YGFlexDirectionRow:
      return "row";
    case YGFlexDirectionRowReverse:
      return "row-reverse";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGJustify value) {
  switch (value) {
    case YGJustifyAuto:
      return "auto";
    case YGJustifyFlexStart:
      return "flex-start";
    case YGJustifyCenter:
      return "center";
    case YGJustifyFlexEnd:
      return "flex-end";
    case YGJustifySpaceBetween:
      return "space-between";
    case YGJustifySpaceAround:
      return "space-around";
    case YGJustifySpaceEvenly:
      return "space-evenly";
    case YGJustifyStretch:
      return "stretch";
    case YGJustifyStart:
      return "start";
    case YGJustifyEnd:
      return "end";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGOverflow value) {
  switch (value) {
    case YGOverflowVisible:
      return "visible";
    case YGOverflowHidden:
      return "hidden";
    case YGOverflowScroll:
      return "scroll";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGPositionType value) {
  switch (value) {
    case YGPositionTypeStatic:
      return "static";
    case YGPositionTypeRelative:
      return "relative";
    case YGPositionTypeAbsolute:
      return "absolute";
  }
  return "unknown";
}

inline const char* nativeYogaEnumName(const YGWrap value) {
  switch (value) {
    case YGWrapNoWrap:
      return "no-wrap";
    case YGWrapWrap:
      return "wrap";
    case YGWrapWrapReverse:
      return "wrap-reverse";
  }
  return "unknown";
}

} // namespace codon::motion
