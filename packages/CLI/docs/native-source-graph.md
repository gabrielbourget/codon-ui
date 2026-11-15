# Native source graph foundation

The read-only `buildNativeSourceGraph` helper in `src/helpers/nativeSource/graph.ts` prepares source/dependency evidence for later React Native registry integration. It is internal to the CLI source and is not connected to CLI commands, project detection, registry manifests, install plans, lockfiles or file writers. Existing add/update/diff/remove behavior is unchanged.

Pass the canonical `packages/react-native` directory as `sourceRoot` and an explicit map of component names to package-relative TypeScript entrypoints:

```ts
const graph = await buildNativeSourceGraph({
  sourceRoot: "/checkout/packages/react-native",
  entrypoints: {
    button: ["src/components/Button/Button.tsx"],
    time: ["src/components/TimePicker/TimePicker.tsx"],
  },
})
```

Files have package-relative paths, SHA-256 hashes of their original bytes and the sorted component owners that require them. Source/type edges retain imports, reexports, literal dynamic imports, `require`, import types and import-equals references. Native edges record registration, build membership, quoted includes and owned Java type dependencies. Ancestor license/notice/upstream files accompany selected source. Dependencies preserve the full imported subpath, declared package/range, runtime/peer classification and importing files, including private React Native subpaths that a later consumer verifier must assess. Cycles terminate and shared paths appear once. A fresh call after an edit produces a changed hash; it neither overwrites nor authorizes overwriting local edits.

The maintained native adapter currently has a single coupled build boundary: one codegen directory, the iOS pod's source globs, Java package registration, shared JNI/motion library and Fabric overlay target. Any runtime-reachable spec attaches that complete adapter once, with its requiring component owners. All ten specs accompany it even when a selection reaches fewer specs at runtime. A type-only spec reference retains source declarations without activating the adapter. Per-component native pruning needs a separate source/build refactor; this graph does not claim that current native translation units can be installed independently.

Native validation reads source as data and checks all discovered specs against iOS module/component providers, actual implementation classes (including multiple providers in `CUIFormMetadata.mm`), Android manager/module factories and module metadata, generated manager delegates and the custom owned focus descriptor. It checks the pod's source/public-header declarations, Gradle codegen/prefab wiring, both CMake targets, every owned C++ translation unit against the explicit motion source list, generated overlay source globs, the provider forwarding header/function and quoted owned includes. Native inventory includes Android manifest/consumer rules, Swift, C++ headers, licenses and upstream provenance; build/test outputs are excluded. Registration comments do not satisfy checks, and native config is parsed as a static object rather than imported or executed.

The prefab package `codon-ui_react-native` and link `codon-ui_react-native::codon_motion` are hardcoded by the current overlay build. Renaming a copied native package without coherently rewriting and verifying those references produces findings. The current package/codegen/Java/pod/target identities are deliberately a supported source profile, not configurable install destinations.

`valid` means the selected source graph and supported registration checks have no findings. It does not establish generated code correctness, native compilation/linkage, Metro resolution, autolinking, an installable registry item or installed-device behavior. The static native checks do not interpret arbitrary Ruby, Groovy or CMake. Dynamic native config and nonliteral JS imports are findings; unsupported platform variants, missing imports, undeclared packages, test imports, package escapes and symlinks also prevent validation. Invalid root/package manifests reject the call. The reader assumes a quiescent checkout; it is not a snapshot transaction against concurrent filesystem changes.

Later integration must choose component entrypoints, map source paths into editable consumer ownership, adapt the native package/build identities, preserve all codegen/provider/descriptors and shared sources, incorporate hashes/owners into the existing lock and update/diff/remove safety, and run actual generated-code/Metro/native consumer checks. The graph provides source evidence for that work and performs no writes or dependency installation. Mac project detection/routing work remains a separate integration boundary.

Run `pnpm -F @codon-ui/cli test:native-source`. These focused tests also run at the end of the existing CLI test command. They cover the maintained public barrel, selected component closures, shared ownership/hashes/notices, cycles, type-only specs, escaping/symlink paths, unresolved/platform/test imports, and mutated provider/package/descriptor/CMake/Gradle/prefab registrations. No SDK, emulator, simulator or publication step is invoked.
