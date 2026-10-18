import * as Alert from "@rn-primitives/alert-dialog"
import * as Dialog from "@rn-primitives/dialog"
import { PortalHost } from "@rn-primitives/portal"
import * as Select from "@rn-primitives/select"
import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"

import {
  AVAILABLE_ALERT_DIALOG_TYPES,
  Button,
  Input,
  ListBoxItem,
  Modal,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  useNativeTheme,
  type TNativeAlertDialogType,
} from "@codon-ui/react-native"

import { DefaultAlertMark } from "./DefaultMark"
import { getTrialAlertStyles, getTrialStyles } from "./trial-styles"

const TrialHostContext = createContext("missing-trial-host")
const CallerContext = createContext("host-context")
const HOST_MODES = ["portal", "window"] as const
type THostMode = (typeof HOST_MODES)[number]
type TFrameProps = {
  mode: THostMode
  id: string
  open: boolean
  covered?: boolean
  name: string
  dismissable: boolean
  systemDisabled: boolean
  close: () => void
  renderPortal: (children: ReactNode) => ReactNode
  overlay: ReactNode
  children: ReactNode
}

const Frame = ({
  mode,
  id,
  open,
  covered = false,
  name,
  dismissable,
  systemDisabled,
  close,
  renderPortal,
  overlay,
  children,
}: TFrameProps) => {
  const theme = useNativeTheme()
  const styles = getTrialStyles(theme)
  if (mode === "window")
    return (
      <Modal
        testID={`${id}-core`}
        accessibilityLabel={name}
        isOpen={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        isDismissable={dismissable}
        isKeyboardDismissDisabled={systemDisabled}
        isScrollable={false}
        customStyles={styles.panel}
        customDialogStyles={{ padding: 0 }}
      >
        {children}
      </Modal>
    )
  return renderPortal(
    <NativeThemeProvider mode={theme.mode} overrides={theme}>
      <View
        testID={`${id}-layer`}
        style={styles.full}
        pointerEvents={covered ? "none" : "auto"}
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
      >
        {overlay}
        <SafeAreaView style={styles.frame} pointerEvents="box-none">
          <KeyboardAvoidingView
            style={{ maxWidth: "100%", maxHeight: "100%", flexShrink: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            {children}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </NativeThemeProvider>,
  )
}

const ContextReadout = ({ id }: { id: string }) => {
  const theme = useNativeTheme()
  const caller = useContext(CallerContext)
  return (
    <Text testID={id}>
      Context: {caller}; theme: {theme.mode}
    </Text>
  )
}

const LocalProbe = () => {
  const [count, setCount] = useState(0)
  return (
    <>
      <Text testID="local-counter">Local count: {count}</Text>
      <Button onPress={() => setCount((value) => value + 1)}>Increment local counter</Button>
      <Input testID="local-input" accessibilityLabel="Local uncontrolled note" defaultValue="Local draft" />
    </>
  )
}

type TDialogProps = {
  mode: THostMode
  id: string
  title: string
  open: boolean
  covered?: boolean
  dismissable: boolean
  systemDisabled: boolean
  request: (open: boolean, explicit?: boolean) => void
  trigger: string
  children: ReactNode
}

const TrialDialog = ({
  mode,
  id,
  title,
  open,
  covered,
  dismissable,
  systemDisabled,
  request,
  trigger,
  children,
}: TDialogProps) => {
  const theme = useNativeTheme()
  const hostName = useContext(TrialHostContext)
  const styles = getTrialStyles(theme)
  return (
    <Dialog.Root open={open} onOpenChange={(next) => request(next)}>
      {mode === "portal" ? (
        <Dialog.Trigger asChild>
          <Button>{trigger}</Button>
        </Dialog.Trigger>
      ) : (
        <Button onPress={() => request(true, true)}>{trigger}</Button>
      )}
      <Frame
        mode={mode}
        id={id}
        open={open}
        covered={covered}
        name={title}
        dismissable={dismissable}
        systemDisabled={systemDisabled}
        close={() => request(false, true)}
        renderPortal={(content) => <Dialog.Portal hostName={hostName}>{content}</Dialog.Portal>}
        overlay={
          <Dialog.Overlay
            testID={`${id}-backdrop`}
            closeOnPress={false}
            onPress={() => {
              if (dismissable && !covered) request(false, true)
            }}
            style={styles.backdrop}
          />
        }
      >
        {open && (
          <Dialog.Content
            asChild
            testID={id}
            accessibilityLabel={title}
            style={mode === "portal" ? styles.panel : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.body}
              style={{ flexShrink: 1 }}
            >
              <Text elementType="h2" variant="h3">
                {title}
              </Text>
              <ContextReadout id={`${id}-context`} />
              {children}
              <Button onPress={() => request(false, true)}>Close {id}</Button>
            </ScrollView>
          </Dialog.Content>
        )}
      </Frame>
    </Dialog.Root>
  )
}

const OPTIONS = Array.from({ length: 48 }, (_, index) => ({
  key: index === 0 ? 0 : index === 1 ? "0" : index,
  label: index === 0 ? "Numeric zero" : index === 1 ? "String zero" : `Direction ${index}`,
}))
// Undefined selects uncontrolled ownership upstream; an internal sentinel preserves an empty controlled value.
const EMPTY_SELECTION = { value: "@codon:empty", label: "" } as const
const optionValue = (key: number | string) => `${typeof key === "number" ? "n" : "s"}:${key}`

const TrialSelect = ({
  mode,
  selected,
  onChange,
  rejectSelection,
  onOpen,
}: {
  mode: THostMode
  selected: number | string | null
  onChange: (value: number | string | null) => void
  rejectSelection: boolean
  onOpen: (open: boolean) => void
}) => {
  const theme = useNativeTheme()
  const hostName = useContext(TrialHostContext)
  const styles = getTrialStyles(theme)
  const trigger = useRef<Select.TriggerRef>(null)
  const list = useRef<ScrollView>(null)
  const [open, setOpen] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [controlledRequests, setControlledRequests] = useState(0)
  const entry = OPTIONS.find((option) => option.key === selected)
  const value = entry ? { value: optionValue(entry.key), label: entry.label } : EMPTY_SELECTION
  const select = (next: Select.Option) => {
    setControlledRequests((count) => count + 1)
    const choice = OPTIONS.find((option) => optionValue(option.key) === next?.value)
    if (!rejectSelection && choice) onChange(choice.key)
  }
  const content = (
    <Select.Content
      asChild
      testID="trial-select"
      accessibilityLabel="Trial directions"
      disablePositioningStyle
      style={mode === "portal" ? { ...styles.page, ...styles.full } : { flex: 1 }}
    >
      <SafeAreaView style={styles.page}>
        <ScrollView
          ref={list}
          testID="trial-select-scroll"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.body}
        >
          <Text elementType="h2" variant="h3">
            Trial directions
          </Text>
          <ContextReadout id="select-context" />
          <Text testID="selection-requests">Selection requests: {controlledRequests}</Text>
          <Button onPress={() => trigger.current?.close()}>Close trial selection</Button>
          {OPTIONS.map((option) => (
            <Select.Item
              key={optionValue(option.key)}
              value={optionValue(option.key)}
              label={option.label}
              disabled={option.key === 7}
              closeOnPress={false}
              asChild
              onPress={() => trigger.current?.close()}
            >
              <ListBoxItem
                id={option.key}
                textValue={option.label}
                isSelected={option.key === selected}
                isDisabled={option.key === 7}
                testID={`option-${optionValue(option.key)}`}
              />
            </Select.Item>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Select.Content>
  )
  return (
    <Select.Root
      value={value}
      onValueChange={select}
      disabled={disabled}
      onOpenChange={(next) => {
        setOpen(next)
        onOpen(next)
      }}
    >
      <Text testID="selected-value">Selection: {selected === null ? "empty" : `${typeof selected}:${selected}`}</Text>
      <Text testID="value-requests">Value requests: {controlledRequests}</Text>
      <Button onPress={() => setDisabled((value) => !value)}>Toggle selection disabled</Button>
      <Select.Trigger asChild ref={trigger} disabled={disabled}>
        <Button isDisabled={disabled} accessibilityLabel="Open trial selection">
          {entry?.label ?? "Choose direction"}
        </Button>
      </Select.Trigger>
      {mode === "portal" ? (
        <Select.Portal hostName={hostName}>
          <View style={styles.full}>
            <Select.Overlay style={styles.backdrop} />
            {content}
          </View>
        </Select.Portal>
      ) : (
        <Modal
          accessibilityLabel="Trial directions"
          testID="trial-select-core"
          isOpen={open}
          onOpenChange={(next) => {
            if (!next) trigger.current?.close()
          }}
          isScrollable={false}
          width="100%"
          height="100%"
          customStyles={{ borderRadius: 0 }}
          customDialogStyles={{ padding: 0, flex: 1 }}
        >
          {open && content}
        </Modal>
      )}
    </Select.Root>
  )
}

const TrialAlert = ({
  mode,
  open,
  onOpen,
  action,
  long,
  systemDisabled,
  dismissable,
  type,
}: {
  mode: THostMode
  open: boolean
  onOpen: (next: boolean) => void
  action: (kind: "confirm" | "cancel") => void
  long: boolean
  systemDisabled: boolean
  dismissable: boolean
  type: TNativeAlertDialogType
}) => {
  const theme = useNativeTheme()
  const hostName = useContext(TrialHostContext)
  const styles = getTrialStyles(theme)
  const alertStyles = getTrialAlertStyles(theme, type)
  const { color } = alertStyles
  const actionClose = useRef(false)
  const [note, setNote] = useState("")
  const request = (next: boolean) => {
    const explicit = actionClose.current
    actionClose.current = false
    if (!next && systemDisabled && !explicit) return
    onOpen(next)
  }
  const business = (kind: "confirm" | "cancel") => {
    action(kind)
    actionClose.current = true
    queueMicrotask(() => {
      actionClose.current = false
    })
  }
  const body = long
    ? "Veuillez vérifier l’ensemble des informations avant de confirmer cette modification. Le contenu et les actions doivent rester accessibles avec un texte agrandi et le clavier affiché. ".repeat(
        4,
      ) + "Fin du contenu complet."
    : "Review this isolated change."
  const confirm = long ? "Confirmer cette modification après avoir vérifié l’ensemble des informations" : "Confirm"
  const cancel = long ? "Annuler cette modification et revenir aux informations précédentes" : "Cancel"
  return (
    <Alert.Root open={open} onOpenChange={request}>
      {mode === "portal" ? (
        <Alert.Trigger asChild>
          <Button>Open trial alert</Button>
        </Alert.Trigger>
      ) : (
        <Button onPress={() => onOpen(true)}>Open trial alert</Button>
      )}
      <Frame
        mode={mode}
        id="trial-alert"
        open={open}
        name="Trial confirmation"
        dismissable={dismissable}
        systemDisabled={systemDisabled}
        close={() => onOpen(false)}
        renderPortal={(content) => <Alert.Portal hostName={hostName}>{content}</Alert.Portal>}
        overlay={
          <Alert.Overlay asChild>
            <View style={styles.full}>
              <Button
                testID="alert-backdrop"
                accessibilityLabel="Alert backdrop"
                customStyles={styles.backdrop}
                onPress={() => {
                  if (dismissable) onOpen(false)
                }}
              />
            </View>
          </Alert.Overlay>
        }
      >
        {open && (
          <Alert.Content
            asChild
            testID="trial-alert"
            accessibilityLabel="Trial confirmation"
            style={mode === "portal" ? styles.panel : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ gap: theme.spacing.unit * 4 }}
              style={{ flexShrink: 1 }}
            >
              <View style={alertStyles.ribbon} />
              <View style={{ ...styles.body, gap: theme.spacing.unit * 4 }}>
                <View
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={alertStyles.icon}
                >
                  <DefaultAlertMark type={type} color={color} />
                </View>
                <Alert.Title asChild>
                  <Text elementType="h2" variant="b8" fontWeight="bold">
                    Confirm trial change
                  </Text>
                </Alert.Title>
                <Alert.Description asChild>
                  <Text>{body}</Text>
                </Alert.Description>
                <ContextReadout id="alert-context" />
                <Input testID="alert-note" accessibilityLabel="Alert note" value={note} onChangeText={setNote} />
                <View testID="alert-actions" style={styles.actions}>
                  <Alert.Cancel asChild>
                    <Button
                      accessibilityLabel="Cancel trial confirmation"
                      transparent
                      raised={false}
                      customStyles={{ flexShrink: 1, maxWidth: "100%" }}
                      onPress={() => business("cancel")}
                    >
                      <Text
                        color={color}
                        fontWeight="bold"
                        customStyles={{ flexShrink: 1, textAlign: "center", textDecorationLine: "underline" }}
                      >
                        {cancel}
                      </Text>
                    </Button>
                  </Alert.Cancel>
                  <Alert.Action asChild>
                    <Button
                      accessibilityLabel="Confirm trial confirmation"
                      color={color}
                      raised={false}
                      customStyles={{ flexShrink: 1, maxWidth: "100%" }}
                      onPress={() => business("confirm")}
                    >
                      <Text
                        color={theme.colors.controlSelectedForeground}
                        customStyles={{ flexShrink: 1, textAlign: "center" }}
                      >
                        {confirm}
                      </Text>
                    </Button>
                  </Alert.Action>
                </View>
              </View>
            </ScrollView>
          </Alert.Content>
        )}
      </Frame>
    </Alert.Root>
  )
}

const Scene = ({
  onOverlayChange,
  toggleTheme,
}: {
  onOverlayChange: (open: boolean) => void
  toggleTheme: () => void
}) => {
  const theme = useNativeTheme()
  const styles = getTrialStyles(theme)
  const [mode, setMode] = useState<THostMode>("portal")
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  const [alert, setAlert] = useState(false)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [selected, setSelected] = useState<number | string | null>(0)
  const [rejectSelection, setRejectSelection] = useState(false)
  const [rejectClose, setRejectClose] = useState(false)
  const [systemDisabled, setSystemDisabled] = useState(false)
  const [dismissable, setDismissable] = useState(true)
  const [long, setLong] = useState(false)
  const [alertType, setAlertType] = useState<TNativeAlertDialogType>("info")
  const [draft, setDraft] = useState("Owner draft")
  const [confirmations, setConfirmations] = useState(0)
  const [cancellations, setCancellations] = useState(0)
  const [requests, setRequests] = useState(0)
  const requestParent = (next: boolean, explicit = false) => {
    if (!next && (child || alert || selectionOpen || (!explicit && systemDisabled))) return
    if (!next) setRequests((count) => count + 1)
    if (next || !rejectClose) {
      setParent(next)
      onOverlayChange(next && mode === "portal")
    }
  }
  return (
    <>
      <ScrollView
        testID="trial-root-scroll"
        style={styles.page}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h2" elementType="h1">
          RN Primitives compatibility trial
        </Text>
        <Text testID="trial-configuration">
          Host: {mode}; reject values: {String(rejectSelection)}; reject close: {String(rejectClose)}; system blocked:{" "}
          {String(systemDisabled)}; dismissable: {String(dismissable)}; long: {String(long)}
        </Text>
        <Text testID="trial-state">
          Confirms: {confirmations}; cancels: {cancellations}; requests: {requests}; selection:{" "}
          {selected === null ? "empty" : `${typeof selected}:${selected}`}
        </Text>
        <Button
          onPress={() => {
            if (!parent && !alert)
              setMode((current) => HOST_MODES.find((nextMode) => nextMode !== current) ?? HOST_MODES[0])
          }}
        >
          Toggle host arrangement
        </Button>
        <Button onPress={() => setRejectSelection((value) => !value)}>Toggle rejected values</Button>
        <Button onPress={() => setRejectClose((value) => !value)}>Toggle rejected closure</Button>
        <Button onPress={() => setSystemDisabled((value) => !value)}>Toggle system guard</Button>
        <Button onPress={() => setDismissable((value) => !value)}>Toggle backdrop guard</Button>
        <Button onPress={() => setLong((value) => !value)}>Toggle long content</Button>
        <Button
          onPress={() =>
            setAlertType(
              (current) =>
                AVAILABLE_ALERT_DIALOG_TYPES[
                  (AVAILABLE_ALERT_DIALOG_TYPES.indexOf(current) + 1) % AVAILABLE_ALERT_DIALOG_TYPES.length
                ]!,
            )
          }
        >
          Cycle trial alert type
        </Button>
        <Button onPress={() => setSelected(null)}>Clear controlled value</Button>
        <Button onPress={() => setSelected(42)}>Set offscreen controlled value</Button>
        <CallerContext.Provider value="caller-local">
          <TrialDialog
            mode={mode}
            id="trial-parent"
            title="Trial parent dialog"
            open={parent}
            covered={child || alert || selectionOpen}
            dismissable={dismissable}
            systemDisabled={systemDisabled}
            request={requestParent}
            trigger="Open trial parent"
          >
            <Text testID="parent-state">
              Parent draft: {draft}; confirms: {confirmations}; selection:{" "}
              {selected === null ? "empty" : `${typeof selected}:${selected}`}
            </Text>
            <LocalProbe />
            <Button onPress={toggleTheme}>Toggle overlay theme</Button>
            <Input
              testID="owner-input"
              accessibilityLabel="Owner controlled note"
              value={draft}
              onChangeText={setDraft}
            />
            <Button onPress={() => setRejectClose((value) => !value)}>Toggle parent close rejection</Button>
            <TrialSelect
              mode={mode}
              selected={selected}
              onChange={setSelected}
              rejectSelection={rejectSelection}
              onOpen={setSelectionOpen}
            />
            <TrialAlert
              mode={mode}
              open={alert}
              onOpen={(next) => {
                setAlert(next)
                if (!next) setRequests((value) => value + 1)
              }}
              action={(kind) => {
                if (kind === "confirm") setConfirmations((count) => count + 1)
                else setCancellations((count) => count + 1)
              }}
              long={long}
              systemDisabled={systemDisabled}
              dismissable={dismissable}
              type={alertType}
            />
            <TrialDialog
              mode={mode}
              id="trial-child"
              title="Trial child dialog"
              open={child}
              dismissable={dismissable}
              systemDisabled={systemDisabled}
              request={(next, explicit = false) => {
                if (next || explicit || !systemDisabled) setChild(next)
              }}
              trigger="Open trial child"
            >
              <Text>Parent content must remain mounted while this child is active.</Text>
              <Button
                onPress={() => {
                  setChild(false)
                  setAlert(false)
                  setParent(false)
                  onOverlayChange(false)
                }}
              >
                Close entire trial chain
              </Button>
            </TrialDialog>
          </TrialDialog>
        </CallerContext.Provider>
        <Text testID="trial-footer">End of trial controls</Text>
      </ScrollView>
    </>
  )
}

export const App = () => {
  const [dark, setDark] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const hostName = `codon-primitive-trial-${useId()}`
  return (
    <SafeAreaProvider>
      <NativeThemeProvider mode={dark ? "dark" : "light"}>
        <NativeOverlayProvider>
          <TrialHostContext.Provider value={hostName}>
            <View
              style={{ flex: 1 }}
              accessibilityElementsHidden={overlayOpen}
              importantForAccessibility={overlayOpen ? "no-hide-descendants" : "auto"}
            >
              <SafeAreaView style={{ flex: 1 }}>
                <Button onPress={() => setDark((value) => !value)}>Toggle trial theme</Button>
                <Scene onOverlayChange={setOverlayOpen} toggleTheme={() => setDark((value) => !value)} />
              </SafeAreaView>
            </View>
            <PortalHost name={hostName} />
          </TrialHostContext.Provider>
        </NativeOverlayProvider>
      </NativeThemeProvider>
    </SafeAreaProvider>
  )
}
