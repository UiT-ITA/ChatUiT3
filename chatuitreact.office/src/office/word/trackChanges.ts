/* global Word */

export type TrackChangesMode = "Off" | "TrackAll" | "TrackMineOnly";

/** Reads Word's own Track Changes setting. */
export async function getTrackChangesMode(): Promise<TrackChangesMode> {
  return Word.run(async (context) => {
    const doc = context.document;
    doc.load("changeTrackingMode");
    await context.sync();
    return doc.changeTrackingMode as TrackChangesMode;
  });
}

/** Turns Word's Track Changes on (for everyone's edits) or off. */
export async function setTrackChanges(enabled: boolean): Promise<void> {
  await Word.run(async (context) => {
    context.document.changeTrackingMode = enabled ? Word.ChangeTrackingMode.trackAll : Word.ChangeTrackingMode.off;
    await context.sync();
  });
}
