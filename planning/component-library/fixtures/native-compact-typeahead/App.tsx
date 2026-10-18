import { SafeAreaProvider } from "react-native-safe-area-context"

import { CompactTypeaheadFixture } from "../../../../packages/react-native/src/components/CompactTypeaheadSearch/__tests__/fixtures/CompactTypeaheadFixture"

export default () => (
  <SafeAreaProvider>
    <CompactTypeaheadFixture />
  </SafeAreaProvider>
)
