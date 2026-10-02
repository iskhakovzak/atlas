export function describeSingleColorway(value: string) {
  const components = value.split('/').map((part) => part.trim()).filter(Boolean);
  return {
    primary: components[0] ?? value.trim(),
    components: [...new Set(components)],
  };
}
