import type { TNativeAdapter } from "./nativeAdapter"
import { inspectTableNativeOwnership, TABLE_COMPOSITION_FILES } from "./ownership"
import { hashSource, type TSourceReader } from "./sourceFiles"

const CORE_IOS_FACTORY = `#include "CUINativeFeatures.h"
#include <stdexcept>

class CUIUnavailableTableFeature final : public CUINativeTableFeature {
 public:
  std::string request(facebook::jsi::Runtime &, const std::string &) override {
    throw std::runtime_error("Table sticky: feature not installed");
  }
  void setSurfacePresenter(RCTSurfacePresenter *) override {}
  void close() override {}
};

std::shared_ptr<CUINativeTableFeature> CUICreateNativeTableFeature(
    std::shared_ptr<std::atomic<bool>>, std::shared_ptr<std::mutex>) {
  return std::make_shared<CUIUnavailableTableFeature>();
}
`

const CORE_JAVA_FACTORY = `package com.codonui.input;

import com.facebook.react.bridge.ReactApplicationContext;
import java.util.concurrent.atomic.AtomicBoolean;

final class CUINativeFeatures {
  private CUINativeFeatures() {}
  static CUINativeTableFeature createTable(ReactApplicationContext context, AtomicBoolean valid, Object lock) {
    return new CUINativeTableFeature() {
      @Override public String request(String encoded) {
        throw new IllegalStateException("Table sticky: feature not installed");
      }
      @Override public void invalidate() {}
    };
  }
}
`

const CORE_JNI_FACTORY = `#include "NativeFeatureRegistration.h"

void registerNativeFeatureNatives() {}
`

export type TNativeTableProjection = {
  retainedFiles: string[]
  excludedFiles: string[]
  replacements: { sourcePath: string; sourceContentHash: string; contentHash: string; content: string }[]
  selectiveInstallValidated: false
}

/** Produces hash-bound copy inputs. Applying them to a consumer remains the existing CLI's responsibility. */
export const projectNativeTableSources = async (
  reader: TSourceReader,
  adapter: TNativeAdapter,
  includeTable: boolean,
): Promise<TNativeTableProjection> => {
  const fullPlan = await inspectTableNativeOwnership(reader, adapter, true)
  if (fullPlan.status !== "source-complete")
    throw new Error(`Native Table projection requires valid canonical inputs: ${JSON.stringify(fullPlan.findings)}`)
  if (includeTable)
    return {
      retainedFiles: fullPlan.retainedFiles,
      excludedFiles: [],
      replacements: [],
      selectiveInstallValidated: false,
    }
  const selected = await inspectTableNativeOwnership(reader, adapter, false)
  const unexpectedReferences = selected.crossUnitDependencies.filter(
    (edge) =>
      edge.fromUnit === "shared" &&
      edge.toUnit === "table" &&
      edge.kind !== "native-build" &&
      !(TABLE_COMPOSITION_FILES as readonly string[]).includes(edge.from),
  )
  if (unexpectedReferences.length)
    throw new Error(`Shared implementation still depends on Table: ${JSON.stringify(unexpectedReferences)}`)
  const sourceContents = new Map<string, Buffer>(
    await Promise.all(
      TABLE_COMPOSITION_FILES.map(async (sourcePath) => [sourcePath, await reader.read(sourcePath)] as const),
    ),
  )
  const replaceOnce = (content: string, needle: string) => {
    const expectedLine = needle.replace(/\n$/, "")
    const lines = content.split("\n")
    if (lines.filter((line) => line === expectedLine).length !== 1)
      throw new Error(`Native composition profile changed: ${needle.trim()}`)
    return lines.filter((line) => line !== expectedLine).join("\n")
  }
  let cmake = sourceContents.get("android/src/main/jni/CMakeLists.txt")!.toString("utf8")
  for (const line of [
    "  TableStickyJNI.cpp\n",
    '  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/table/StickyStyle.cpp"\n',
    '  "${CMAKE_CURRENT_LIST_DIR}/../../../../cpp/table/StickyPresentation.cpp"\n',
  ])
    cmake = replaceOnce(cmake, line)
  const rules = replaceOnce(
    sourceContents.get("android/src/main/consumer-rules.pro")!.toString("utf8"),
    "-keep class com.codonui.input.CUITableNativeSession { *; }\n",
  )
  const replacements = new Map([
    ["ios/CUINativeFeatures.mm", CORE_IOS_FACTORY],
    ["android/src/main/java/com/codonui/input/CUINativeFeatures.java", CORE_JAVA_FACTORY],
    ["android/src/main/jni/NativeFeaturesJNI.cpp", CORE_JNI_FACTORY],
    ["android/src/main/jni/CMakeLists.txt", cmake],
    ["android/src/main/consumer-rules.pro", rules],
  ])
  return {
    retainedFiles: selected.retainedFiles,
    excludedFiles: selected.excludedFiles,
    replacements: [...replacements].map(([sourcePath, content]) => ({
      sourcePath,
      sourceContentHash: hashSource(sourceContents.get(sourcePath)!),
      contentHash: hashSource(Buffer.from(content)),
      content,
    })),
    selectiveInstallValidated: false,
  }
}
