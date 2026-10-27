import { optionalString, requireOneOf, requireString, ToolArgumentError } from "../../../chat/tools/args";
import type { OfficeToolDefinition } from "../../shared/officeTool";
import { loadTargetRanges, readTarget, runWord, targetHint, targetProperties } from "./shared";

const ACTIONS = ["add", "list", "reply", "resolve", "reopen", "delete"] as const;

export const comments: OfficeToolDefinition = {
  name: "word_comments",
  description:
    "Work with Word comments. add: comment on a target (fromId, toId, optional quote; text). list: every comment " +
    "with its id, text, author, date, resolved state, quoted text, paragraph id and replies. reply, resolve, " +
    `reopen, delete: the comment commentId from list or add. ${targetHint}`,
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      ...targetProperties,
      text: { type: "string", description: "The comment or reply text, for add and reply." },
      commentId: { type: "string", description: "For reply, resolve, reopen and delete." },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: (args, signal) => {
    const action = requireOneOf(args, "action", ACTIONS);
    switch (action) {
      case "add": {
        const target = readTarget(args);
        const text = requireString(args, "text");
        return runWord(signal, async (context) => {
          const added = (await loadTargetRanges(context, target)).map((range) => range.insertComment(text));
          added.forEach((comment) => comment.load("id"));
          await context.sync();
          return { commentIds: added.map((comment) => comment.id) };
        });
      }
      case "list":
        return runWord(signal, async (context) => {
          const all = context.document.body.getComments();
          all.load("items/id,items/content,items/authorName,items/creationDate,items/resolved");
          await context.sync();
          const details = all.items.map((comment) => {
            const range = comment.getRange();
            range.load("text");
            const paragraph = range.paragraphs.getFirst().load("uniqueLocalId");
            const replies = comment.replies;
            replies.load("items/id,items/content,items/authorName,items/creationDate");
            return { range, paragraph, replies };
          });
          await context.sync();
          return {
            comments: all.items.map((comment, index) => ({
              id: comment.id,
              text: comment.content,
              author: comment.authorName,
              date: comment.creationDate,
              resolved: comment.resolved,
              quote: details[index].range.text,
              paragraphId: details[index].paragraph.uniqueLocalId,
              replies: details[index].replies.items.map((reply) => ({
                id: reply.id,
                text: reply.content,
                author: reply.authorName,
                date: reply.creationDate,
              })),
            })),
          };
        });
      default: {
        const commentId = requireString(args, "commentId");
        const text = optionalString(args, "text");
        if (action === "reply" && !text) {
          throw new ToolArgumentError(`"text" is required for reply.`);
        }
        return runWord(signal, async (context) => {
          const all = context.document.body.getComments();
          all.load("items/id");
          await context.sync();
          const comment = all.items.find((item) => item.id === commentId);
          if (!comment) {
            throw new Error(`Comment "${commentId}" was not found. Get current ids with action list.`);
          }
          switch (action) {
            case "reply": {
              const reply = comment.reply(text as string);
              reply.load("id");
              await context.sync();
              return { replyId: reply.id };
            }
            case "resolve":
            case "reopen":
              comment.resolved = action === "resolve";
              break;
            case "delete":
              comment.delete();
              break;
          }
          await context.sync();
          return { commentId, done: action };
        });
      }
    }
  },
};
