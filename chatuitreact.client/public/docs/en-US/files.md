## Attach a file

Click the paperclip in the message box and pick one or more files. They appear as thumbnails above the box. Click a thumbnail to preview what the assistant will see, or the cross to remove it. Then write your question and send as usual.

![Replace with screenshot featuring the composer with a PDF and an image attached](placeholder)

> [!NOT_IMPLEMENTED]

You can also drag files from your computer onto the chat, or paste an image or a file with `Ctrl + V` (`Cmd + V` on Mac).

## Supported file types

| Kind | Types | What the assistant gets |
|---|---|---|
| Documents | PDF, Word (docx), PowerPoint (pptx), Excel (xlsx) | The text, page by page or sheet by sheet. Spreadsheets become tables. Images inside a PDF are included. |
| Text | txt, csv, json, md | The text as is |
| Images | jpeg, png, bmp, webp, gif | The picture itself. Needs a model with vision, see below. |

> [!NOTE]
>
> Up to 10 files in one message, and about 95 MB in total. Files are converted in your browser before anything is sent, so a large PDF can take a few seconds.

## Images need vision

Only models with the **Vision** capability can look at pictures. The assistant picker shows an eye icon on assistants that have it. If you send an image to an assistant without vision, the image is ignored.

## Files in the conversation

Every file you have sent is listed in the conversation panel to the right, under **Files in the conversation**. Open the panel with the button at the top right of a chat. Files count towards the context window, so a long report can fill a large part of it. See [Managing chats](/help/chats#the-conversation-panel).

## Files an assistant always knows

> [!TIP]
>
> If you use the same document in many chats, add it to an assistant instead. Files added under **Knowledge** are included in every chat with that assistant. See [Assistants](/help/assistants#knowledge-files).
