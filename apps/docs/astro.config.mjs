import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"

export default defineConfig({
  integrations: [
    starlight({
      title: "Amino UI Docs",
      description: "Component-library foundation, registry, and extraction planning docs for Amino UI.",
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
          label: "Packages",
          items: ["packages/react"],
        },
        {
          label: "Registry",
          items: ["registry/contracts", "registry/ingest"],
        },
        {
          label: "CLI",
          items: ["cli/baseline-contract"],
        },
      ],
    }),
  ],
})
