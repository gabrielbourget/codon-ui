import { useLayoutEffect, useMemo, useRef } from "react"
import { View, type TextInput } from "react-native"

import { NativeFocusView } from "../../input/NativeFocusView"
import { Counter } from "../Counter/Counter"
import { FormField } from "../FormField/FormField"
import { createNumberModel } from "../NumberInput/model"
import { NumberInput } from "../NumberInput/NumberInput"
import { Select } from "../Select/Select"

import { NativePaginationAction } from "./Action"
import type { TNativePaginationLabels } from "./labels"
import type { getNativePaginationStyles } from "./styles"
import type { TNativePaginationPageSizeOption, TNativePaginationProps } from "./types"

type TProps = {
  props: TNativePaginationProps
  count: number
  labels: TNativePaginationLabels
  styles: ReturnType<typeof getNativePaginationStyles>
}
export const NativePaginationCounter = ({ props, count, labels }: TProps) => {
  const authored = props.customPageCounterProps ?? {}
  return (
    <View testID="page-counter" style={{ alignSelf: "flex-end" }}>
      <Counter
        {...authored}
        value={props.currentPage}
        maxValue={count}
        showMaxValue={authored.showMaxValue ?? true}
        accessibilityLabel={
          authored.accessibilityLabel ?? authored["aria-label"] ?? authored.ariaLabel ?? labels.pageCounter.ariaLabel
        }
        customStyles={[authored.customStyles, props.customPageCounterStyles]}
        customTextStyles={authored.customTextStyles}
      >
        {labels.pageCounter.counterText || null}
      </Counter>
    </View>
  )
}

export const NativePaginationInput = ({
  props,
  count,
  labels,
  styles,
  draft,
  onDraft,
  requestPage,
}: TProps & { draft: number | null; onDraft: (value: number | null) => void; requestPage: () => void }) => {
  const fallback = useRef<TextInput>(null),
    editor = props.pageInputRef ?? fallback
  const field = props.customPageNumberInputFormFieldProps ?? {},
    input = props.customPageNumberInputProps ?? {}
  const model = useMemo(
    () =>
      createNumberModel({
        locale: input.locale,
        formatOptions: input.formatOptions,
        minValue: 1,
        maxValue: count,
        step: input.step,
      }),
    [input.locale, input.formatOptions, input.step, count],
  )
  const raw = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    raw.current = undefined
  }, [draft, model.key, props.isDisabled, input.isReadOnly])
  return (
    <View testID="page-input" style={{ flexDirection: "row", alignItems: "flex-end", gap: styles.gap }}>
      <FormField
        {...field}
        label={labels.pageInput.label}
        labelFor={editor}
        customStyles={[field.customStyles, props.customPageNumberInputFormFieldStyles]}
        customLabelStyles={[styles.root.text, field.customLabelStyles]}
      >
        <NativeFocusView
          focusable={false}
          accessible={false}
          role="group"
          accessibilityLabel={labels.pageInput.numberInput.inputButtonGroupAriaLabel}
        >
          <NumberInput
            {...input}
            ref={editor}
            value={draft}
            minValue={1}
            maxValue={count}
            step={input.step ?? 1}
            onChange={onDraft}
            onChangeText={(text) => {
              raw.current = text
              input.onChangeText?.(text)
            }}
            isDisabled={props.isDisabled}
            geometry={props.geometry ?? "rounded"}
            accessibilityLabel={input.accessibilityLabel ?? input["aria-label"] ?? labels.pageInput.inputAriaLabel}
            placeholder={input.placeholder ?? labels.pageInput.placeholder}
            incrementLabel={input.incrementLabel ?? labels.pageInput.numberInput.incrementLabel}
            decrementLabel={input.decrementLabel ?? labels.pageInput.numberInput.decrementLabel}
            customStyles={[input.customStyles, props.customPageNumberInputStyles]}
            customInputStyles={[styles.root.text, { minWidth: 43 }, input.customInputStyles]}
          />
        </NativeFocusView>
      </FormField>
      <NativePaginationAction
        props={props}
        target={styles.target}
        textStyle={styles.root.text}
        testID="pagination-submit"
        label={labels.pageInput.submitButtonAriaLabel}
        customStyles={props.customPageNumberInputNavigationButtonStyles}
        onRequest={() => {
          const committed = raw.current === undefined ? { value: draft } : model.commit(raw.current)
          if (!committed) return
          raw.current = undefined
          onDraft(committed.value)
          if (committed.value !== null) requestPage()
        }}
      >
        {labels.pageInput.submitButtonText}
      </NativePaginationAction>
    </View>
  )
}

export const NativePaginationPageSize = ({
  props,
  labels,
  styles,
  items,
  requestSize,
}: TProps & {
  items: readonly TNativePaginationPageSizeOption[]
  requestSize: (key: string | number | null) => void
}) => {
  const field = props.customItemsPerPageFormFieldProps ?? {},
    select = props.customItemsPerPageSelectProps ?? {}
  return (
    <View testID="items-per-page">
      <FormField
        {...field}
        label={labels.itemsPerPage.label}
        customStyles={[field.customStyles, props.customItemsPerPageFormFieldStyles]}
        customLabelStyles={[styles.root.text, field.customLabelStyles]}
      >
        <Select
          {...select}
          items={items}
          getKey={(item) => item.id}
          getTextValue={(item) => item.name}
          value={String(props.itemsPerPage)}
          onChange={requestSize}
          isDisabled={props.isDisabled}
          geometry={props.geometry ?? "rounded"}
          accessibilityLabel={select.accessibilityLabel ?? select["aria-label"] ?? labels.itemsPerPage.selectAriaLabel}
          closeLabel={select.closeLabel ?? labels.itemsPerPage.closeLabel}
          placeholder={select.placeholder ?? labels.itemsPerPage.placeholder}
          emptyListMessage={select.emptyListMessage ?? labels.itemsPerPage.emptyListMessage}
          width={select.width ?? 82}
          customStyles={[select.customStyles, props.customItemsPerPageSelectStyles]}
          customSelectedItemTextStyles={[styles.root.text, select.customSelectedItemTextStyles]}
        />
      </FormField>
    </View>
  )
}
