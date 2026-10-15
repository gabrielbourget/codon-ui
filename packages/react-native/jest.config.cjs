module.exports = {
  preset: "@react-native/jest-preset",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts?(x)"],
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm/|react-native/|@react-native/|test-renderer/|react-reconciler/))",
  ],
}
