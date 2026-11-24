# Move chat and assistant files to Azure Blob Storage (stage 1)

## Goal

Rewrite file handling in the server and the web client:

- Files are uploaded as originals.
- The server converts them.
- Originals and converted content are stored in Azure Blob Storage instead of Cosmos DB.

This is a rewrite. Leave the code good. Never keep existing code because changing it is work, when keeping it leaves the code worse.

**Stage 1 is only the move from Cosmos to Blob Storage.** The system behaves as close to the original as it can. Old files in Cosmos are not touched: their routes, data shape and preview work exactly as before. A small compatibility layer, removed after the migration, loads a file from either Cosmos or Blob Storage. Nothing is built that only lasts until the migration. API routes do not change where they do not need to.

## Stages

1. **Stage 1 (this plan).** Write all new files to Blob Storage. Old files already stored in Cosmos stay readable.
2. **Stage 2 (later).** After stage 1 is deployed, migrate the old Cosmos files to Blob Storage. Old text-only files become `.txt` originals, and old single-image files become `.jpg` originals (D33).
3. **Stage 3 (later).** Delete the old Cosmos file code.

## Decisions

All decisions below were made with the user. Do not change them. If the code makes one impossible, stop and ask.

### Storage

- **D1.** One blob container per chat, named after the chat id. Uploaded originals go in its `input/` folder.
- **D2.** One blob container per assistant, named after the assistant id, with the same layout.
- **D3.** Both chat files and assistant files move to Blob Storage.
- **D4.** The work is staged. Stage 1 (this plan) writes all new files to Blob Storage and keeps reading old files from Cosmos. Stage 2 migrates the old files after stage 1 is deployed. Stage 3 deletes the old Cosmos file code.
- **D5.** The original uploaded file is stored.
- **D7.** The user creates the storage account and provides its endpoint. Never create Azure resources.
- **D8.** Blob Storage holds the original plus the converted content. Each file is converted exactly once.
- **D13.** File metadata stays on the message document in Cosmos, as today: name, size, content type, blob names, encrypted flag and token counts.
- **D14.** Originals are stored at `input/{filename}`. A second file with the same name in the same container gets a suffix, as in `data (2).csv`. The name shown in the chat matches the stored name.
- **D15.** The converted content is a JSON manifest listing the text and image parts in order. Each image is stored as its own binary blob.
  - Images are binary inside the app.
  - Base64 is only produced where a provider API requires it.
- **D16.** Converted content lives at `converted/{filename}/` in the same container.

### Security

- **D6.** In red chats, the original and the converted content are encrypted with the chat owner's own key before they are written. This is the same per-user Key Vault key used for red chat content today.
  - Switching a chat to red encrypts all of its existing blobs.
  - Assistant files stay unencrypted, as today.
  - The principle: if the code ever serves one user's data to another user by mistake, red data must be impossible to read without the owner's key.
- **D12.** Blobs use a new binary encryption format that encrypts in segments, so files can be streamed. It uses the same per-user key. The existing text cipher stays for message text.

### Conversion

- **D10.** The server converts files. The web client's converters are removed.
- **D17.** PDF conversion on the server behaves like today's client converter:
  - text per page;
  - a page is rendered to an image only when it contains real images or drawings;
  - repeated elements such as logos are ignored.

  Port the rules and limits from the client converter.
- **D18.** The accepted file types are the same as today: txt, csv, json, md, markdown, images, pdf, docx, pptx and xlsx. Port the other rules too, such as rejecting xlsx files that contain images.
- **D22.** The image limits are the same as today: at most 2048 px on the long side and 1024 px on the short side, saved as JPEG at 85% quality. They are applied on the server.
- **D24.** Libraries:
  - OpenXml (already used) for docx, pptx and xlsx;
  - PdfPig (already used) for PDF text;
  - PDFtoImage for rendering PDF pages;
  - SkiaSharp for images.

  Do not use ImageSharp, because of its license.
- **D28.** Only a limited number of conversions run at once (for example, one per CPU core). The rest wait in a queue.
- **D29.** What the model receives does not change. The converted text and images are placed in the message on every turn, exactly as today. Only where the content is read from changes.

### Upload

- **D9.** There is a separate upload endpoint. Files are sent as multipart raw bytes and streamed to Blob Storage.
- **D23.** An upload returns only after the original is stored and converted, and the converted content is stored.
- **D25.** Assistant files use the same upload pattern. See D34.
- **D26.** Files are limited to 100 MB each. The client checks this before uploading and the server enforces it.
- **D27.** Files are uploaded when the user presses send, in three calls:
  - Create the chat first if it is new. Create the message with status `New` (no reply started). Upload each file to that message. Then start the reply.
  - The user must never wait on a frozen screen. The client opens the new chat window right away, as today, with the optimistic message showing a working status and per-file upload progress.
  - A `New` message is not shown in the chat. A `New` message older than 30 minutes is deleted with its files when the chat is next read, and a chat left with no messages is deleted too.
- **D30.** If anything fails before generation starts, the thing is deleted and the text and files go back to the input, with a notice of which file failed and why. This holds for new and existing chats. A new chat is deleted too. No empty chat or unsent message may be left on the server.
- **D34.** Assistants are saved first, then their new files are uploaded to the assistant. A file removed in the form is deleted in the save, before the uploads, so a new file with the same name gets the same name. The server checks the always-loaded budget at each upload and refuses a file that does not fit. A new assistant is kept when one of its files fails, and the form shows which file failed and why. One upload endpoint serves all assistants: the owner may use it, and an admin for a system assistant.
- **D35.** An upload is held in memory on the server for the converter while it streams to Blob Storage. Nothing is written to the server's disk.
- **D36.** A file is stored in the `files` list on its message document, or on its assistant document, as today. There is no separate record of uploaded files.
- **D37.** The blob work belongs in the file storage service, not in `DatabaseService`.
- **D11.** Uploaded files that never end up on a message are only removed when the chat is deleted. There is no cleanup job.

### Reading and preview

- **D19 and D20 are not part of stage 1.** The preview is not touched now. Every file, old and new, previews as before: its converted text and images, through the existing route (`GET /api/Chats/{chatId}/files/{fileId}` and the assistant one). The code for previewing and downloading the original (routes, client preview, preview field) is kept but switched off, with its connections commented out.
- **D38.** In the input, before a file is sent, clicking it does nothing. An image shows a thumbnail made from the local file.
- **D21.** Token counts are computed once at upload from the converted content and stored in the file metadata. Loading a chat must never download blobs.
- **D32.** Old Cosmos files are not touched in stage 1. They behave exactly as before.

### Tests

- **D31.** Add tests for:
  - the converters, with one sample file per type;
  - the segmented cipher;
  - the blob file store.

### Out of scope

- The Office add-in and the public Responses API, which stores nothing. Their behavior and API contract must not change. If shared server types change (for example, binary images in D15), keep both working unchanged.
- Changing how files reach the model (D29).
- Stages 2 and 3.
- Accepting new file types.
- Direct links to Blob Storage, which may come later for non-red files.

## Other decisions made during the work

- **Q1.** Message edit and delete are not built.
- **Q3.** One file per upload request, read as a stream.
- **Q5.** The always-loaded budget display and its save blocking stay in the assistant form, fed by the server's token counts. A new file shows its count once it is uploaded.
- **Q6.** No token counting in the web client, and no live counter for the text being typed. Displays of the server's counts stay.
- **Q7.** A missing token count is filled at the next send, where the converted content is loaded anyway, and never on chat read.
- **Q8.** Only those who may edit an assistant can reach its files.
- **Q9.** The Responses API decodes `input_image` data when the request is parsed, and answers 400 for malformed base64.
- **Q10.** An xlsx keeps its pictures between the table rows, as the client converter did.
- User-facing text is never hardcoded. File errors from the server are shown as translated text, chosen by error code.

## How to ask the user

- Only the user makes decisions. Every design choice is put to the user before it is built.
- Plain text in the chat. No question cards, no files.
- One question at a time, numbered without gaps. It must fit on one screen, in short lines.
- Each option has a letter (a, b, ...), with what is good, what is bad, and how much existing code it changes. What is already built is always one of the options, with why it was built that way. The recommendation is marked with ★ and one reason.
- Answer a yes or no question with yes or no first.
- Keeping an existing feature is not a decision. A consequence of the user's decision is not a decision.

## State of the work (not committed)

Everything in this plan is built, including the rework in D27, D30 and D34 to D38.

How it is built:

- **Routes.** `GET /api/Chats/{chatId}/files/{fileId}` and `GET /api/Assistants/{assistantId}/files/{fileId}` return a file with its text and image chunks, as before, from Cosmos or from Blob Storage. The assistant route is for the owner, or an admin for a system assistant (Q8, D34).
- **Sending a message.** `POST /api/Chats/{chatId}/messages` creates the message as `New`. `POST .../messages/{messageId}/files` uploads one file to it. `POST .../messages/{messageId}/send` starts the reply. `DELETE .../messages/{messageId}` deletes a message that is not sent. The client uploads the files one at a time, so the message gets them in the order they were picked.
- **Assistants.** `POST /api/Assistants/{assistantId}/files` uploads one file with the form fields `category` and `description`, and adds it to the assistant. An update lists the files the assistant keeps.
- **File metadata.** A file in Blob Storage is stored in the `files` list with its parts listed (type and format, no content blocks) and a `blob` object. That is how a chat read gives the same shape as before without downloading blobs.
- **Blob work.** `FileService` does all of it: upload, loading content, deleting, encrypting. `DatabaseService` only stores metadata.
- **Switched off, code kept.** The `/content` routes (commented out in `ChatsController` and `AssistantsController`), `FileService.OpenChatFileAsync` and `OpenAssistantFileAsync`, `FilePreviews`, the `Preview` field on the file DTOs (commented out), and in the client `OriginalFilePreviewModal.tsx` and the lower half of `fileService.ts`.

## Rules

- Read the project `CLAUDE.md`, the client `CLAUDE.md` and the documents they link before changing anything.
- Ask the user about every ambiguity. Never assume what the user means.
- Do what this plan describes. No work outside it.
- Never read, print or touch secrets, `.env` files, user-secrets or connection strings. Running the app is fine, since it loads its own secrets.
- No git actions (commit, push, PR, merge) unless the user tells you to.
- If something in this plan does not match the code, stop and ask the user.

## Step 0: Build the context

Read the code before changing anything. Find and understand each of these.

### Server

1. **Chat storage in Cosmos.** The service that reads and writes chats, messages and "content blocks", meaning stored content split into pieces in a separate Cosmos container. Learn how files on a message are stored as chunks (text or image) and how they are read, written and deleted. Learn the cleanup that removes already-written blocks when a write fails partway.
2. **Red chats.** How a chat becomes red, how its content is encrypted then, the existing cipher, and the service that loads or creates each user's key in Key Vault.
3. **Assistant files.** Their separate Cosmos container, how creating, updating and deleting an assistant writes and removes files, how an update keeps unchanged files, the file categories, and the knowledge-file tool that loads one file.
4. **Readers of file content.** Every one of them:
   - loading a chat with and without file content;
   - the single-file endpoint;
   - token counting, including the path that counts missing counts when a chat is read;
   - the image limit applied to model requests;
   - the code that builds model requests from files for each provider protocol;
   - the knowledge-file messages.
5. **Image types.** The image part type and every place it is used. It is shared with tool-result images and with the public Responses API mapper. If making images binary (D15) would change behavior outside file handling, stop and ask the user.
6. **Azure sign-in.** How the server connects to Cosmos with its Entra identity and the shared token credential registered at startup. Blob Storage uses the same credential.
7. **Existing multipart uploads.** The media generation upload already uses multipart. Follow its pattern for limits and streaming.

### Web client

8. **Converters.** The import processors that convert each file type today, plus their shared helpers. These define the behavior to port (D17, D18, D22).
9. **Send flows.** The send flow for new and existing chats, including creating the chat, the optimistic messages and opening the new chat window.
10. **File handling in the UI.** The accepted file types, the file preview modal, file thumbnails, and the assistant form's file handling.

### Running

11. How the app is started locally (scripts and launch configuration).

## Steps

1. **Configuration.**
   - Add the `Azure.Storage.Blobs` package.
   - Add a `BlobStorage:AccountEndpoint` setting with the value the user provides.
   - Create the Blob client with the shared token credential.
2. **Segmented cipher (D12).** Encrypt and decrypt streams with the per-user key. Add tests (D31).
3. **Blob file store.**
   - Create containers on first write.
   - Write and read originals and converted content.
   - Apply the duplicate-name suffix (D14).
   - Delete one file (its original and its converted folder).
   - Delete a whole container.
   - Check that container names from chat and assistant ids are valid (3 to 63 characters: lowercase letters, numbers and single hyphens).
   - Add tests (D31).
4. **Server converters (D10, D17, D18, D22, D24).**
   - Port each client converter's behavior to the server.
   - Add the concurrency limit (D28).
   - Add tests with one sample file per type (D31).
5. **Upload endpoints (D9, D23, D25, D26, D34).** One for the files of a `New` message and one for assistant files. Each one:
   - checks that the caller owns the chat or may edit the assistant;
   - enforces the 100 MB limit;
   - streams the original to blob, encrypting it in red chats;
   - converts the file and stores the converted content, also encrypted in red chats;
   - computes token counts (D21);
   - returns the file metadata.

   A conversion error returns a clear error the client can show (D30).
6. **Sending messages and saving assistants (D27, D34, D36).**
   - A message is created as `New`, its files are uploaded to it, then the reply is started.
   - An assistant is saved, then its new files are uploaded to it.
   - Store the metadata on the message or assistant (D13).
7. **Binary images inside the app (D15).**
   - Images in file content are bytes everywhere inside the server.
   - Base64 is produced only at the provider API boundary.
   - The public Responses API keeps its contract.
8. **Read paths.**
   - Model input is built from the converted content, exactly as today (D29).
   - Old Cosmos files are still read from Cosmos (D4).
   - Loading a chat never downloads blobs (D21).
9. **Preview.** Not changed in stage 1. The existing routes return a file's converted text and images, from Cosmos for an old file and from Blob Storage for a new one.
10. **Deletes.**
    - Deleting a message deletes its files' blobs and its old content blocks.
    - Updating a message that replaces its files deletes the old ones only after the replacement is stored.
    - Deleting a chat, or all of a user's chats, deletes the chat containers.
    - Deleting an assistant deletes its container.
    - Replacing an assistant file deletes the old blobs after the new one is stored.
11. **Red switch (D6).** Switching a chat to red encrypts every unencrypted blob in its container, in addition to the Cosmos content as today.
12. **Web client.**
    - Remove the converters (D10).
    - Implement upload on send with an immediate optimistic window and per-file progress (D27), failure handling (D30) and the 100 MB check (D26).
    - Keep the preview as before. Update the assistant form (D34).
    - The accepted file types stay as they are (D18).
13. **Tests.** Run the existing server tests and the new tests (D31).

## Verify by running the app

Start the app from your worktree and check each case yourself:

1. Upload each type (txt, csv, json, md, image, pdf, docx, pptx, xlsx) in a new chat.
   - The chat window must open at once with the working status and upload progress.
   - Reload the chat, preview each file (converted text and images, as before), and send a follow-up message that uses the files.
2. Upload a file that fails to convert (for example, a broken PDF), in a new chat and in an existing chat. Nothing may be left on the server, and the text and files must be back in the input with the failure shown.
3. Upload two files with the same name. The second one gets the suffix.
4. Try a file over 100 MB. It must be rejected before uploading.
5. Upload files in a red chat, and switch a chat that has files to red. Confirm the blobs are encrypted and the chat still reads correctly.
6. Open an old chat whose files are in Cosmos. Every file previews exactly as before, and follow-up messages still use the files.
7. Cancel a generation (this deletes the message and its files). Delete a chat with files. Message edit and delete have no UI and are not built.
8. Create an assistant with files, update it (keep one, replace one with a file of the same name, add one), load a file through the knowledge-file tool, then delete the assistant. Do the same for a system assistant and for an assistant whose files are in Cosmos.
9. After each case, list the blobs (for example `az storage blob list --auth-mode login`) and confirm they match: files present after uploads, removed after deletes, encrypted where expected.
10. The Office add-in: the user tests it in Word. Call `/api/v1/responses` directly with an `input_file` that has text and image chunks, and with malformed base64 (must answer 400).

Report what you verified and what you could not verify.
