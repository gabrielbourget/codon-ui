export const kebabToPascalCase = (string: string) => {
  return string
    .replace(/(-\w)/g, function (m) {
      return m[1].toUpperCase()
    })
    .replace(/^\w/, function (m) {
      return m.toUpperCase()
    })
}
