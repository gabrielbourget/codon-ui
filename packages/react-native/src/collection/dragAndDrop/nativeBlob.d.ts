// Exact private Flow-only SDK bridge; no global Blob augmentation or public API.
declare module "react-native/Libraries/Blob/BlobManager" {
  const manager: {
    isAvailable: boolean
    createFromOptions: (options: {
      blobId: string
      offset: number
      size: number
      type: string
    }) => Blob & { close: () => void }
    release: (blobId: string) => void
  }
  export default manager
}
