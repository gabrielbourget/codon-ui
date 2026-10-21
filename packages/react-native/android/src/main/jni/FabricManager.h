#pragma once

#include <fbjni/fbjni.h>
#include <react/fabric/FabricUIManagerBinding.h>
#include <react/fabric/JFabricUIManager.h>
#include <react/renderer/scheduler/Scheduler.h>
#include <stdexcept>

// Reuses the already pinned/retained RN binding descriptor. No new private
// renderer field, mutation or manager lifetime is introduced for form reads.
inline std::shared_ptr<facebook::react::UIManager> scopedManager(
    facebook::jni::alias_ref<facebook::react::JFabricUIManager::javaobject> manager) {
  using namespace facebook::react;
  if (!manager) throw std::runtime_error("Native motion: actual manager unavailable");
  static const auto field = JFabricUIManager::javaClassStatic()->getField<FabricUIManagerBinding::javaobject>("mBinding");
  auto nativeBinding = manager->getFieldValue(field);
  if (!nativeBinding) throw std::runtime_error("Native motion: Fabric binding retired");
  auto scheduler = nativeBinding->cthis()->getScheduler();
  if (!scheduler) throw std::runtime_error("Native motion: Fabric scheduler retired");
  auto uiManager = scheduler->getUIManager();
  if (!uiManager) throw std::runtime_error("Native motion: Fabric manager retired");
  return uiManager;
}
