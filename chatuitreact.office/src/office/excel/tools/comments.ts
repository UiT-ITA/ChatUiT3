import { requireOneOf, requireString } from "../../../chat/tools/args";
import { isSetSupported, type OfficeToolDefinition, type RequirementSet } from "../../shared/officeTool";
import { getRange, runExcel } from "./shared";

const ACTIONS = ["list", "add", "reply", "resolve", "reopen", "delete"] as const;
/** Comment.resolved is newer than the comments themselves. */
const RESOLVED: RequirementSet = { set: "ExcelApi", version: "1.11" };

export const comments: OfficeToolDefinition = {
  name: "excel_comments",
  description:
    "Work with threaded comments. list: every comment with its id, cell address, text, author, date, resolved " +
    "state and replies. add: comment text on cell. reply, resolve, reopen, delete: the comment commentId from list " +
    `or add.`,
  requires: { set: "ExcelApi", version: "1.10" },
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      cell: { type: "string", description: "For add: one cell, such as Sheet1!B4." },
      text: { type: "string", description: "For add and reply." },
      commentId: { type: "string", description: "For reply, resolve, reopen and delete." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    switch (action) {
      case "list":
        return runExcel(signal, async (context) => {
          const hasResolved = isSetSupported(RESOLVED);
          const all = context.workbook.comments;
          all.load(`items/id,items/content,items/authorName,items/creationDate${hasResolved ? ",items/resolved" : ""}`);
          await context.sync();
          const details = all.items.map((comment) => {
            const location = comment.getLocation().load("address");
            const replies = comment.replies;
            replies.load("items/id,items/content,items/authorName,items/creationDate");
            return { location, replies };
          });
          await context.sync();
          return {
            comments: all.items.map((comment, index) => ({
              id: comment.id,
              address: details[index].location.address,
              text: comment.content,
              author: comment.authorName,
              date: comment.creationDate,
              resolved: hasResolved ? comment.resolved : null,
              replies: details[index].replies.items.map((reply) => ({
                id: reply.id,
                text: reply.content,
                author: reply.authorName,
                date: reply.creationDate,
              })),
            })),
          };
        });
      case "add": {
        const cell = requireString(args, "cell");
        const text = requireString(args, "text");
        return runExcel(signal, async (context) => {
          const comment = context.workbook.comments.add(getRange(context, cell), text).load("id");
          await context.sync();
          return { commentId: comment.id };
        });
      }
      case "reply": {
        const commentId = requireString(args, "commentId");
        const text = requireString(args, "text");
        return runExcel(signal, async (context) => {
          const reply = context.workbook.comments.getItem(commentId).replies.add(text).load("id");
          await context.sync();
          return { replyId: reply.id };
        });
      }
      case "resolve":
      case "reopen": {
        const commentId = requireString(args, "commentId");
        if (!isSetSupported(RESOLVED)) {
          throw new Error(`Resolving comments needs ${RESOLVED.set} ${RESOLVED.version}, which this Excel lacks.`);
        }
        return runExcel(signal, async (context) => {
          context.workbook.comments.getItem(commentId).resolved = action === "resolve";
          await context.sync();
          return { commentId, done: action };
        });
      }
      case "delete": {
        const commentId = requireString(args, "commentId");
        return runExcel(signal, async (context) => {
          context.workbook.comments.getItem(commentId).delete();
          await context.sync();
          return { deleted: commentId };
        });
      }
    }
  },
};
