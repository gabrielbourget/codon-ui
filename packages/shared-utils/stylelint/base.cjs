const stylelintConfigStandard = require.resolve("stylelint-config-standard")
const stylelintConfigStandardScss = require.resolve("stylelint-config-standard-scss")

module.exports = {
  extends: [stylelintConfigStandard],
  overrides: [
    {
      files: ["**/*.scss"],
      customSyntax: "postcss-scss",
      extends: [stylelintConfigStandardScss],
    },
  ],
  rules: {
    "color-function-notation": null,
    "custom-property-empty-line-before": null,
    "custom-property-pattern": "^.*$",
    "declaration-block-no-redundant-longhand-properties": null,
    "declaration-empty-line-before": null,
    "font-family-no-missing-generic-family-keyword": null,
    "no-descending-specificity": null,
    "property-no-vendor-prefix": null,
    "rule-empty-line-before": null,
    "selector-class-pattern": null,
    "selector-id-pattern": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["global"],
      },
    ],
  },
}
