import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import type { TNativeCollectionEntry } from "../collection"
import { Input } from "../Input/Input"
import { ListBoxItem } from "../ListBoxItem/ListBoxItem"
import { PlaceholderText } from "../Text/variants/PlaceholderText/PlaceholderText"

import type { getNativeComboBoxStyles } from "./styles"
import type { TNativeComboBoxKey, TNativeComboBoxProps } from "./types"

type TComboBoxOptionsProps<T> = {
  props: TNativeComboBoxProps<T>
  entries: TNativeCollectionEntry<T>[]
  selectedKey: TNativeComboBoxKey | null
  disabledKeys: Set<string>
  identity: string
  query: string
  styles: ReturnType<typeof getNativeComboBoxStyles<T>>
  active: () => boolean
  focus: (focused: boolean) => void
  change: (query: string) => void
  close: () => void
  activate: (key: TNativeComboBoxKey) => void
}

export const ComboBoxOptions = <T,>({
  props,
  entries,
  selectedKey,
  disabledKeys,
  identity,
  query,
  styles,
  active,
  focus,
  change,
  close,
  activate,
}: TComboBoxOptionsProps<T>) => {
  const theme = useNativeTheme()
  return (
    <SafeAreaView
      testID={`${identity}-modal`}
      accessibilityViewIsModal
      onAccessibilityEscape={close}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: theme.spacing.unit * 2,
            padding: theme.spacing.unit * 2,
          }}
        >
          <View testID={`${identity}-query-group`} style={[{ flexGrow: 1, flexBasis: 160 }, styles.group]}>
            <Input
              {...props.inputProps}
              ref={props.inputRef}
              testID={`${identity}-input`}
              accessibilityLabel={props.inputLabel}
              value={query}
              placeholder={props.placeholder ?? ""}
              isDisabled={props.isDisabled}
              isReadOnly={props.isReadOnly}
              textSize={props.textSize}
              geometry={props.geometry}
              enableFocusStyle={false}
              customStyles={styles.input}
              onChangeText={(text) => {
                if (active()) change(text)
              }}
              onFocus={(event) => {
                if (!active()) return
                focus(true)
                props.inputProps?.onFocus?.(event)
              }}
              onBlur={(event) => {
                focus(false)
                props.inputProps?.onBlur?.(event)
              }}
            />
          </View>
          <Button testID={`${identity}-close`} accessibilityLabel={props.closeLabel} onPress={close} raised={false}>
            {props.closeLabel}
          </Button>
        </View>
        <FlatList
          testID={`${identity}-list`}
          data={entries}
          extraData={{
            selectedKey,
            disabledKeys,
            disabled: props.isDisabled,
            readOnly: props.isReadOnly,
            renderItem: props.renderItem,
            textSize: props.textSize,
          }}
          keyExtractor={(entry) => entry.encodedKey}
          style={styles.list}
          contentContainerStyle={{ padding: theme.spacing.unit * 2 }}
          ItemSeparatorComponent={<View style={{ height: theme.spacing.unit }} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={5}
          removeClippedSubviews={false}
          ListEmptyComponent={
            <PlaceholderText align="center" testID={`${identity}-empty`}>
              {props.emptyListMessage ?? "No items remaining to select"}
            </PlaceholderText>
          }
          renderItem={({ item: entry }) => (
            <ListBoxItem
              id={entry.key}
              textValue={entry.text}
              isSelected={entry.key === selectedKey}
              isDisabled={props.isDisabled || disabledKeys.has(entry.encodedKey)}
              isReadOnly={props.isReadOnly}
              textSize={props.textSize}
              testID={`${identity}-option-${entry.encodedKey}`}
              onPress={() => {
                if (active()) activate(entry.key)
              }}
            >
              {(state) => (props.renderItem ? props.renderItem(entry.item, state) : entry.text)}
            </ListBoxItem>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
