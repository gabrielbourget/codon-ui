---
title: Adapter Boundaries
description: What stays outside the reusable component graph.
---

The extracted graph is reusable component source. Wavemap-specific adapters stay in the consumer unless an explicit
promotion lane gives them a reusable contract.

## Stays In Consumers

These surfaces remain consumer-owned:

| Surface                         | Reason                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| API contracts and DTOs          | They model product data, not component-library behavior.               |
| Route/query state               | It belongs to application navigation and URL semantics.                |
| Saved views                     | It coordinates application persistence and product workflows.          |
| Translations and providers      | They bind UI text and context to a consuming app.                      |
| Media upload and gallery flows  | They couple storage, uploads, preview state, and product expectations. |
| Product/domain tables           | They compose reusable table pieces with Wavemap data contracts.        |
| Broad app shell or layout rails | They depend on product navigation, providers, routing, and chrome.     |

Small defaults can travel with a named reusable component when they are part of that component contract. Whole support
folders should not move by proximity.

## Reusable Source Requirements

Reusable source should:

- avoid application route, provider, and translation imports;
- avoid product DTOs, API clients, and saved-view contracts;
- use package-local or registry-owned support paths instead of Wavemap aliases;
- declare peer/runtime dependencies in the registry manifest;
- keep component styles in component-local CSS modules or explicit theme files;
- make target paths, support files, and public exports explicit through the manifest and ingest packet.

## Consumer Proof Role

Wavemap is the mature local consumer. Its delete/reinstall proofs verify that a registry item can be removed from local
component source and rehydrated from Codon UI while Wavemap-owned adapters remain local.

Those proofs do not make Wavemap adapters part of Codon UI. They prove the boundary between reusable source and consumer
integration code.
