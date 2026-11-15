#pragma once

#include "CUINativeFeatures.h"

std::shared_ptr<CUINativeTableFeature> CUICreateTableFeature(
    std::shared_ptr<std::atomic<bool>> valid, std::shared_ptr<std::mutex> mutex);
