import type { ComponentProps } from "react"
import { Text, View } from "react-native"

import type { NativeFocusHost } from "../../input/NativeFocusView"

export const nativeTableDescriptionProps = (host: ComponentProps<typeof NativeFocusHost>, id: string | undefined) =>
  id ? { nativeDescribedBy: [id, ...(host.nativeDescribedBy ?? [])] } : {}

export const NativeTableDescription = ({ id, text }: { id: string; text: string | undefined }) =>
  text ? (
    <View
      nativeID={id}
      accessible={false}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
    >
      <Text accessible={false}>{text}</Text>
    </View>
  ) : null
