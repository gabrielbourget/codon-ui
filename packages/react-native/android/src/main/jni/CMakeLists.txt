cmake_minimum_required(VERSION 3.13)
project(codon_motion LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)
include("${REACT_NATIVE_DIR}/ReactAndroid/cmake-utils/folly-flags.cmake")
include("${REACT_NATIVE_DIR}/ReactCommon/cmake-utils/react-native-flags.cmake")
set(CODON_MOTION_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/motion")
add_library(codon_motion SHARED
  MotionSnapshotJNI.cpp
  FormDocumentJNI.cpp
  DragActionJNI.cpp
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/form/FabricFormDocument.cpp"
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/form/FormDocumentQuery.cpp"
  MotionIntrinsicsJNI.cpp
  MotionDrawingJNI.cpp
  ForegroundJNI.cpp
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/overlay/ForegroundFilters.cpp"
  BackdropJNI.cpp
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/backdrop/Gaussian.cpp"
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/backdrop/ProjectedBlur.cpp"
  "${CODON_MOTION_DIR}/FabricSnapshot.cpp"
  "${CODON_MOTION_DIR}/FabricLayout.cpp"
  "${CODON_MOTION_DIR}/NativeStyle.cpp"
  "${CODON_MOTION_DIR}/NativeIntrinsics.cpp"
  "${CODON_MOTION_DIR}/ScratchYoga.cpp"
  "${CODON_MOTION_DIR}/PopFrame.cpp"
  "${CODON_MOTION_DIR}/PopStyle.cpp"
  "${CODON_MOTION_DIR}/PopPresentation.cpp"
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/table/StickyStyle.cpp"
  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/table/StickyPresentation.cpp"
  "${CODON_MOTION_DIR}/ViewportQuery.cpp"
  "${CODON_MOTION_DIR}/InitialValueQuery.cpp"
  "${CODON_MOTION_DIR}/InitialValueStyle.cpp"
  "${CODON_MOTION_DIR}/NativeLayoutState.cpp"
  "${CODON_MOTION_DIR}/GeometryQuery.cpp"
  "${CODON_MOTION_DIR}/SnapshotQuery.cpp")
target_include_directories(codon_motion PRIVATE "${CODON_MOTION_DIR}" "${CODEGEN_DIR}"
  "${CUI_SAFE_AREA_CPP_DIR}" "${CUI_SAFE_AREA_CODEGEN_DIR}"
  "${CUI_TELEPORT_CPP_DIR}" "${CUI_TELEPORT_CODEGEN_DIR}"
  "${REACT_NATIVE_DIR}/ReactCommon"
  "${REACT_NATIVE_DIR}/ReactCommon/react/renderer/components/text/platform/android"
  "${REACT_NATIVE_DIR}/ReactCommon/react/renderer/components/scrollview/platform/android"
  "${REACT_NATIVE_DIR}/ReactCommon/react/renderer/components/progressbar/android")
target_compile_options(codon_motion PRIVATE ${folly_FLAGS})
target_compile_reactnative_options(codon_motion PRIVATE)
target_link_libraries(codon_motion ReactAndroid::reactnative ReactAndroid::jsi fbjni::fbjni android log)
