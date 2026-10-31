import { SafeAreaProvider } from "react-native-safe-area-context"

import { TableFixture } from "../../../../packages/react-native/src/components/Table/__tests__/fixtures/TableFixture"

export default () => (
  <SafeAreaProvider>
    <TableFixture />
  </SafeAreaProvider>
)
