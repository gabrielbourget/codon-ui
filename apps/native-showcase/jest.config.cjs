module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts?(x)"],
  transformIgnorePatterns: [
    "node_modules/(?!(\\.pnpm/|react-native/|@react-native/|expo/|expo-[^/]+/|@expo/|@codon-ui/|@formatjs/|test-renderer/|react-reconciler/))",
  ],
}
