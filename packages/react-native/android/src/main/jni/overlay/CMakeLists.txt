cmake_minimum_required(VERSION 3.13)

set(CUI_OVERLAY_TARGET react_codegen_CodonNativeOverlay)
set(CUI_OVERLAY_ANDROID_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../..")
set(CUI_OVERLAY_CPP_DIR "${CUI_OVERLAY_ANDROID_DIR}/../cpp/overlay")
set(CUI_OVERLAY_GENERATED_DIR "${CUI_OVERLAY_ANDROID_DIR}/build/generated/source/codegen/jni")
file(GLOB CUI_OVERLAY_GENERATED_SOURCES CONFIGURE_DEPENDS
  "${CUI_OVERLAY_GENERATED_DIR}/*.cpp"
  "${CUI_OVERLAY_GENERATED_DIR}/react/renderer/components/CodonNativeInputSpec/*.cpp")
add_library(${CUI_OVERLAY_TARGET} SHARED
  CodonNativeOverlay.cpp
  "${CUI_OVERLAY_CPP_DIR}/NativeOverlayLayout.cpp"
  "${CUI_OVERLAY_CPP_DIR}/OwnedYogaLayout.cpp"
  ${CUI_OVERLAY_GENERATED_SOURCES})
target_include_directories(${CUI_OVERLAY_TARGET} PUBLIC
  "${CMAKE_CURRENT_LIST_DIR}"
  "${CUI_OVERLAY_CPP_DIR}"
  "${CUI_OVERLAY_GENERATED_DIR}")
target_link_libraries(${CUI_OVERLAY_TARGET} ReactAndroid::reactnative ReactAndroid::jsi fbjni::fbjni)
target_compile_reactnative_options(${CUI_OVERLAY_TARGET} PUBLIC)
