import nextPlugin from "@next/eslint-plugin-next"
import base from "@codon-ui/shared-utils/eslint/base"

export default [
  ...base,
  {
    ignores: ["node_modules/**", ".next/**", "dist/**", "coverage/**"],
  },
  {
    name: "codon-ui:web-node-config-files",
    files: ["*.config.{js,cjs,mjs}", "next.config.{js,cjs,mjs}", "postcss.config.{js,cjs,mjs}"],
    languageOptions: {
      globals: {
        module: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    name: "codon-ui:web-next",
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
]
