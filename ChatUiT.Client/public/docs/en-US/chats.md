## The chat list

The list column shows all your chats, newest first, grouped by when they last changed: Favorites, Today, Yesterday, the weekdays of this week, Last week, This month, Last month, and then by month.

New chats get their name from your first message. Type in the search box above the list to filter by name.

![Replace with screenshot featuring the chat list with groups and the search box](placeholder)

## Favorite, rename, delete

Hover over a chat and click the three dots.

- **Favorite** pins the chat to the top of the list under Favorites. Click again to remove it.
- **Rename** opens the name for editing. `Enter` saves, `Escape` cancels.
- **Delete** asks for confirmation.

> [!WARNING]
>
> A deleted chat cannot be recovered.

## The conversation panel

On wide screens, the button at the top right of a chat opens a panel with details about the open conversation.

![Replace with screenshot featuring the conversation panel with files, the context meter and the composition bar](placeholder)

**Files in the conversation** lists everything you have attached in this chat.

**Context window** shows how much of the model's memory the conversation uses. The bar has three parts: what is already used, your unsent draft, and the space reserved for the answer. Below it, **What fills the window** breaks the used part down into system prompt, knowledge files, files in the conversation and messages. For models without an exact tokenizer the numbers are estimates.

At the bottom you see which assistant the chat uses and when it was created and last changed.

## When the conversation no longer fits

Every model has a fixed context window. When a chat outgrows it, the panel says so and the assistant can no longer answer. You have two options:

- Start a new chat. Paste in a short summary of what matters from the old one.
- Remove attachments, since files are usually what fills the window.

> [!TIP]
>
> The token counter in the message box turns red at 80 percent. That is a good time to wrap up and start fresh.
