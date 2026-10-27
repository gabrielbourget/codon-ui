import { PanelFixture } from "../../../../packages/react-native/src/components/Panel/__tests__/fixtures/PanelFixture"

import { hardwareCaptureFixture } from "./hardwareTarget"

export default () => (
  <hardwareCaptureFixture.Provider>
    <PanelFixture adapter={hardwareCaptureFixture.adapter} />
  </hardwareCaptureFixture.Provider>
)
