import base from "@codon-ui/shared-utils/eslint/base"

export default [
  ...base,
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**"],
  },
]
