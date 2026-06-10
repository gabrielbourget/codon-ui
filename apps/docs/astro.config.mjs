import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

export default defineConfig({
  integrations: [
    starlight({
      title: "Codon UI Docs",
      description: "Component-library foundation, registry, and extraction planning docs for Codon UI.",
      disable404Route: true,
      customCss: ["./src/styles/amino-theme.css"],
      components: {
        Head: "./src/components/DocsHead.astro",
        Search: "./src/components/DocsSearch.astro",
        TwoColumnContent: "./src/components/DocsTwoColumnContent.astro",
      },
      sidebar: [
        { label: "Overview", link: "/" },
        {
          label: "Foundation",
          items: ["foundation/monorepo", "foundation/verification", "foundation/extraction-boundaries"],
        },
        {
          label: "Component Library",
          items: [
            "component-library/source-graph",
            "component-library/adapter-boundaries",
            "component-library/consumer-proofs",
          ],
        },
        {
          label: "Packages",
          items: ["packages/react"],
        },
        {
          label: "Registry",
          items: ["registry/contracts", "registry/ingest", "registry/local-snapshots"],
        },
        {
          label: "CLI",
          items: ["cli/baseline-contract", "cli/consumer-lifecycle", "cli/fixture-evidence"],
        },
      ],
    }),
  ],
})
