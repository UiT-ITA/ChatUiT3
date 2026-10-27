## The message box

![Replace with screenshot featuring the composer with the assistant button, the paperclip, the character counter and the send button](placeholder)

- `Enter` sends. `Shift + Enter` makes a new line.
- The paperclip attaches files. See [Working with files](/help/files).
- While you type, the box shows a character count. If the model has a token counter, it shows tokens instead, together with how much of the context window the conversation uses. The number turns yellow at half and red at 80 percent.

## Stop an answer

While the assistant writes, the send button becomes **Stop**. Stopping removes the partial answer and your message, and puts your text and attachments back in the box so you can adjust and send again.

## Reading the answer

Answers are formatted as they arrive:

- Headings, lists, tables and links.
- Code blocks with the language shown in the header and a **Copy code** button.
- Mathematics written in LaTeX, inline like $E = mc^2$ or as a block.
- Diagrams written in Mermaid, rendered as a picture.

Links in an answer open in a new tab.

![Replace with screenshot featuring an answer with a table, a code block and a rendered diagram](placeholder)

## The activity line

Under each answer is a short summary such as *Thought for 6 s · 2 tool calls · Generated in 14 s*. While the answer is being written it shows what the model is doing right now: thinking, running a tool or writing.

Click the line to expand it. You see the model, the reasoning effort, the model's own thinking text and each tool call with its arguments and result.

> [!TIP]
>
> When an answer surprises you, open the activity line first. The thinking text usually shows which assumption the model made.

![Replace with screenshot featuring an expanded activity panel with thinking text and a tool call](placeholder)

## Message actions

Hover over a message to see its buttons.

- **Copy** copies the message as formatted text. Tables and headings survive a paste into Word or an email.

> [!NOT_IMPLEMENTED]

- **Retry** asks the assistant to answer again.
- **Edit** lets you change your own message and resend it. The answers after it are replaced.
- **Branch** starts a new chat that begins with the conversation up to that message.

## Check what matters

> [!WARNING]
>
> Models state wrong things with the same confidence as right things. Check names, numbers, dates and citations against the source before you rely on them. The line under the message box, *ChatUiT can make mistakes*, is there for a reason.
