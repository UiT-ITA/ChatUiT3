// src/services/mockChatService.ts

export type Message = {
    id: string;
    text: string;
    sender: 'user' | 'assistant';
    timestamp: Date;
};

export type Chat = {
    id: string;
    title: string; // Added for sidebar display
    messages: Message[];
    assistantId?: string;
};

const mockChatsData: Record<string, Chat> = {
    "guid-123-abc": {
        id: "guid-123-abc",
        title: "React Hooks Discussion",
        messages: [
            { id: 'c1m1', text: 'Hello from chat 123-abc!', sender: 'assistant', timestamp: new Date(Date.now() - 7200000) },
            { id: 'c1m2', text: 'This is a specific, existing chat about React Hooks.', sender: 'user', timestamp: new Date(Date.now() - 7100000) },
            { id: 'c1m3', text: 'Indeed it is. How can I assist you further in this context?', sender: 'assistant', timestamp: new Date(Date.now() - 7000000) },
        ],
        assistantId: "gpt-3.5-turbo"
    },
    "guid-456-def": {
        id: "guid-456-def",
        title: "Project Ideas",
        messages: [
            { id: 'c2m1', text: 'Welcome to chat 456-def, let\'s brainstorm some project ideas.', sender: 'assistant', timestamp: new Date(Date.now() - 3600000) },
            { id: 'c2m2', text: 'I have a query about this particular chat session regarding project planning.', sender: 'user', timestamp: new Date(Date.now() - 3500000) },
        ],
        assistantId: "claude-2"
    },
    "guid-789-ghi": {
        id: "guid-789-ghi",
        title: "CSS Styling Help",
        messages: [
            { id: 'c3m1', text: 'Having some trouble with CSS flexbox.', sender: 'user', timestamp: new Date(Date.now() - 1800000) },
            { id: 'c3m2', text: 'Flexbox can be tricky! What specifically are you trying to achieve?', sender: 'assistant', timestamp: new Date(Date.now() - 1700000) },
        ],
    },
    "guid-long-chat": {
        id: "guid-long-chat",
        title: "In-Depth AI Ethics & Future",
        messages: [
            {
                id: 'lc1',
                text: 'I\'d like to explore the ethical landscape of advanced AI, particularly as we approach models with more general problem-solving capabilities. What do you consider the most pressing ethical challenges we need to address proactively in the development and deployment of such systems? For instance, how do we ensure alignment with human values when these values themselves can be diverse and sometimes conflicting?',
                sender: 'user',
                timestamp: new Date(Date.now() - 86400000 * 3)
            },
            {
                id: 'lc2',
                text: 'That\'s a profoundly important question. One of the foremost challenges is indeed "value alignment." Ensuring that AI systems, especially highly autonomous ones, operate in ways that are beneficial to humanity is non-trivial. This involves several sub-problems: first, how do we formally specify complex human values? Values like "fairness," "safety," or "well-being" are abstract and context-dependent. Second, as you pointed out, whose values do we align to? Different cultures and individuals have varying ethical frameworks. A potential approach involves techniques like "inverse reinforcement learning" to infer values from observed human behavior, combined with robust deliberative processes involving diverse stakeholders to define acceptable operational boundaries. Furthermore, developing "corrigibility" – ensuring AI systems remain amenable to correction even if their initial objectives are misspecified – is crucial. This also ties into transparency and interpretability, allowing us to understand an AI\'s decision-making process and identify potential misalignments before they cause harm.',
                sender: 'assistant',
                timestamp: new Date(Date.now() - 86400000 * 3 + 120000)
            },
            {
                id: 'lc3',
                text: 'The concept of corrigibility is fascinating. Could you elaborate on how that might be technically implemented or fostered in an AI\'s architecture? It seems to run counter to the idea of an AI optimizing strongly for a given objective. Also, regarding transparency, with models becoming increasingly complex (billions or trillions of parameters), is true interpretability a realistic goal, or are we looking at forms of high-level explanation rather than a granular understanding of every connection?',
                sender: 'user',
                timestamp: new Date(Date.now() - 86400000 * 3 + 240000)
            },
            {
                id: 'lc4',
                text: 'Excellent follow-up points. For corrigibility, one line of research focuses on designing utility functions that explicitly reward the AI for allowing human intervention or shutdown, or for expressing uncertainty and seeking clarification when faced with ambiguous situations. This might involve an "off-switch" that the AI is not incentivized to disable. Another approach is to train AI systems in environments where they learn that human feedback is a valuable source of information for achieving their true, underlying (and perhaps initially underspecified) goals. \n\nRegarding interpretability, you\'re right that a complete, neuron-by-neuron understanding of massive models is likely intractable. However, "true interpretability" isn\'t necessarily the only useful form. We are seeing progress in techniques like "mechanistic interpretability," which aims to understand the specific circuits or subnetworks within a model responsible for certain capabilities or behaviors. Other methods focus on generating "concept-based explanations" (e.g., identifying that a model used the presence of "feathers" and "wings" to classify an image as a bird) or providing "local explanations" for individual decisions (e.g., using LIME or SHAP values). So, while we might not get a full blueprint, we can aim for a level of transparency that allows for debugging, bias detection, and building justified trust in the system\'s outputs in specific contexts.',
                sender: 'assistant',
                timestamp: new Date(Date.now() - 86400000 * 3 + 420000)
            },
            {
                id: 'lc5',
                text: 'That clarifies the different facets of interpretability. Let\'s shift slightly. Considering the rapid pace of AI development, what governance structures or international collaborations do you think are necessary to manage the global implications of advanced AI? We\'re seeing individual nations or blocs developing their own AI strategies and regulations, but the technology itself is inherently borderless.',
                sender: 'user',
                timestamp: new Date(Date.now() - 86400000 * 3 + 600000)
            },
            {
                id: 'lc6',
                text: 'That\'s a critical issue. The borderless nature of AI and its potential for widespread impact necessitate robust international collaboration. Several models for governance could be considered. An "IPCC for AI" (Intergovernmental Panel on Climate Change) model could provide authoritative scientific assessments on AI capabilities and risks, informing policymakers globally. International treaties or conventions could establish norms for the development and use of certain high-risk AI applications, similar to arms control treaties. Furthermore, fostering global research collaborations on AI safety and ethics can help pool resources and expertise. Organizations like the OECD are already working on AI principles, and initiatives like the Global Partnership on AI (GPAI) aim to bridge theory and practice. However, achieving consensus and ensuring compliance will be challenging, given differing geopolitical interests and economic incentives. A multi-layered approach involving governments, industry, academia, and civil society will likely be most effective, promoting shared standards for safety, security, and ethical deployment while allowing for innovation.',
                sender: 'assistant',
                timestamp: new Date(Date.now() - 86400000 * 3 + 780000)
            },
            {
                id: 'lc7',
                text: 'The idea of an "IPCC for AI" is particularly compelling as it emphasizes a scientifically grounded, globally coordinated understanding. Given these complexities in both the technical and governance realms, what is a realistic timeframe, in your estimation, for when we might see AI systems that can perform a wide range of intellectual tasks at or above human level across many domains – something akin to a nascent Artificial General Intelligence?',
                sender: 'user',
                timestamp: new Date(Date.now() - 86400000 * 3 + 960000)
            },
            {
                id: 'lc8',
                text: 'Predicting timelines for AGI is notoriously difficult, and expert opinions vary widely – from a decade to many decades, or even never. Current large language models and multimodal systems demonstrate impressive capabilities in specific tasks but still lack the robust understanding, common sense reasoning, and adaptability characteristic of human general intelligence. Progress is rapid, driven by scaling compute, data, and algorithmic improvements. However, fundamental breakthroughs may still be needed in areas like continual learning, causal inference, and efficient knowledge representation. \n\nIf we define AGI as the ability to perform *most* economically valuable intellectual tasks as well as or better than humans, some experts surveyed in recent years place the median estimate around the 2040s to 2060s. However, these are speculative. It\'s also possible that progress will not be linear; we might see rapid advancements in some areas and plateaus in others. The key is to prepare for a range of possibilities, focusing on developing AI beneficially and safely regardless of the exact timeline for more general capabilities.',
                sender: 'assistant',
                timestamp: new Date(Date.now() - 86400000 * 3 + 1200000)
            },
            {
                id: 'lc9',
                text: 'That provides a good sense of the uncertainty and the factors involved. It underscores the importance of the ethical and governance discussions we were having earlier, as preparing for various scenarios seems to be the most prudent approach. Thank you for this incredibly detailed and thought-provoking discussion. It has given me a much deeper appreciation for the nuances of advanced AI development.',
                sender: 'user',
                timestamp: new Date(Date.now() - 86400000 * 3 + 1380000)
            },
            {
                id: 'lc10',
                text: 'You are most welcome. It has been a genuine pleasure to explore these complex topics with you. Engaging in such discussions is vital as we navigate the path forward with artificial intelligence. Should you have more questions in the future, please don\'t hesitate to ask.',
                sender: 'assistant',
                timestamp: new Date(Date.now() - 86400000 * 3 + 1500000)
            }
        ],
        assistantId: "gpt-4"
    },
    "guid-markdown-chat": {
        id: "guid-markdown-chat",
        title: "Comprehensive Markdown Test",
        messages: [
            { id: 'md1', text: 'Please provide a comprehensive demonstration of various Markdown features.', sender: 'user', timestamp: new Date(Date.now() - 86400000) },
            {
                id: 'md2', text: `Okay, here's a thorough rundown of Markdown syntax:

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

---

This is a paragraph with **bold text**, *italic text*, and ~~strikethrough text~~.
You can also combine them: ***bold and italic***.

> This is a blockquote.
> It can span multiple lines.
>> And can be nested.

---

**Ordered List:**
1. First item
2. Second item
   1. Sub-item A
   2. Sub-item B
3. Third item

**Unordered List:**
* Bullet item
  * Nested bullet
    * Deeper nested bullet
- Another bullet item
+ Yet another bullet item

---

**Inline Code:**
Use \`inline code\` for short snippets like \`variableName\` or \`function()\`.

**Fenced Code Blocks:**
\`\`\`javascript
// Javascript code example
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet("Markdown User");
\`\`\`

\`\`\`python
# Python code example
def add(a, b):
  return a + b

result = add(5, 3)
print(f"The result is {result}")
\`\`\`

\`\`\`html
<!-- HTML code example -->
<div>
  <h1>Hello World</h1>
  <p>This is a paragraph.</p>
</div>
\`\`\`

---

**Links:**
This is an [inline link to Google](https://www.google.com).
This is a [link with a title](https://www.openai.com "OpenAI Website").

Reference-style links:
You can find more information at [OpenAI][1].
Another great resource is the [Mozilla Developer Network][MDN].

[1]: https://www.openai.com
[MDN]: https://developer.mozilla.org/

---

**Images:**
(Note: Actual image rendering depends on the Markdown parser and environment)
![Alt text for an image](https://photographylife.com/wp-content/uploads/2023/05/Nikon-Z8-Official-Samples-00002.jpg "Sample Image Title")

---

**Tables:**
| Header 1 | Header 2 | Header 3 |
| :------- | :------: | -------: |
| Left     | Center   | Right    |
| Cell A1  | Cell A2  | Cell A3  |
| Cell B1  | Cell B2  | Cell B3  |

---
This should cover most of the common Markdown features! Let me know if you need more examples.`, sender: 'assistant', timestamp: new Date(Date.now() - 86400000 + 60000)
            },
            { id: 'md3', text: 'Wow, that is indeed comprehensive! This will be perfect for testing the Markdown rendering. Thank you!', sender: 'user', timestamp: new Date(Date.now() - 86400000 + 120000) },
        ],
    }
};

export const getChats = (): Pick<Chat, 'id' | 'title'>[] => {
    return Object.values(mockChatsData).map(chat => ({
        id: chat.id,
        title: chat.title,
    }));
};

export const getChatById = (id: string): Chat | undefined => {
    return mockChatsData[id];
};

// Basic function to add a message to a chat (in-memory)
// This is a simplified version and doesn't persist changes beyond session if not careful with state
export const addMessageToChat = (chatId: string, message: Message): boolean => {
    const chat = mockChatsData[chatId];
    if (chat) {
        chat.messages.push(message);
        return true;
    }
    // If chat doesn't exist, we might want to create it or handle error
    // For now, let's assume new chats are handled differently or created before adding messages
    return false;
};

// Function to create a new chat (in-memory)
export const createNewChatEntry = (id: string, title: string, initialMessages: Message[] = [], assistantId?: string): Chat => {
    const newChat: Chat = {
        id,
        title,
        messages: initialMessages,
        assistantId,
    };
    mockChatsData[id] = newChat;
    return newChat;
}
