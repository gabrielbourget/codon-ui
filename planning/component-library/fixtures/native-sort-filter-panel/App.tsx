import { SafeAreaProvider } from "react-native-safe-area-context"

import { DefaultNativeBackdropAdapter } from "../../../../packages/react-native/src"
import { SortAndFilterPanelFixture } from "../../../../packages/react-native/src/components/SortAndFilterPanel/__tests__/fixtures/PanelFixture"

export default () => (
  <SafeAreaProvider>
    <SortAndFilterPanelFixture adapter={DefaultNativeBackdropAdapter} />
  </SafeAreaProvider>
)
