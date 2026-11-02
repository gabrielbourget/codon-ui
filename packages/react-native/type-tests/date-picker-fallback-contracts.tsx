import { DateTimePicker, DateTimeRangePicker } from "../src"

const canonicalDynamicTextSize: string = "owner-defined-size"
export const SingleCanonicalSizeFallback = <DateTimePicker textSize={canonicalDynamicTextSize} />
export const RangeCanonicalSizeFallback = <DateTimeRangePicker textSize={canonicalDynamicTextSize} />
