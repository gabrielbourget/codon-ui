import type { TNativeCarouselContext, TNativeCarouselProps, TNativeCarouselScrollOptions } from "../carouselTypes"

export const navigate = (context: TNativeCarouselContext) => {
  const jump: TNativeCarouselScrollOptions = { animated: false }
  context.scrollTo(2, jump)
  context.scrollNext()
  context.scrollPrev(jump)
  const selected: number = context.selectedIndex
  // @ts-expect-error The retired browser-compatible engine is not part of native paging.
  context.emblaApi.internalEngine()
  // @ts-expect-error Commands accept native animation intent, not an Embla jump boolean.
  context.scrollTo(1, true)
  return selected
}

export const finite: TNativeCarouselProps<{ ID: string }> = {
  items: [{ ID: "one" }],
  loopEnabled: false,
  axis: "y",
  align: "end",
  customItemStyles: { flexBasis: "50%" },
  renderCarouselItem: () => null,
}
// @ts-expect-error Continuous loop mode was explicitly retired with the finite paging contract.
export const continuous: TNativeCarouselProps<{ ID: string }> = { ...finite, loopEnabled: true }
