import { Linking } from "react-native"

export const openNativeLink = (href: string, report: (error: unknown) => void) => {
  try {
    void Linking.openURL(href).catch(report)
  } catch (error) {
    report(error)
  }
}
