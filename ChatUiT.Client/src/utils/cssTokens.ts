/** The value of a design token on the page root, as written. */
export const tokenValue = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** The colours colour tokens resolve to on the page, in the current colour scheme, read together in one style pass. */
export const tokenColors = (names: string[]): string[] => {
  const probes = names.map((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    return probe;
  });
  document.body.append(...probes);
  const colors = probes.map((probe) => getComputedStyle(probe).color);
  probes.forEach((probe) => probe.remove());
  return colors;
};

/** A size token's value, such as 16rem, typed as the rem size ui-sdk parts take. */
export const sizeToken = (name: string) => tokenValue(name) as `${number}rem`;
