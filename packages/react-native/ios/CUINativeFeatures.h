#pragma once

#import <React/RCTSurfacePresenter.h>
#include <jsi/jsi.h>
#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <utility>

class CUINativeTableFeature {
 public:
  virtual ~CUINativeTableFeature() = default;
  virtual std::string request(facebook::jsi::Runtime &runtime, const std::string &encoded) = 0;
  virtual void setSurfacePresenter(RCTSurfacePresenter *presenter) = 0;
  virtual void close() = 0;
};

std::shared_ptr<CUINativeTableFeature> CUICreateNativeTableFeature(
    std::shared_ptr<std::atomic<bool>> valid, std::shared_ptr<std::mutex> mutex);
