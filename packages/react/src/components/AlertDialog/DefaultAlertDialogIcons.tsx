type TAlertDialogDefaultIconProps = {
  size?: number
  color?: string
  customClassName?: string
  "aria-hidden"?: boolean
  "data-testid"?: string
}

const buildDefaultIconProps = (props: TAlertDialogDefaultIconProps) => {
  const { size, color, customClassName, "aria-hidden": ariaHidden, "data-testid": dataTestID } = props
  const interpretedProps: Record<string, string | number | boolean> = {}
  const resolvedColor = !color || color === "inherit" ? "currentColor" : color

  if (size) {
    interpretedProps.height = size
    interpretedProps.width = size
  }
  interpretedProps.fill = resolvedColor
  if (ariaHidden !== undefined) interpretedProps["aria-hidden"] = ariaHidden
  if (dataTestID) interpretedProps["data-testid"] = dataTestID

  return { interpretedProps, customClassName }
}

export const AlertDialogDefaultCheckmarkIcon = (props: TAlertDialogDefaultIconProps) => {
  const { interpretedProps, customClassName } = buildDefaultIconProps(props)

  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M362.6 192.9 345 174.8c-.7-.8-1.8-1.2-2.8-1.2-1.1 0-2.1.4-2.8 1.2l-122 122.9-44.4-44.4c-.8-.8-1.8-1.2-2.8-1.2s-2 .4-2.8 1.2l-17.8 17.8c-1.6 1.6-1.6 4.1 0 5.7l56 56c3.6 3.6 8 5.7 11.7 5.7 5.3 0 9.9-3.9 11.6-5.5h.1l133.7-134.4c1.4-1.7 1.4-4.2-.1-5.7z" />
    </svg>
  )
}

export const AlertDialogDefaultDeleteIcon = (props: TAlertDialogDefaultIconProps) => {
  const { interpretedProps, customClassName } = buildDefaultIconProps(props)

  return (
    <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 3h3v1h-1v9l-1 1H4l-1-1V4H2V3h3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1zM9 2H6v1h3V2zM4 13h7V4H4v9zm2-8H5v7h1V5zm1 0h1v7H7V5zm2 0h1v7H9V5z"
      />
    </svg>
  )
}

export const AlertDialogDefaultErrorIcon = (props: TAlertDialogDefaultIconProps) => {
  const { interpretedProps, customClassName } = buildDefaultIconProps(props)

  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  )
}

export const AlertDialogDefaultInfoIcon = (props: TAlertDialogDefaultIconProps) => {
  const { interpretedProps, customClassName } = buildDefaultIconProps(props)

  return (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="M18.2476 20.8951C18.172 21.19 18.117 21.4248 18.048 21.6552C18.0319 21.7095 17.9739 21.7726 17.9204 21.7924C16.8902 22.1813 15.8739 22.604 14.7278 22.5115C13.8011 22.4374 12.9 21.8629 12.7078 21.0484C12.6102 20.636 12.6051 20.1642 12.699 19.7511C12.9448 18.6696 13.2794 17.6086 13.5545 16.5329C13.6918 15.9973 13.8224 15.4514 13.8723 14.9032C13.9361 14.1974 13.5824 13.8621 12.8663 13.912C12.4525 13.9406 12.0445 14.0514 11.6094 14.1291C11.6681 13.8943 11.729 13.6339 11.8016 13.377C11.8148 13.3294 11.8691 13.2743 11.9168 13.2574C12.9617 12.8832 13.9911 12.4445 15.1424 12.5369C16.0801 12.6117 16.9217 13.1885 17.0597 14.0205C17.1477 14.5533 17.1132 15.1395 16.99 15.6678C16.6965 16.9284 16.3105 18.1677 15.9796 19.4202C15.9055 19.6998 15.8857 19.9977 15.8769 20.2882C15.8629 20.741 16.075 21 16.5211 21.0932C17.0912 21.2128 17.6452 21.1254 18.2483 20.8936L18.2476 20.8951Z" />
      <path d="M16.4667 7.50293C17.582 7.5044 18.4177 8.28878 18.4045 9.29548C18.3943 10.0454 17.8461 10.694 17.0339 10.9178C16.1358 11.1658 15.1371 10.76 14.749 9.99108C14.2009 8.90513 14.9728 7.64087 16.2605 7.5154C16.3383 7.50807 16.4161 7.50586 16.4674 7.50366L16.4667 7.50293Z" />
    </svg>
  )
}

export const AlertDialogDefaultOctagonExclamationIcon = (props: TAlertDialogDefaultIconProps) => {
  const { interpretedProps, customClassName } = buildDefaultIconProps(props)

  return (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="m13.36 12.14v-5.49c0-1.15.67-1.96 1.62-1.97.95 0 1.65.8 1.65 1.95v11.1c0 1.13-.7 1.96-1.65 1.95-.94 0-1.62-.83-1.62-1.97v-5.57z" />
      <path d="m16.64 23.68c0 .91-.71 1.64-1.62 1.64s-1.65-.73-1.65-1.67.73-1.61 1.65-1.61 1.62.71 1.62 1.64z" />
      <path d="m19.99 2.58c.1 0 .19.04.26.11l7.06 7.06c.07.07.11.16.11.26v9.98c0 .1-.04.19-.11.26l-7.06 7.06c-.07.07-.16.11-.26.11h-9.98c-.1 0-.19-.04-.26-.11l-7.06-7.06c-.07-.07-.11-.16-.11-.26v-9.98c0-.1.04-.19.11-.26l7.06-7.06c.07-.07.16-.11.26-.11h9.98m0-2.58h-9.98c-.78 0-1.53.31-2.08.86L.86 7.92c-.55.55-.86 1.3-.86 2.08v9.98c0 .78.31 1.53.86 2.08l7.06 7.06c.55.55 1.3.86 2.08.86h9.98c.78 0 1.53-.31 2.08-.86l7.06-7.06c.55-.55.86-1.3.86-2.08v-9.98c0-.78-.31-1.53-.86-2.08L22.08.86c-.55-.55-1.3-.86-2.08-.86z" />
    </svg>
  )
}

export const AlertDialogDefaultTriangleExclamationIcon = (props: TAlertDialogDefaultIconProps) => {
  const { interpretedProps, customClassName } = buildDefaultIconProps(props)

  return (
    <svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" className={customClassName} {...interpretedProps}>
      <path d="m30 25.62c-.05.21-.09.42-.14.63-.55 2.21-2.39 3.74-4.53 3.75H4.71c-3.56 0-5.83-4.01-4.14-7.36 2.12-4.18 4.28-8.34 6.43-12.5 1.28-2.48 2.55-4.96 3.83-7.44C11.78.88 13.23-.06 15.18 0c1.68.05 3.01.88 3.85 2.44 1.15 2.14 2.24 4.31 3.35 6.47 2.29 4.45 4.58 8.9 6.88 13.34.35.67.58 1.37.74 2.12v1.25zM15 27.5h10.1c.38 0 .79-.06 1.14-.22 1.31-.58 1.78-2.19 1.08-3.56-2.43-4.73-4.87-9.46-7.31-14.19-.98-1.9-1.95-3.79-2.93-5.68-.53-1.03-1.46-1.5-2.53-1.29-.76.15-1.29.64-1.66 1.36-1.49 2.9-2.98 5.8-4.48 8.7-1.91 3.7-3.81 7.4-5.72 11.1-.32.62-.43 1.26-.25 1.95.3 1.14 1.2 1.84 2.39 1.84H15z" />
      <path d="M13.83 13.74V9.82c0-.82.48-1.4 1.16-1.41.68 0 1.18.57 1.18 1.39v7.93c0 .81-.5 1.4-1.18 1.39-.67 0-1.16-.59-1.16-1.41v-3.98z" />
      <path d="M16.17 21.98c0 .65-.51 1.17-1.16 1.17-.66 0-1.18-.52-1.18-1.19 0-.65.52-1.15 1.18-1.15.65 0 1.16.51 1.16 1.17z" />
    </svg>
  )
}
