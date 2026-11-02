import type { TextInput, View } from "react-native"

import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"
import type { TNativePressEvent } from "../input/types"

import { admitNativeFormAction } from "./actionAdmission"
import {
  requestNativeFormFieldFocus,
  type TNativeFormFieldFocusOutcome,
  type TNativeFormFieldFocusRequest,
} from "./fieldFocus"
import type { NativeFormRegistry } from "./registry"
import { type TNativeFormBinding, type TNativeFormFieldBinding } from "./registry"
import type { TNativeFormAction, TNativeFormEntry, TNativeFormRequest, TNativeFormResult } from "./types"

type TNativeActionAdmission = Readonly<{
  origin: "native"
  sourceEvent: TNativePressEvent
  formId?: string
  formOwnerId: string | null
  isCurrent: () => boolean
  actionLease?: NativeFormActionStatus | null
}>
type TProgrammatic = Readonly<{ origin: "programmatic"; form: View }>
const retired = (reason: string, requestedFields?: readonly string[]): TNativeFormResult =>
  Object.freeze({ status: "retired", reason, requestedFields })
const prevented = (source: TNativeActionAdmission | TProgrammatic) =>
  source.origin === "native" &&
  (!source.isCurrent() || source.sourceEvent.defaultPrevented || source.sourceEvent.isDefaultPrevented?.() === true)
export class NativeFormController {
  constructor(
    readonly registry: NativeFormRegistry,
    readonly admit: typeof admitNativeFormAction = admitNativeFormAction,
    readonly focus: (
      target: TextInput | View,
      scope: TNativeFormFieldFocusRequest,
    ) => Promise<TNativeFormFieldFocusOutcome> = (_target, scope) => requestNativeFormFieldFocus(scope),
  ) {}

  #current = (form: TNativeFormBinding, revision: number, fields: readonly TNativeFormFieldBinding[]) =>
    form.current() === form.original &&
    this.registry.forms.get(form.descriptor.descriptorId) === form &&
    this.registry.getRevision() === revision &&
    fields.every((field) => this.registry.fields.get(field.descriptor.descriptorId) === field)

  request = async (
    action: TNativeFormAction,
    source: TProgrammatic | TNativeActionAdmission,
  ): Promise<TNativeFormResult> => {
    if (source.origin === "native" && !source.actionLease) return retired("native-action-lease-unavailable")
    if (prevented(source)) return retired("native-action-retired-or-prevented")
    let form =
      source.origin === "programmatic"
        ? [...this.registry.forms.values()].find(
            (binding) => binding.original === source.form && binding.current() === source.form,
          )
        : undefined
    if (source.origin === "programmatic" && !form) return retired("original-form-retired")
    const revision = this.registry.getRevision()
    let fields: TNativeFormFieldBinding[]
    try {
      form ??= this.registry.resolveForm(
        source.origin === "native" ? source.formId : undefined,
        source.origin === "native" ? source.formOwnerId : null,
      )
      fields = this.registry.fieldsFor(form)
    } catch (error) {
      return retired(error instanceof Error ? error.message : "form-model-unavailable")
    }
    if (form.fieldRevision !== revision || form.current() !== form.original) return retired("form-model-not-current")
    const current = () => this.#current(form!, revision, fields) && !prevented(source)
    if (!current()) return retired("original-form-state-retired")
    let admitted = false
    try {
      admitted = await this.admit(form, fields, source.origin === "native" ? source.actionLease : undefined)
    } catch {
      /* Unavailable original hosts cannot authorize an action. */
    }
    if (!admitted || !current()) return retired("form-originals-not-admitted")
    const entries: readonly TNativeFormEntry[] = Object.freeze(
      fields.flatMap((field) =>
        field.data.isDisabled ? [] : field.data.entries.map(([name, value]) => Object.freeze([name, value] as const)),
      ),
    )
    if (action === "submit" && form.props().validationBehavior !== "aria") {
      const invalid = fields.filter(
        (field) =>
          !field.data.isDisabled &&
          !field.data.isReadOnly &&
          field.data.validationBehavior === "native" &&
          !field.data.validation.validationDetails.valid,
      )
      if (invalid.length) {
        for (const field of invalid) {
          if (!current()) return retired("form-retired-during-validation")
          field.commitValidation()
        }
        if (!current()) return retired("form-retired-during-validation")
        const first = invalid[0],
          editor = first.editor(),
          mount = first.mount()?.getSnapshot()
        let focus: TNativeFormFieldFocusOutcome = { requested: false, current: false }
        if (current() && editor && mount?.active) {
          try {
            focus = await this.focus(editor, {
              form: form.descriptor,
              formMount: form.mount()?.getSnapshot() ?? null,
              field: first.descriptor,
              mount,
              origin: source.origin,
              actionLease: source.origin === "native" ? source.actionLease : undefined,
            })
          } catch {
            /* An unavailable native command cannot become a focus request. */
          }
        }
        const originalCurrent = first.editor() === editor && first.mount()?.getSnapshot() === mount
        const observed = !!(focus.current && mount?.active && editor && originalCurrent && first.isFocusObserved())
        const focusResult = Object.freeze({
          descriptorId: first.descriptor.descriptorId,
          target: first.descriptor.target,
          requested: focus.requested,
          observed,
        })
        if (!current() || (focus.requested && (!focus.current || !originalCurrent)))
          return Object.freeze({
            status: "retired",
            reason: "form-retired-during-focus-request",
            focus: focusResult,
          })
        return Object.freeze({
          status: "invalid",
          invalidFields: Object.freeze(
            invalid.map((field) =>
              Object.freeze({ descriptorId: field.descriptor.descriptorId, validation: field.data.validation }),
            ),
          ),
          focus: focusResult,
        })
      }
    }
    const requestedFields: string[] = []
    if (action === "reset")
      for (const field of fields) {
        if (!current()) return retired("form-retired-during-reset", Object.freeze(requestedFields))
        field.reset(source.origin)
        requestedFields.push(field.descriptor.descriptorId)
      }
    if (!current()) return retired("form-retired-before-callback", Object.freeze(requestedFields))
    let cancelled = false
    const record: TNativeFormRequest = Object.freeze({
      form: form.original,
      action,
      entries,
      origin: source.origin,
      ...(source.origin === "native" ? { sourceEvent: source.sourceEvent } : {}),
      get defaultPrevented() {
        return cancelled
      },
      preventDefault: () => {
        cancelled = true
      },
    })
    if (action === "submit") form.props().onSubmit?.(record)
    else form.props().onReset?.(record)
    return Object.freeze({
      status: cancelled ? "cancelled" : action === "submit" ? "submitted" : "reset",
      request: record,
      ...(action === "reset" ? { requestedFields: Object.freeze(requestedFields) } : {}),
    })
  }
}
