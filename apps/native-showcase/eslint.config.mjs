import base from "@codon-ui/shared-utils/eslint/base"

export default [
  { ignores: ["node_modules/**", "dist/**", "coverage/**", ".expo/**", "ios/**", "android/**"] },
  ...base,
  {
    files: ["*.config.cjs"],
    languageOptions: { globals: { module: "readonly", require: "readonly", __dirname: "readonly" } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  { files: ["**/*.{ts,tsx}"], rules: { "no-undef": "off" } },
]
