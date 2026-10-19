#pragma once

// Android Props changes layout under this existing peer compile definition.
#if defined(__ANDROID__) && !defined(RN_SERIALIZABLE_STATE)
#error "Codon motion must use the pinned React Native Android props ABI compile options"
#endif
