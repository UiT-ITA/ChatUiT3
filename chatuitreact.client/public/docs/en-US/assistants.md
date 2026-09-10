An assistant is a conversation you have set up in advance: a model, instructions and the files it should know. Use the ones UiT provides, or make your own.

## Pick an assistant for a chat

Click the assistant button to the left of the message box. The picker has a search field, a category rail (all, favorites, system, mine, shared with me) and a filter for capabilities: vision, tools and reasoning. Star an assistant to keep it under Favorites.

![Replace with screenshot featuring the assistant picker open above the composer](placeholder)

> [!NOTE]
>
> The assistant is chosen when the chat starts. To use another assistant, start a new chat.

## The Assistants page

Open **Assistants** in the rail. The list column has three groups:

- **My assistants** are the ones you have created.
- **System assistants** are provided by UiT.
- **Shared assistants** are made by other users and added by you.

Click one to see its details, or **New assistant** to create one.

## Create an assistant

![Replace with screenshot featuring the assistant form with model, instructions and knowledge sections](placeholder)

| Field | What it does |
|---|---|
| Name and description | How it appears in lists and the picker. |
| Tags | Words to search for in the picker. |
| Model | Which AI model answers. The list shows each model's capabilities, context size and knowledge cutoff. See [Models](/help/models). |
| Instructions | What the assistant should know and how it should behave. This is sent before every conversation. |
| Tools | Which tools the assistant may call, if the model supports tools. |
| Temperature | How varied the answers are, from 0 (predictable) to 1 (varied). Shown only for models that accept it. |
| Reasoning effort | How long the model may think before answering. Shown only for reasoning models. |

> [!NOT_IMPLEMENTED]

Under Instructions there are three checkboxes that add standard instructions: **Render in markdown**, **Include basic info about you** and **Render equations**. Tick them instead of writing those parts yourself.

### Knowledge files

Files under **Always loaded files** are included in every chat with the assistant.

> [!TIP]
>
> This suits short reference material: a style guide, a course description, a template. Everything in these files counts against the context window in every chat.

> [!NOT_IMPLEMENTED]

**Selective loaded files** are included only when the model judges them relevant to the question. **RAG loaded files** are split up and searched, so the assistant only reads the matching parts. Use these for large collections.

## Actions on an assistant

- **Set as default** makes new chats start with this assistant. Some expensive models cannot be defaults. The page tells you if that applies.
- **Hide from selector** keeps the assistant but takes it out of the picker.
- **Use in new chat** starts a chat with it right away.
- **Share** shows a link and an ID you can give to colleagues.
- **Delete** removes an assistant you own. For a shared assistant the same button removes it from your list only.

## Use an assistant someone shared

Either open the link you were given, which adds the assistant automatically, or go to **Assistants**, paste the ID in **Add shared assistant** and click Add. The assistant appears under Shared assistants. You use the owner's instructions and files but your own chats.
