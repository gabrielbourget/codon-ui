import { SafeAreaProvider } from "react-native-safe-area-context"

import { SortAndFilterPanelFixture } from "../../../../packages/react-native/src/components/SortAndFilterPanel/__tests__/fixtures/PanelFixture"

export default () => (
  <SafeAreaProvider>
    <SortAndFilterPanelFixture />
  </SafeAreaProvider>
)
