import { useState } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"

import {
  Button,
  Modal,
  NativeBackdropHost,
  NativeOverlayProvider,
  Text,
  type TNativeBackdropAdapter,
} from "../../../.."

// Routing fixture only. The caller must provide a real renderer before native blur acceptance.
export const NativeBackdropFixture = ({ adapter }: { adapter: TNativeBackdropAdapter }) => {
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  const [blur, setBlur] = useState(true)
  return (
    <SafeAreaProvider>
      <NativeOverlayProvider backdropAdapter={adapter}>
        <NativeBackdropHost testID="backdrop-fixture-root" style={{ flex: 1 }}>
          <Text>Parent-window source content</Text>
          <Button onPress={() => setParent(true)}>Open parent</Button>
          <Modal
            testID="backdrop-parent"
            aria-label="Parent"
            isOpen={parent}
            onOpenChange={setParent}
            overlayBlur={blur}
          >
            <Text>Retained parent content</Text>
            <Button onPress={() => setChild(true)}>Open nested child</Button>
            <Button onPress={() => setBlur(!blur)}>Toggle parent blur</Button>
            <Button onPress={() => setParent(false)}>Close parent</Button>
            <Modal testID="backdrop-child" aria-label="Child" isOpen={child} onOpenChange={setChild} overlayBlur>
              <Text>Child samples the parent window</Text>
              <Button onPress={() => setChild(false)}>Close child</Button>
            </Modal>
          </Modal>
        </NativeBackdropHost>
      </NativeOverlayProvider>
    </SafeAreaProvider>
  )
}
