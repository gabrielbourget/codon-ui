import type { TextInput, View } from "react-native"

import type { NativeFormActionStatus } from "../input/specs/CUIFocusViewNativeComponent"
import type { TNativePressEvent } from "../input/types"

import {
  decodeNativeFormDocument,
  fieldsInNativeForm,
  type TNativeFormDocument,
  type TNativeFormDescriptor,
} from "./document"
import {
  requestNativeFormFieldFocus,
  type TNativeFormFieldFocusOutcome,
  type TNativeFormFieldFocusRequest,
} from "./fieldFocus"
import type { NativeFormRegistry } from "./registry"
import { type TNativeFormBinding, type TNativeFormFieldBinding } from "./registry"
import type { TNativeFormAction, TNativeFormEntry, TNativeFormRequest, TNativeFormResult } from "./types"

type TReader = (request: Readonly<{ target: number; requestId: string }>) => Promise<string>
type TNativeActionAdmission = Readonly<{
  origin: "native"
  sourceEvent: TNativePressEvent
  target: number
  formId?: string
  isCurrent: () => boolean
  admit: (document: TNativeFormDocument, form: TNativeFormDescriptor) => Promise<boolean>
  actionLease?: NativeFormActionStatus | null
}>
type TProgrammatic = Readonly<{ origin: "programmatic"; form: View }>
const retired = (reason: string, requestedFields?: readonly string[]): TNativeFormResult =>
  Object.freeze({ status: "retired", reason, requestedFields })
const descriptorMatches = (
  expected: Readonly<{
    ownerId: string
    descriptorId: string
    descriptorRevision: string
    target: number
    metadataTarget: number
    formId: string
  }>,
  actual: typeof expected,
) => Object.keys(expected).every((key) => expected[key as keyof typeof expected] === actual[key as keyof typeof actual])
const prevented = (source: TNativeActionAdmission | TProgrammatic) =>
  source.origin === "native" &&
  (!source.isCurrent() || source.sourceEvent.defaultPrevented || source.sourceEvent.isDefaultPrevented?.() === true)
const hidden = (document: TNativeFormDocument, target: number) => {
  const nodes = new Map(document.nodes.map((node) => [node.target, node]))
  let node = nodes.get(target)
  while (node) {
    if (node.hidden || node.displayNone) return true
    node = nodes.get(node.parent)
  }
  return false
}

export class NativeFormController {
  #sequence = 0
  constructor(
    readonly registry: NativeFormRegistry,
    readonly read: TReader,
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
    if (prevented(source)) return retired("native-action-retired-or-prevented")
    let form =
      source.origin === "programmatic"
        ? [...this.registry.forms.values()].find(
            (binding) => binding.original === source.form && binding.current() === source.form,
          )
        : undefined
    if (source.origin === "programmatic" && !form) return retired("original-form-retired")
    const target = source.origin === "programmatic" ? form!.descriptor.target : source.target
    const revision = this.registry.getRevision()
    const request = { target, requestId: `native-form:${++this.#sequence}` }
    let document: TNativeFormDocument
    try {
      document = decodeNativeFormDocument(await this.read(request), request)
    } catch {
      return retired("native-document-unavailable-or-incomplete")
    }
    if (prevented(source) || this.registry.getRevision() !== revision)
      return retired("form-state-changed-during-native-read")
    let descriptor: TNativeFormDescriptor | undefined
    if (source.origin === "programmatic")
      descriptor = document.forms.find((candidate) => candidate.descriptorId === form!.descriptor.descriptorId)
    else if (source.formId !== undefined) {
      const matches = document.forms.filter((candidate) => candidate.formId === source.formId)
      if (!source.formId || matches.length !== 1) return retired("native-form-association-unavailable-or-ambiguous")
      descriptor = matches[0]
    } else {
      const parents = new Map(document.nodes.map((node) => [node.target, node.parent]))
      let ancestor = source.target
      while (ancestor && !descriptor) {
        descriptor = document.forms.find((candidate) => candidate.target === ancestor)
        ancestor = parents.get(ancestor) ?? 0
      }
    }
    if (!descriptor) return retired("native-form-association-unavailable")
    form ??= this.registry.forms.get(descriptor.descriptorId)
    if (
      !form ||
      form.fieldRevision !== revision ||
      !descriptorMatches(form.descriptor, descriptor) ||
      form.current() !== form.original
    )
      return retired("native-form-registration-not-current")
    // Native completeness includes descriptors from other forms in this exact
    // document. Foreign documents' registrations never supply entries here.
    for (const candidate of document.forms) {
      const binding = this.registry.forms.get(candidate.descriptorId)
      if (!binding || !descriptorMatches(binding.descriptor, candidate))
        return retired("native-document-form-registration-incomplete")
    }
    for (const candidate of document.fields) {
      const binding = this.registry.fields.get(candidate.descriptorId)
      if (
        !binding ||
        !descriptorMatches(binding.descriptor, candidate) ||
        binding.descriptor.hasFormAssociation !== candidate.hasFormAssociation ||
        (binding.descriptor.ownedEditorBinding ?? "") !== (candidate.ownedEditorBinding ?? "")
      )
        return retired("native-document-field-registration-incomplete")
    }
    let fields: TNativeFormFieldBinding[]
    try {
      fields = fieldsInNativeForm(document, descriptor).map(
        (candidate) => this.registry.fields.get(candidate.descriptorId)!,
      )
    } catch {
      return retired("native-form-association-ambiguous")
    }
    const current = () => this.#current(form!, revision, fields) && !prevented(source)
    if (!current()) return retired("original-form-state-retired")
    if (source.origin === "native") {
      let admitted = false
      try {
        admitted = await source.admit(document, descriptor)
      } catch {
        /* Native admission failure retires the action. */
      }
      if (!admitted || !current()) return retired("native-action-not-admitted")
    }
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
        const fieldDescriptor = document.fields.find((field) => field.descriptorId === first.descriptor.descriptorId)!
        let focus: TNativeFormFieldFocusOutcome = { requested: false, current: false }
        if (current() && editor && mount?.active && !hidden(document, first.descriptor.target)) {
          try {
            focus = await this.focus(editor, {
              document,
              form: descriptor,
              field: fieldDescriptor,
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
