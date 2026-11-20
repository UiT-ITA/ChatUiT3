The model is the AI that writes the answer. Each assistant has one, so you choose a model by choosing an assistant, or by setting the model when you create your own.

## Capabilities

Three icons in the picker and on the Assistants page tell you what a model can do:

| Icon | Capability | Meaning |
|---|---|---|
| Eye | Vision | Can look at images you attach. |
| Globe | Tools | Can call tools, such as fetching a web page. |
| Brain | Reasoning | Can think before it answers. |

Each model also has a **context window**, the amount of text it can hold at once, and a **knowledge cutoff**, the date after which it knows nothing unless you tell it. Both are shown in the model list when you create an assistant.

![Replace with screenshot featuring the model dropdown with capability icons, context size and knowledge cutoff](placeholder)

## Reasoning effort

Reasoning models can spend time thinking before they write. The effort setting on the assistant controls how much: Fast, Normal or Extra. Fast is the default. Fast means no reasoning, or low reasoning for models that always reason.

| Effort | Good for |
|---|---|
| Fast | Rewriting, summaries, simple questions. |
| Normal | Most everyday work. |
| Extra | Analysis, maths, tricky code, anything with several steps. Slower and costs more. |

The thinking is shown in the activity line under the answer, so you can see how the model got there.

## Tools

Tools let the model fetch information during the answer. An assistant only has the tools its owner ticked, and only if its model supports tools.

- **Fetch Web Page** reads a web address you give it and returns the main text of the page. Useful for summarising an article or checking a document online.

When the model uses a tool, the activity line under the answer counts the call. Expand it to see the tool's name, what the model asked for, and what came back.

![Replace with screenshot featuring an expanded tool call showing the fetched URL and the result](placeholder)
