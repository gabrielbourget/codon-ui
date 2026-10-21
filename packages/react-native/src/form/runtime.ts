import FormDocument from "../input/specs/NativeCUIFormDocument"

export const readNativeFormDocument = (
  request: Readonly<{ target: number; requestId: string; [key: string]: unknown }>,
) => {
  if (!FormDocument) return Promise.reject(new Error("native-form-document-unavailable"))
  return FormDocument.getSnapshot(JSON.stringify(request))
}
