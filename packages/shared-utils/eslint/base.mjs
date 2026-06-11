import js from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import tseslint from "typescript-eslint"

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    name: "codon-ui:shared-base",
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      import: await import("eslint-plugin-import"),
    },
    rules: {
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "never"],
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-restricted-imports": "off",

      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],

      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [
            { pattern: "@/**", group: "internal", position: "after" },
            { pattern: "@src/**", group: "internal", position: "after" },
            { pattern: "@codon-ui/**", group: "internal", position: "after" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
            orderImportKind: "ignore",
          },
        },
      ],
    },
  },

  eslintConfigPrettier,
]
