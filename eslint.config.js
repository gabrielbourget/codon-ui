import base from "@amino-ui/shared-utils/eslint/base"

export default [
  ...base,
  {
    ignores: ["node_modules/**", "dist/**", ".next/**", "coverage/**", ".turbo/**"],
  },
]
