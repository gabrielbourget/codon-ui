#pragma once

#include "FabricFormDocument.h"
#include <string>
#include <mutex>

namespace codon::form {
class NativeFormDocumentSession {
 public:
  explicit NativeFormDocumentSession(std::string identity) : identity_(std::move(identity)) {}
  std::string identityFor(const facebook::react::ShadowNodeFamily::Shared &family);
 private:
  struct TDocumentIdentity {
    facebook::react::ShadowNodeFamily::Weak family;
    std::string identity;
  };
  const std::string identity_;
  std::mutex mutex_;
  uint64_t sequence_{0};
  std::unordered_map<facebook::react::SurfaceId, TDocumentIdentity> documents_;
};

std::string queryFabricFormDocument(
    const facebook::react::UIManager &manager,
    facebook::react::SurfaceId surface,
    facebook::react::Tag target,
    NativeFormDocumentSession &session,
    const std::function<void()> &check = {});
} // namespace codon::form
