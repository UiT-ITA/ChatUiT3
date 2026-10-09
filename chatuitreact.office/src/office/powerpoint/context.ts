import { joinContext, readWith } from "../shared/context";
import { getOverview } from "./tools/getOverview";
import { getSelection } from "./tools/getSelection";
import { readSlide } from "./tools/readSlide";

interface Overview {
  slides: Array<{ id: string }>;
  selectedSlideIds: string[] | null;
}

/** What the user is looking at in PowerPoint: the slide list, the selection and the shapes of the current slide. */
export async function powerPointContext(): Promise<string> {
  let current: string | undefined;
  return joinContext("PowerPoint.", [
    [
      "Presentation overview",
      async () => {
        const overview = (await readWith(getOverview)) as Overview;
        current = overview.selectedSlideIds?.[0] ?? overview.slides[0]?.id;
        return overview;
      },
    ],
    ["Selection", () => readWith(getSelection)],
    ["Current slide", () => (current ? readWith(readSlide, { slideId: current }) : Promise.resolve(null))],
  ]);
}
