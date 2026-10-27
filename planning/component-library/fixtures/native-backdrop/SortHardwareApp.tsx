import { SafeAreaProvider } from "react-native-safe-area-context"

import { SortAndFilterPanelFixture } from "../../../../packages/react-native/src/components/SortAndFilterPanel/__tests__/fixtures/PanelFixture"

import { hardwareCaptureFixture } from "./hardwareTarget"

export default () => (
  <SafeAreaProvider>
    <hardwareCaptureFixture.Provider>
      <SortAndFilterPanelFixture adapter={hardwareCaptureFixture.adapter} />
    </hardwareCaptureFixture.Provider>
  </SafeAreaProvider>
)
