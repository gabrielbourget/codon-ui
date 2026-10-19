import {
  forwardRef,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { Linking, View } from "react-native"

import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { ClickPopover } from "../ClickPopover/ClickPopover"
import { Link } from "../Link/Link"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { Text } from "../Text/Text"

import { NativeBreadcrumbChevron, NativeBreadcrumbOverflowGlyph } from "./icons"
import { createNativeBreadcrumbNodes, type TNativeBreadcrumbItem } from "./model"
import { NativeBreadcrumbOverflow } from "./Overflow"
import { getNativeBreadcrumbStyles } from "./styles"
import {
  DEFAULT_NATIVE_BREADCRUMBS_LABELS,
  type TNativeBreadcrumbNavigateDetails,
  type TNativeBreadcrumbsProps,
  type TNativeBreadcrumbsRef,
} from "./types"

export const Breadcrumbs = forwardRef<TNativeBreadcrumbsRef, TNativeBreadcrumbsProps>((props, ref) => {
  const {
    items,
    color: _color,
    order,
    geometry: _geometry,
    maxVisibleItems,
    consolidationPlacement,
    isDisabled = false,
    linkTarget: _target,
    onNavigate: _navigate,
    onNavigationError: _error,
    labels: authoredLabels,
    customStyles: _custom,
    style: _style,
    customBreadcrumbStyles: _breadcrumb,
    customPopoverStyles: _popover,
    customOptionsListStyles: _list,
    customOverflowItemsPopoverButtonStyles: _button,
    customBreadcrumbLinkProps = {},
    customClickPopoverProps: _popoverProps,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    ariaDetails,
    "aria-label": nativeLabel,
    "aria-labelledby": nativeLabelledBy,
    "aria-describedby": nativeDescription,
    "aria-details": nativeDetails,
    "data-testid": aliasID,
    testID,
    ...rest
  } = props
  const theme = useNativeTheme()
  const inherited = useNativeContentContext()
  const styles = getNativeBreadcrumbStyles(theme, props, inherited?.foregroundColor)
  const nodes = createNativeBreadcrumbNodes(items, maxVisibleItems, consolidationPlacement)
  const labels = { ...DEFAULT_NATIVE_BREADCRUMBS_LABELS, ...authoredLabels }
  const [internalOpen, setInternalOpen] = useState(false)
  const { customStyles: linkCustom, style: linkStyle, ...linkProps } = customBreadcrumbLinkProps
  return (
    <NativeContentContext.Provider
      value={{ foregroundColor: styles.root.text.color ?? theme.colors.foreground, isButton: false }}
    >
      <NativeFocusHost
        {...rest}
        ref={ref}
        role="list"
        nativeNavigation={!isDisabled}
        nativeNavigationLabel={labels.navigationRoleDescription}
        accessible={false}
        focusable={false}
        accessibilityLabel={rest.accessibilityLabel ?? nativeLabel ?? ariaLabel ?? labels.navAriaLabel}
        nativeLabelledBy={nativeAccessibilityIDs(rest.accessibilityLabelledBy ?? nativeLabelledBy ?? ariaLabelledBy)}
        nativeDescribedBy={nativeAccessibilityIDs(nativeDescription ?? ariaDescribedBy)}
        nativeDetailsBy={nativeAccessibilityIDs(nativeDetails ?? ariaDetails)}
        nativeDescriptionLabel={labels.descriptionLabel}
        nativeDetailsLabel={labels.detailsLabel}
        accessibilityState={{ ...rest.accessibilityState, disabled: isDisabled }}
        style={styles.root.view}
        testID={testID ?? aliasID ?? "breadcrumbs"}
      >
        {nodes.map((node) =>
          node.kind === "overflow" ? (
            <NativeBreadcrumbCollapsed
              key="overflow"
              {...{ props, items: node.items, labels, internalOpen, setInternalOpen }}
            />
          ) : (
            <View key={`item:${node.item.id}`} style={styles.item.view} testID={`breadcrumb-${node.item.id}`}>
              {node.item === items[items.length - 1] ? (
                <Text
                  style={[styles.item.text, { fontWeight: "700", opacity: 1 }]}
                  accessibilityState={{ selected: true }}
                  accessibilityValue={{ text: labels.currentPageValue }}
                  testID="breadcrumb-current"
                >
                  {node.item.content}
                </Text>
              ) : (
                <Link
                  {...linkProps}
                  href={node.item.href}
                  order={order}
                  isDisabled={isDisabled || node.item.disabled}
                  customStyles={[styles.itemStyle, linkCustom]}
                  style={linkStyle}
                  testID={linkProps.testID ?? `breadcrumb-link-${node.item.id}`}
                >
                  {node.item.content}
                  <NativeBreadcrumbChevron />
                </Link>
              )}
            </View>
          ),
        )}
      </NativeFocusHost>
    </NativeContentContext.Provider>
  )
})
Breadcrumbs.displayName = "Breadcrumbs"

type TCollapsedProps = {
  props: TNativeBreadcrumbsProps
  items: readonly TNativeBreadcrumbItem[]
  labels: { [K in keyof typeof DEFAULT_NATIVE_BREADCRUMBS_LABELS]: string }
  internalOpen: boolean
  setInternalOpen: (value: boolean) => void
}
const NativeBreadcrumbCollapsed = ({ props, items, labels, internalOpen, setInternalOpen }: TCollapsedProps) => {
  const { customClickPopoverProps: authored = {}, isDisabled = false, geometry = "round" } = props
  const mode = authored.isOpen !== undefined ? "controlled" : authored.defaultOpen !== undefined ? "local" : "trigger"
  const ownership = useRef(mode)
  if ((mode === "local") !== (ownership.current === "local"))
    throw new TypeError("Breadcrumbs: changing overflow controlled/uncontrolled ownership is unsupported")
  const [local, setLocal] = useState(() => authored.defaultOpen ?? false)
  const open = mode === "controlled" ? authored.isOpen! : mode === "local" ? local : internalOpen
  const host = useNativeFloatingHost()
  const parent = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  useSyncExternalStore(host.layers.subscribe, host.layers.snapshot, host.layers.snapshot)
  const theme = useNativeTheme(),
    styles = getNativeBreadcrumbStyles(theme, props)
  const anchor = useRef<View>(null)
  const live = useRef(false)
  const [pending, setPending] = useState<{
    details: TNativeBreadcrumbNavigateDetails
    epoch: number
    windowId: string
    scope: typeof input
    parent: string | null
  } | null>(null)
  const latest = useRef({ props, windowActive, input, parent })
  useInsertionEffect(() => {
    latest.current = { props, windowActive, input, parent }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const requestClose = () => {
    setInternalOpen(false)
    if (mode === "local") setLocal(false)
    if (mode !== "trigger") authored.onOpenChange?.(false)
  }
  const act = (item: TNativeBreadcrumbItem) => {
    if (!live.current || latest.current.props.isDisabled || item.disabled) return
    const session = input?.acknowledgedSession() ?? { windowId: "", epoch: 0 }
    const navigation = {
      details: { href: item.href, item, target: props.linkTarget ?? "_blank" },
      ...session,
      scope: input,
      parent: parent?.id ?? null,
    }
    requestClose()
    if (live.current) setPending(navigation)
  }
  useLayoutEffect(() => {
    if (!pending || internalOpen || !live.current) return
    const current = latest.current
    const item = current.props.items.find((item) => item.id === pending.details.item.id)
    const session = current.input?.acknowledgedSession()
    if (
      current.props.isDisabled ||
      !item ||
      item.disabled ||
      item.href !== pending.details.href ||
      current.input !== pending.scope ||
      (current.parent?.id ?? null) !== pending.parent ||
      current.windowActive?.() === false ||
      current.input?.isWindowActive() === false ||
      (pending.windowId && (session?.windowId !== pending.windowId || session?.epoch !== pending.epoch))
    ) {
      setPending(null)
      return
    }
    // Explicit caller-owned open state can decline closing, just as the canonical child override can.
    if (!(mode === "controlled" && open) && (open || !host.layers.canRestore(pending.parent))) return
    setPending(null)
    const destination = pending.details.href
    if (current.props.onNavigate) current.props.onNavigate(pending.details)
    else {
      const report = (error: unknown) => {
        if (!live.current) return
        if (current.props.onNavigationError) current.props.onNavigationError(error, destination)
        else console.warn(`Breadcrumbs: unable to open ${JSON.stringify(destination)}`, error)
      }
      try {
        void Linking.openURL(destination).catch(report)
      } catch (error) {
        report(error)
      }
    }
  }, [pending, internalOpen, open, mode, host.layers.snapshot(), props])
  return (
    <View
      style={styles.item.view}
      accessibilityLabel={labels.overflowBreadcrumbAriaLabel}
      testID="breadcrumb-collapsed"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.unit }}>
        <NativeDialogTrigger
          isOpen={internalOpen}
          onOpenChange={setInternalOpen}
          isDisabled={isDisabled}
          trigger={(state) => (
            <Button
              {...state.triggerProps}
              ref={(node) => {
                state.triggerRef.current = node
                anchor.current = node
              }}
              raisedOnHover
              transparent
              raised={false}
              geometry={geometry}
              accessibilityLabel={labels.overflowButtonAriaLabel}
              customStyles={[{ aspectRatio: 1 }, props.customOverflowItemsPopoverButtonStyles]}
            >
              {(state) => <NativeBreadcrumbOverflowGlyph color={state.foregroundColor} />}
            </Button>
          )}
        >
          <ClickPopover
            {...authored}
            isOpen={open}
            defaultOpen={undefined}
            onOpenChange={requestClose}
            triggerRef={authored.triggerRef ?? anchor}
            placement={authored.placement ?? "bottom right"}
            customStyles={[{ maxWidth: 250 }, props.customPopoverStyles, authored.customStyles]}
            customDialogStyles={[{ outlineOffset: 2 }, authored.customDialogStyles]}
          >
            <NativeBreadcrumbOverflow
              items={items}
              label={labels.overflowListAriaLabel}
              style={styles.list}
              disabled={isDisabled}
              autoFocus={authored.initialFocusRef === undefined}
              onAction={act}
            />
          </ClickPopover>
        </NativeDialogTrigger>
        <NativeBreadcrumbChevron color={styles.item.text.color ?? theme.colors.foreground} />
      </View>
    </View>
  )
}
