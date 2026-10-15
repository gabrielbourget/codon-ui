import * as Alert from "@rn-primitives/alert-dialog"
import * as Dialog from "@rn-primitives/dialog"
import * as Select from "@rn-primitives/select"

export const controlledPopup = <Select.Root open={false} onOpenChange={(next: boolean) => void next} />
export const initialPopup = <Select.Root defaultOpen />
export const hostManagedDialog = <Dialog.Content nativeHostManaged />
export const hostManagedAlert = <Alert.Content nativeHostManaged />
export const hostManagedSelect = <Select.Content nativeHostManaged />

// @ts-expect-error Private popup ownership accepts a boolean, not a string.
export const invalidPopup = <Select.Root open="false" />
// @ts-expect-error Codon keeps numeric keys in its adapter rather than weakening the upstream value type.
export const numericPrimitiveValue = <Select.Root value={0} />
// @ts-expect-error Codon's empty-value sentinel keeps null out of the upstream selected-value contract.
export const nullPrimitiveValue = <Select.Root value={null} />
// @ts-expect-error The private host-mode flag is boolean.
export const invalidHostMode = <Dialog.Content nativeHostManaged="yes" />
