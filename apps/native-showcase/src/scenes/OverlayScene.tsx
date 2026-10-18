import { Component, createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import type { View } from "react-native"
import { View as NativeView } from "react-native"

import {
  AlertDialog,
  AVAILABLE_ALERT_DIALOG_TYPES,
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Input,
  Modal,
  Select,
  Text,
} from "@codon-ui/react-native"

const DraftContext = createContext("missing")
const ContextProbe = ({ identity = "overlay-context" }: { identity?: string }) => (
  <Text testID={identity}>Context: {useContext(DraftContext)}</Text>
)
const ReplaceOnMount = ({ replace }: { replace: () => void }) => {
  useLayoutEffect(() => {
    replace()
  }, [])
  return <Text>Replacing an in-flight presentation.</Text>
}
const LocalBodyProbe = () => {
  const [count, setCount] = useState(0)
  const [raw, setRaw] = useState("local body draft")
  return (
    <NativeView style={{ gap: 10 }}>
      <Text testID="overlay-local-state">
        Local body count: {count}. Local raw: {raw}.
      </Text>
      <Button onPress={() => setCount((value) => value + 1)}>Increase local overlay count</Button>
      <Input
        testID="overlay-local-input"
        accessibilityLabel="Local uncontrolled overlay draft"
        defaultValue="local body draft"
        onChangeText={setRaw}
      />
    </NativeView>
  )
}

class DiagnosticBoundary extends Component<{ children: ReactNode; dismiss: () => void }, { error: string | null }> {
  override state: { error: string | null } = { error: null }
  static getDerivedStateFromError = (error: Error) => ({ error: error.message })
  override render = () =>
    this.state.error ? (
      <NativeView style={{ gap: 10 }}>
        <Text testID="overlay-diagnostic">{this.state.error}</Text>
        <Button onPress={this.props.dismiss}>Dismiss overlay diagnostic</Button>
      </NativeView>
    ) : (
      this.props.children
    )
}

const LONG_TITLE =
  "Vérifiez les paramètres de cette configuration avant de confirmer les modifications et de poursuivre."
const LONG_BODY =
  "Les modifications restent dans cette démonstration locale. Vérifiez chaque option, conservez votre brouillon et choisissez une action lorsque vous êtes prêt. This longer bilingual copy must remain reachable without truncation or a font-scale cap. "

export const OverlayScene = ({ toggleTheme = () => undefined }: { toggleTheme?: () => void }) => {
  const [parent, setParent] = useState(false)
  const [child, setChild] = useState(false)
  const [alert, setAlert] = useState(false)
  const [starter, setStarter] = useState(false)
  const [draft, setDraft] = useState("retained draft")
  const [note, setNote] = useState("confirmation note")
  const [selected, setSelected] = useState<string | number | null>("north")
  const [requests, setRequests] = useState(0)
  const [alertRequests, setAlertRequests] = useState(0)
  const [confirms, setConfirms] = useState(0)
  const [cancels, setCancels] = useState(0)
  const [echo, setEcho] = useState(true)
  const [mounted, setMounted] = useState(true)
  const [pending, setPending] = useState(false)
  const [handoffs, setHandoffs] = useState(0)
  const [dismissable, setDismissable] = useState(true)
  const [keyboardBlocked, setKeyboardBlocked] = useState(false)
  const [orthogonal, setOrthogonal] = useState(false)
  const [orderIndex, setOrderIndex] = useState(-1)
  const [styled, setStyled] = useState(false)
  const [longCopy, setLongCopy] = useState(false)
  const [alertTypeIndex, setAlertTypeIndex] = useState(0)
  const [iconIndex, setIconIndex] = useState(0)
  const [cancelVisible, setCancelVisible] = useState(true)
  const [restoreVisible, setRestoreVisible] = useState(true)
  const [diagnostic, setDiagnostic] = useState(false)
  const trigger = useRef<View>(null)
  const childTrigger = useRef<View>(null)
  const alertTrigger = useRef<View>(null)
  const geometry = orthogonal ? "orthogonal" : "rounded"
  const type = AVAILABLE_ALERT_DIALOG_TYPES[alertTypeIndex]
  const closeParent = () => {
    setParent(false)
    setChild(false)
    setAlert(false)
  }
  const reset = () => {
    closeParent()
    setStarter(false)
    setPending(false)
    setMounted(true)
    setDraft("retained draft")
    setNote("confirmation note")
    setSelected("north")
    setRequests(0)
    setAlertRequests(0)
    setConfirms(0)
    setCancels(0)
    setEcho(true)
    setHandoffs(0)
    setDismissable(true)
    setKeyboardBlocked(false)
    setOrthogonal(false)
    setOrderIndex(-1)
    setStyled(false)
    setLongCopy(false)
    setAlertTypeIndex(0)
    setIconIndex(0)
    setCancelVisible(true)
    setRestoreVisible(true)
    setDiagnostic(false)
  }
  const action = (label: string, press: () => void) => (
    <Button accessibilityLabel={label} onPress={press}>
      {label}
    </Button>
  )
  return (
    <DraftContext.Provider value="local caller context">
      <NativeView style={{ gap: 12 }}>
        <Text elementType="h2">Native overlay composition</Text>
        <Text testID="overlay-state">
          Parent: {String(parent)}. Child: {String(child)}. Draft: {draft}. Selected: {selected}. Close requests:{" "}
          {requests}. Parent {echo ? "echoes" : "declines"}.
        </Text>
        <Text testID="overlay-configuration">
          Backdrop {dismissable ? "enabled" : "blocked"}. System {keyboardBlocked ? "blocked" : "enabled"}. Geometry:{" "}
          {geometry}. Order: {AVAILABLE_THEMING_ORDER_CODES[orderIndex] ?? "none"}. Alert: {type}. Copy:{" "}
          {longCopy ? "long French" : "short"}. Icon: {iconIndex}. Cancel: {String(cancelVisible)}.
        </Text>
        <Button
          ref={trigger}
          onPress={() => {
            setMounted(true)
            setParent(true)
          }}
        >
          Open parent dialog
        </Button>
        {action("Open starter dialog", () => setStarter(true))}
        {action("Toggle overlay parent echo", () => setEcho((value) => !value))}
        {action("Toggle overlay owner", () => setMounted((value) => !value))}
        {action("Replace pending presentation", () => setPending(true))}
        <Text testID="overlay-handoffs">Pending handoffs: {handoffs}.</Text>
        {action("Toggle overlay backdrop guard", () => setDismissable((value) => !value))}
        {action("Toggle overlay system guard", () => setKeyboardBlocked((value) => !value))}
        {action("Toggle overlay geometry", () => setOrthogonal((value) => !value))}
        {action("Next overlay order", () =>
          setOrderIndex((value) => (value === AVAILABLE_THEMING_ORDER_CODES.length - 1 ? -1 : value + 1)),
        )}
        {action("Toggle overlay custom styles", () => setStyled((value) => !value))}
        {action("Toggle long overlay copy", () => setLongCopy((value) => !value))}
        {action("Next alert type", () =>
          setAlertTypeIndex((value) => (value + 1) % AVAILABLE_ALERT_DIALOG_TYPES.length),
        )}
        {action("Next alert icon", () => setIconIndex((value) => (value + 1) % 3))}
        {action("Toggle alert cancellation", () => setCancelVisible((value) => !value))}
        {action("Restore nested focus target", () => setRestoreVisible(true))}
        {action("Run competing-window diagnostic", () => setDiagnostic(true))}
        {action("Reset overlay examples", reset)}
        {diagnostic && (
          <DiagnosticBoundary dismiss={() => setDiagnostic(false)}>
            <Modal accessibilityLabel="Competing root one" isOpen />
            <Modal accessibilityLabel="Competing root two" isOpen />
          </DiagnosticBoundary>
        )}
        <Modal testID="overlay-pending" accessibilityLabel="Pending presentation" isOpen={pending}>
          <ReplaceOnMount
            replace={() => {
              setPending(false)
              setMounted(true)
              setParent(true)
              setHandoffs((count) => count + 1)
            }}
          />
        </Modal>
        {starter && (
          <Modal
            accessibilityLabel="Starter example"
            defaultOpen
            onOpenChange={(open) => {
              if (!open) setStarter(false)
            }}
            geometry={geometry}
            titleText={longCopy ? LONG_TITLE : undefined}
            closeButtonText={longCopy ? "Fermer cette démonstration et revenir à la configuration" : undefined}
          />
        )}
        {mounted && (
          <Modal
            testID="overlay-parent"
            accessibilityLabel="Parent editing dialog"
            isOpen={parent}
            onOpenChange={(next) => {
              setRequests((count) => count + 1)
              if (echo) setParent(next)
            }}
            restoreFocusRef={trigger}
            isDismissable={dismissable}
            isKeyboardDismissDisabled={keyboardBlocked}
            geometry={geometry}
            order={AVAILABLE_THEMING_ORDER_CODES[orderIndex]}
            width={styled ? "90%" : undefined}
            customStyles={styled ? { borderWidth: 2, borderColor: "teal" } : undefined}
            style={styled ? { borderWidth: 3 } : undefined}
            customDialogStyles={styled ? { padding: 12 } : undefined}
          >
            <Text elementType="h2">{longCopy ? LONG_TITLE : "Parent editing dialog"}</Text>
            <ContextProbe />
            <Text testID="overlay-parent-state">
              Backdrop {dismissable ? "enabled" : "blocked"}. System {keyboardBlocked ? "blocked" : "enabled"}. Parent{" "}
              {echo ? "echoes" : "declines"}.
            </Text>
            {action("Toggle active backdrop guard", () => setDismissable((value) => !value))}
            {action("Toggle active system guard", () => setKeyboardBlocked((value) => !value))}
            {action("Toggle active close echo", () => setEcho((value) => !value))}
            {action("Toggle overlay theme", toggleTheme)}
            <Input testID="overlay-draft" accessibilityLabel="Overlay draft" value={draft} onChangeText={setDraft} />
            <LocalBodyProbe />
            {restoreVisible && (
              <Button ref={childTrigger} onPress={() => setChild(true)}>
                Open nested dialog
              </Button>
            )}
            {!restoreVisible && action("Restore active nested target", () => setRestoreVisible(true))}
            <Select
              testID="overlay-select"
              accessibilityLabel="Nested direction"
              closeLabel="Close nested choices"
              items={[
                { id: "north", name: "North" },
                { id: "south", name: "South" },
              ]}
              getKey={(item) => item.id}
              getTextValue={(item) => item.name}
              value={selected}
              onChange={setSelected}
            />
            <Button ref={alertTrigger} onPress={() => setAlert(true)}>
              Open alert confirmation
            </Button>
            {action("Close entire chain", closeParent)}
            {longCopy && <Text testID="overlay-long-body">{LONG_BODY.repeat(4)}</Text>}
            <Modal
              testID="overlay-child"
              accessibilityLabel="Child confirmation dialog"
              isOpen={child}
              onOpenChange={setChild}
              restoreFocusRef={childTrigger}
              geometry={geometry}
            >
              <Text elementType="h2">Child confirmation dialog</Text>
              <ContextProbe identity="overlay-child-context" />
              <Text>Parent-local drafts, state and scroller remain mounted underneath.</Text>
              {action("Close nested dialog", () => setChild(false))}
              {action("Remove parent focus target", () => setRestoreVisible(false))}
              {action("Close chain from child", closeParent)}
              {action("Unmount chain from child", () => setMounted(false))}
            </Modal>
            <AlertDialog
              testID="overlay-alert"
              accessibilityLabel="Review overlay changes"
              isOpen={alert}
              onOpenChange={(next) => {
                setAlertRequests((count) => count + 1)
                if (echo) setAlert(next)
              }}
              type={type}
              titleText={longCopy ? LONG_TITLE : "Confirm the demonstration"}
              bodyText={longCopy ? LONG_BODY.repeat(4) : "This changes only local demonstration counters."}
              labels={{
                cancelActionButton: longCopy
                  ? "Annuler ces modifications et revenir à la configuration précédente"
                  : "Cancel",
                cancelActionButtonAriaLabel: "Cancel overlay confirmation",
                confirmActionButton: longCopy
                  ? "Confirmer ces modifications et poursuivre l’enregistrement de la configuration"
                  : "Confirm",
                confirmActionButtonAriaLabel: "Confirm overlay confirmation",
              }}
              confirmActionBtnText={styled ? "Continue" : undefined}
              cancelAction={() => setCancels((value) => value + 1)}
              confirmAction={() => setConfirms((value) => value + 1)}
              showCancelAction={cancelVisible}
              AlertIcon={iconIndex === 1 ? null : iconIndex === 2 ? <Text fontWeight="bold">C</Text> : undefined}
              geometry={geometry}
              isDismissable={dismissable}
              isKeyboardDismissDisabled={keyboardBlocked}
              restoreFocusRef={alertTrigger}
            >
              <ContextProbe identity="overlay-alert-context" />
              <Text testID="overlay-alert-state">
                Type: {type}. Confirms: {confirms}. Cancels: {cancels}. Requests: {alertRequests}. Parent{" "}
                {echo ? "echoes" : "declines"}.
              </Text>
              {action("Next active alert type", () =>
                setAlertTypeIndex((value) => (value + 1) % AVAILABLE_ALERT_DIALOG_TYPES.length),
              )}
              <Input
                testID="overlay-alert-note"
                accessibilityLabel="Confirmation note"
                value={note}
                onChangeText={setNote}
              />
              {action("Toggle confirmation close echo", () => setEcho((value) => !value))}
              {action("Unmount alert owner", () => setMounted(false))}
            </AlertDialog>
          </Modal>
        )}
        <Text testID="overlay-action-state">
          Confirms: {confirms}. Cancels: {cancels}. Requests: {alertRequests}. Note: {note}.
        </Text>
        <Text testID="overlay-footer">
          One active leaf owns dismissal. Local body state resets after complete closure. Physical screen-reader/touch
          and closer owner visual review accompany feature integration; iPhone signing remains deferred.
        </Text>
      </NativeView>
    </DraftContext.Provider>
  )
}
