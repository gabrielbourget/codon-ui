cmake_minimum_required(VERSION 3.13)
project(codon_motion LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)
include("${REACT_NATIVE_DIR}/ReactAndroid/cmake-utils/folly-flags.cmake")
set(CODON_MOTION_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/motion")
add_library(codon_motion SHARED
  MotionSnapshotJNI.cpp
  "${CODON_MOTION_DIR}/FabricSnapshot.cpp"
  "${CODON_MOTION_DIR}/FabricLayout.cpp"
  "${CODON_MOTION_DIR}/NativeStyle.cpp"
  "${CODON_MOTION_DIR}/ScratchYoga.cpp"
  "${CODON_MOTION_DIR}/SnapshotQuery.cpp")
target_include_directories(codon_motion PRIVATE "${CODON_MOTION_DIR}" "${CODEGEN_DIR}")
target_compile_options(codon_motion PRIVATE ${folly_FLAGS})
target_link_libraries(codon_motion ReactAndroid::reactnative ReactAndroid::jsi fbjni::fbjni android log)
