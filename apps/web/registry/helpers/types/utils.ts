// amino-ui-helper-file-marker

export type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>

export type TIntRange<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>
