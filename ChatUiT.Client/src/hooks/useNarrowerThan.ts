import { useLayoutEffect, useState, type RefObject } from 'react';

const rootFontSize = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize);

/** Whether an element is narrower than a width in rem. Follows both the element's size and the root font size. */
const useNarrowerThan = (ref: RefObject<HTMLElement | null>, widthRem: number): boolean => {
  const [narrow, setNarrow] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setNarrow(element.getBoundingClientRect().width < widthRem * rootFontSize());
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    const rootObserver = new MutationObserver(measure);
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-size', 'style'] });
    return () => {
      resizeObserver.disconnect();
      rootObserver.disconnect();
    };
  }, [ref, widthRem]);

  return narrow;
};

export default useNarrowerThan;
