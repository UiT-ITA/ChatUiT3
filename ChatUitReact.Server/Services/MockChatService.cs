using ChatUitReact.Server.Models;
using Microsoft.AspNetCore.SignalR;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models.DTOs;
using System.Text;
using ChatUitReact.Server.Extentions;
using static ChatUitReact.Server.Extentions.MessageFactoryExtensions;

namespace ChatUitReact.Server.Services;

public class MockChatService : IChatService
{
    private readonly IHubContext<ChatHub, IChatHubClient> _hubContext;
    private readonly ILogger<MockChatService> _logger;
    private readonly Dictionary<string, Dictionary<string, AiChat>> _userChats = new();
    
    // Helper method to create a message with a specific ID and timestamp
    private AiChatMessage CreateMessageWithId(string id, string content, AiChatRole role, DateTime timestamp)
    {
        var message = TextMessage(content, role);
        message.Id = id;
        message.Timestamp = timestamp;
        return message;
    }

    public MockChatService(
        IHubContext<ChatHub, IChatHubClient> hubContext,
        ILogger<MockChatService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
        InitializeMockData();
    }

    private void InitializeMockData()
    {
        // Initialize with mock data using factory methods
        var anonymousChats = new Dictionary<string, AiChat>
        {
            ["guid-123-abc"] = new AiChat
            {
                Id = "guid-123-abc",
                Name = "React Hooks Discussion",
                Messages = new List<AiChatMessage>
                {
                    CreateMessageWithId("c1m1", "Hello from chat 123-abc!", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-2)),
                    CreateMessageWithId("c1m2", "This is a specific, existing chat about React Hooks.", AiChatRole.User, DateTime.UtcNow.AddHours(-2).AddMinutes(2)),
                    CreateMessageWithId("c1m3", "Indeed it is. How can I assist you further in this context?", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-2).AddMinutes(3))
                },
                CurrentSettings = new AiModelSettings { Temperature = 0.7f },
                CreatedAt = DateTime.UtcNow.AddHours(-2)
            },
            ["guid-456-def"] = new AiChat
            {
                Id = "guid-456-def",
                Name = "Project Ideas",
                Messages = new List<AiChatMessage>
                {
                    CreateMessageWithId("c2m1", "Welcome to chat 456-def, let's brainstorm some project ideas.", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-1)),
                    CreateMessageWithId("c2m2", "I have a query about this particular chat session regarding project planning.", AiChatRole.User, DateTime.UtcNow.AddHours(-1).AddMinutes(2))
                },
                CurrentSettings = new AiModelSettings { Temperature = 0.8f },
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            },
            ["guid-789-ghi"] = new AiChat
            {
                Id = "guid-789-ghi",
                Name = "CSS Styling Help",
                Messages = new List<AiChatMessage>
                {
                    CreateMessageWithId("c3m1", "Having some trouble with CSS flexbox.", AiChatRole.User, DateTime.UtcNow.AddMinutes(-30)),
                    CreateMessageWithId("c3m2", "Flexbox can be tricky! What specifically are you trying to achieve?", AiChatRole.Assistant, DateTime.UtcNow.AddMinutes(-28))
                },
                CurrentSettings = new AiModelSettings { Temperature = 0.5f },
                CreatedAt = DateTime.UtcNow.AddMinutes(-30)
            },
            ["guid-markdown-test"] = new AiChat // ABSOLUTELY NO ONE IS ALLOWEED TO TOUCH THIS CHAT!!!!
            {
                Id = "guid-markdown-test",
                Name = "Advanced Markdown Examples",
                Messages = new List<AiChatMessage>
                {
                    CreateMessageWithId("md1", "Hi, I need examples of advanced markdown formatting for my documentation. Can you show me various features like tables, code blocks, math equations, etc.?", AiChatRole.User, DateTime.UtcNow.AddHours(-5)),
                    
                    CreateMessageWithId("md2", @"# Markdown Showcase

Certainly! I'd be happy to demonstrate various markdown formatting options.

## Basic Formatting

You can use **bold text** or *italic text* or even ***bold and italic***. 

### Lists

Here's an ordered list:
1. First item
2. Second item
   1. Sub-item 1
   2. Sub-item 2
3. Third item

And an unordered list:
- Apples
  - Honeycrisp
  - Granny Smith
- Oranges
- Bananas

## Tables

Here's a comparison table of programming languages:

| Language | Paradigm | Typing | Year |
|----------|----------|--------|------|
| Python   | Multi-paradigm | Dynamic | 1991 |
| JavaScript | Multi-paradigm | Dynamic | 1995 |
| C++      | Multi-paradigm | Static | 1985 |
| Rust     | Multi-paradigm | Static | 2010 |
| Haskell  | Functional | Static | 1990 |

## Code Blocks

Here's a Python example:

```python
def fibonacci(n):
    if n <= 1:
        return n
    else:
        return fibonacci(n-1) + fibonacci(n-2)
        
# Print first 10 Fibonacci numbers
for i in range(10):
    print(fibonacci(i))
```

", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-5).AddMinutes(2)),
                    
                    CreateMessageWithId("md3", "That's great! Can you show me more examples, particularly with math equations and diagrams? Also, can you show code examples in other languages?", AiChatRole.User, DateTime.UtcNow.AddHours(-5).AddMinutes(5)),
                    
                    CreateMessageWithId("md4", @"## Math Equations

Markdown supports LaTeX-style math equations. Here are some examples:

Inline equation: $E = mc^2$

Block equation:
$$\frac{d}{dx}(x^n) = nx^{n-1}$$

Complex equation:
$$
\begin{align}
\nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} & = \frac{4\pi}{c}\vec{\mathbf{j}} \\
\nabla \cdot \vec{\mathbf{E}} & = 4 \pi \rho \\
\nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} & = \vec{\mathbf{0}} \\
\nabla \cdot \vec{\mathbf{B}} & = 0
\end{align}
$$

## More Code Examples

### JavaScript
```javascript
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  
  greet() {
    return `Hello, my name is ${this.name} and I am ${this.age} years old.`;
  }
}

const alice = new Person('Alice', 28);
console.log(alice.greet());
```

### C#
```csharp
using System;

public class Program
{
    public static void Main()
    {
        Console.WriteLine(""Hello, World!"");
        
        // LINQ example
        var numbers = new List<int> { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 };
        var evenNumbers = numbers.Where(n => n % 2 == 0).ToList();
        
        Console.WriteLine(string.Join("", "", evenNumbers));
    }
}
```

### SQL
```sql
SELECT 
    Customers.CustomerName, 
    Orders.OrderID, 
    Products.ProductName, 
    OrderDetails.Quantity
FROM Customers
JOIN Orders ON Customers.CustomerID = Orders.CustomerID
JOIN OrderDetails ON Orders.OrderID = OrderDetails.OrderID
JOIN Products ON OrderDetails.ProductID = Products.ProductID
WHERE Orders.OrderDate > '2023-01-01'
ORDER BY Customers.CustomerName, Orders.OrderID;
```
", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-5).AddMinutes(7)),
                    
                    CreateMessageWithId("md5", "This is incredibly helpful! Can you also show me how to add quotes, horizontal rules, and maybe some advanced link formatting? Also, are there any markdown extensions for diagrams?", AiChatRole.User, DateTime.UtcNow.AddHours(-5).AddMinutes(10)),
                    
                    CreateMessageWithId("md6", @"## Quotes and Horizontal Rules

> This is a simple blockquote.

> This is a multi-line blockquote.
> 
> It can contain multiple paragraphs.
> 
> > And even nested blockquotes!

Horizontal rules:

---

Or:

***

## Advanced Links

[Basic link](https://example.com)

[Link with title](https://example.com ""Example Website"")

Reference style links: [Click here][ref1] for more information.

[ref1]: https://example.com ""Reference Link""

## Images

![Alt text for an image](https://th.bing.com/th/id/R.48e64026b142ed723730c32b3090821c?rik=d%2bOBq%2bgPO5A3dw&pid=ImgRaw&r=0 ""Image Title"")

## Task Lists

- [x] Task 1 (completed)
- [ ] Task 2 (not completed)
- [x] Task 3 (completed)

## Diagrams (with Mermaid)

Markdown-based diagram tools like Mermaid allow for creating flowcharts, sequence diagrams, etc.:

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
```

Sequence diagram:

```mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!
```

Class diagram:

```mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
        +String beakColor
        +swim()
        +quack()
    }
    class Fish{
        -int sizeInFeet
        -canEat()
    }
    class Zebra{
        +bool is_wild
        +run()
    }
```

## Footnotes

Here's a sentence with a footnote[^1].

[^1]: This is the footnote content.

## Definition Lists

Term
: Definition for the term

Another Term
: Definition for another term
: A second definition for another term

## Syntax Highlighting with Diff

```diff
- const oldCode = 'to be removed';
+ const newCode = 'to be added';
```

I hope these examples cover what you're looking for!
", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-5).AddMinutes(12)),

                    CreateMessageWithId("md7", "This is an outstanding reference! One last thing - could you show me examples of embedding HTML directly in markdown? I heard that's possible too.", AiChatRole.User, DateTime.UtcNow.AddHours(-5).AddMinutes(14)),
                    
                    CreateMessageWithId("md8", @"## HTML in Markdown

Yes, most Markdown parsers allow embedding HTML directly. Here are some examples:

### Basic HTML Elements

<div style=""padding: 15px; background-color: #f0f0f0; border-radius: 5px;"">
  <h3 style=""color: #333;"">This is a custom styled div</h3>
  <p>You can use <span style=""color: red;"">inline styles</span> to customize the appearance.</p>
</div>

### Tables with Custom Styling

<table style=""border-collapse: collapse; width: 100%;"">
  <thead>
    <tr style=""background-color: #4CAF50; color: white;"">
      <th style=""border: 1px solid #ddd; padding: 8px;"">Name</th>
      <th style=""border: 1px solid #ddd; padding: 8px;"">Email</th>
      <th style=""border: 1px solid #ddd; padding: 8px;"">Phone</th>
    </tr>
  </thead>
  <tbody>
    <tr style=""background-color: #f2f2f2;"">
      <td style=""border: 1px solid #ddd; padding: 8px;"">John Doe</td>
      <td style=""border: 1px solid #ddd; padding: 8px;"">john@example.com</td>
      <td style=""border: 1px solid #ddd; padding: 8px;"">(123) 456-7890</td>
    </tr>
    <tr>
      <td style=""border: 1px solid #ddd; padding: 8px;"">Jane Smith</td>
      <td style=""border: 1px solid #ddd; padding: 8px;"">jane@example.com</td>
      <td style=""border: 1px solid #ddd; padding: 8px;"">(123) 456-7891</td>
    </tr>
  </tbody>
</table>

### Custom Details/Summary Elements

<details>
  <summary>Click to reveal hidden content</summary>
  
  This content is hidden by default and will be shown when the user clicks on the summary.
  
  You can include **markdown** within HTML elements too.
</details>

### Embedding Media

<audio controls>
  <source src=""https://example.com/audio.mp3"" type=""audio/mpeg"">
  Your browser does not support the audio element.
</audio>

<iframe width=""560"" height=""315"" src=""https://www.youtube.com/embed/dQw4w9WgXcQ"" frameborder=""0"" allowfullscreen></iframe>

### Progress Bars

<progress value=""70"" max=""100"">70%</progress>

<meter value=""0.6"">60%</meter>

### Custom Layout Elements

<div style=""display: flex; justify-content: space-between;"">
  <div style=""flex: 1; padding: 10px; background-color: #e6f7ff; margin-right: 10px;"">
    <h4>Section 1</h4>
    <p>This is the content for section 1.</p>
  </div>
  <div style=""flex: 1; padding: 10px; background-color: #fff7e6; margin-right: 10px;"">
    <h4>Section 2</h4>
    <p>This is the content for section 2.</p>
  </div>
  <div style=""flex: 1; padding: 10px; background-color: #f6ffed;"">
    <h4>Section 3</h4>
    <p>This is the content for section 3.</p>
  </div>
</div>

### Combining Markdown and HTML

<div style=""border: 1px solid #ccc; padding: 10px; border-radius: 5px;"">
  <h3>Mixing HTML and Markdown</h3>
  
  Within this HTML div, you can still use **bold** and *italic* markdown formatting.
  
  - List item 1
  - List item 2
  
  ```javascript
  // Code blocks work too
  function sayHello() {
    console.log('Hello!');
  }
  ```
</div>

Note: Some Markdown processors may have limitations on what HTML is allowed, and some environments may sanitize HTML for security reasons. Always check the specific platform's documentation.
", AiChatRole.Assistant, DateTime.UtcNow.AddHours(-5).AddMinutes(17))
                },
                CurrentSettings = new AiModelSettings { Temperature = 0.7f },
                CreatedAt = DateTime.UtcNow.AddHours(-5)
            }
        };

        _userChats["anonymous"] = anonymousChats;
    }

    // Chat Management
    public Task<List<AiChat>> GetChatsAsync(string userId)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        if (!_userChats.ContainsKey(userId))
        {
            _userChats[userId] = _userChats["anonymous"].ToDictionary(
                kvp => kvp.Key,
                kvp => CloneChat(kvp.Value));
        }
        
        var result = _userChats[userId].Values.OrderByDescending(c => c.UpdatedAt).ToList();
        return Task.FromResult(result);
    }
    
    public Task<AiChat?> GetChatByIdAsync(string userId, string chatId)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (_userChats.TryGetValue(userId, out var chats) && chats.TryGetValue(chatId, out var chat))
        {
            return Task.FromResult<AiChat?>(chat);
        }
        
        return Task.FromResult<AiChat?>(null);
    }
    
    public async Task<AiChat> CreateChatAsync(string userId, string title, AiModelSettings settings)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.ContainsKey(userId))
        {
            _userChats[userId] = new Dictionary<string, AiChat>();
        }
        
        var chat = new AiChat
        {
            Id = Guid.NewGuid().ToString(),
            Name = title,
            CreatedAt = DateTime.UtcNow,
            CurrentSettings = settings,
            Messages = new List<AiChatMessage>()
        };
        
        _userChats[userId][chat.Id] = chat;
        
        // No auto-messages - just create the empty chat
        
        // Notify clients about the new chat
        await NotifyChatListUpdatedAsync(userId);
        
        return chat;
    }
    
    public async Task<AiChat> CreateChatWithMessageAsync(string userId, string title, AiChatMessage initialMessage, AiModelSettings settings)
    {
        // First create the chat
        var chat = await CreateChatAsync(userId, title, settings);
        
        // Then add the first message
        await AddMessageAsync(userId, chat.Id, initialMessage);
        
        // Start a streaming response for the initial message
        _ = Task.Run(async () => 
        {
            try
            {
                await StartStreamingResponseAsync(userId, chat.Id, initialMessage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating streaming response for initial message in chat {ChatId}", chat.Id);
            }
        });
        
        return chat;
    }
    
    private string GetChatNameFromInitialMessage(string initialMessage)
    {
        // Generate a title based on the initial message
        if (string.IsNullOrWhiteSpace(initialMessage))
            return "New Chat";
            
        // Take the first 30 characters or the first sentence, whichever is shorter
        int endIndex = Math.Min(30, initialMessage.Length);
        int firstPeriod = initialMessage.IndexOf('.');
        if (firstPeriod > 0 && firstPeriod < endIndex)
            endIndex = firstPeriod;
            
        string title = initialMessage.Substring(0, endIndex).Trim();
        if (initialMessage.Length > endIndex)
            title += "...";
            
        return title;
    }
    
    public async Task<AiChat?> RenameChatAsync(string userId, string chatId, string newTitle)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            return null;
        }
        
        chat.Name = newTitle;
        
        // Notify about the update
        await NotifyChatListUpdatedAsync(userId);
        
        return chat;
    }
    
    public async Task<bool> DeleteChatAsync(string userId, string chatId)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.ContainsKey(chatId))
        {
            return false;
        }
        
        chats.Remove(chatId);
        
        // Notify about the update
        await NotifyChatListUpdatedAsync(userId);
        
        return true;
    }
    
    // Message Operations
    public async Task<AiChatMessage> AddMessageAsync(string userId, string chatId, AiChatMessage message)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            throw new ArgumentException($"Chat with ID {chatId} not found");
        }
        
        chat.Messages.Add(message);
        
        // Notify about chat list update (to show new activity)
        await NotifyChatListUpdatedAsync(userId);
        
        // Send the user message via SignalR
        await SendMessageNotificationAsync(userId, chatId, message);
        
        // We're removing the auto-generation of AI responses here
        // The streaming response should be the only AI response
        
        return message;
    }
    
    public async Task<AiChatMessage> AddMessageAsync(string userId, string chatId, string textContent)
    {
        // Create a text message and add it
        var message = TextMessage(textContent, AiChatRole.User);
        return await AddMessageAsync(userId, chatId, message);
    }
    
    public async Task<bool> UpdateMessageAsync(string userId, string chatId, string messageId, AiChatMessage updatedMessage)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            return false;
        }
        
        var messageIndex = chat.Messages.FindIndex(m => m.Id == messageId);
        if (messageIndex < 0)
        {
            return false;
        }
        
        // Preserve the original ID and update the message
        updatedMessage.Id = messageId;
        chat.Messages[messageIndex] = updatedMessage;
        
        await NotifyChatListUpdatedAsync(userId);
        await SendMessageNotificationAsync(userId, chatId, updatedMessage);
        
        return true;
    }
    
    // AI Response
    public async Task<AiChatMessage> GetAiResponseAsync(string userId, string chatId, AiChatMessage userMessage)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            throw new ArgumentException($"Chat with ID {chatId} not found");
        }
        
        // Generate mock response based on the text chunks in the user message
        string userText = GetTextFromMessage(userMessage);
        string responseText = GenerateResponse(userText);
        
        // Create assistant message
        var assistantMessage = TextMessage(responseText, AiChatRole.Assistant);
        
        chat.Messages.Add(assistantMessage);
        
        // Notify about the message
        await SendMessageNotificationAsync(userId, chatId, assistantMessage);
        
        return assistantMessage;
    }
    
    private string GetTextFromMessage(AiChatMessage message)
    {
        // Extract text from message chunks
        var textChunks = message.Content
            .Where(c => c.Type == AiMessageChunkType.Text)
            .Select(c => c.Content);
            
        return string.Join("\n", textChunks);
    }
    
    private string GenerateResponse(string userInput)
    {
        // Simple mock response generator
        string[] responses = {
            $"Thank you for your message: \"{userInput}\". This is a mock response from the AI assistant.",
            $"I understand you're asking about \"{userInput}\". In a real implementation, this would be processed by an AI model.",
            $"Your input about \"{userInput}\" has been received. This is a simulated response from the service."
        };
        
        return responses[Math.Abs(userInput.GetHashCode()) % responses.Length];
    }
    
    public async Task<AiChatMessage> GetAiResponseAsync(string userId, string chatId, string textContent)
    {
        // Create a user message with the text content
        var userMessage = TextMessage(textContent, AiChatRole.User);
        
        // Add the user message to the chat
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            throw new ArgumentException($"Chat with ID {chatId} not found");
        }
        
        chat.Messages.Add(userMessage);
        await SendMessageNotificationAsync(userId, chatId, userMessage);
        
        // Get the AI response
        return await GetAiResponseAsync(userId, chatId, userMessage);
    }
    
    // Streaming AI Response
    public async Task StartStreamingResponseAsync(string userId, string chatId, AiChatMessage userMessage)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            throw new ArgumentException($"Chat with ID {chatId} not found");
        }
        
        // Add the user message to chat if it's not already there
        if (!chat.Messages.Any(m => m.Id == userMessage.Id))
        {
            chat.Messages.Add(userMessage);
            await SendMessageNotificationAsync(userId, chatId, userMessage);
        }
        
        // Create empty assistant message placeholder
        var assistantMessage = new AiChatMessage
        {
            Id = Guid.NewGuid().ToString(),
            Content = new List<MessageChunk>(),
            Role = AiChatRole.Assistant,
            Timestamp = DateTime.UtcNow
        };
        
        chat.Messages.Add(assistantMessage);
        
        // Start streaming the response
        await StreamSimulatedResponseAsync(userId, chatId, assistantMessage.Id, GetTextFromMessage(userMessage));
    }
    
    public async Task StartStreamingResponseAsync(string userId, string chatId, string textContent)
    {
        // Create a user message with the text content
        var userMessage = TextMessage(textContent, AiChatRole.User);
        
        // Start streaming response
        await StartStreamingResponseAsync(userId, chatId, userMessage);
    }
    
    /// <summary>
    /// Stream a simulated response using chunks
    /// </summary>
    private async Task StreamSimulatedResponseAsync(string userId, string chatId, string messageId, string userPrompt)
    {
        // Generate a response
        string[] responses = {
            $"I've received your message. Here's a streaming response that's being sent chunk by chunk with some delay to simulate typing.\n\nThis is useful for showing the user that the system is working and thinking. It provides feedback that something is happening rather than just waiting for a complete response.\n\nStreaming is particularly valuable for longer AI responses, as it lets users start reading the beginning of the response while the rest is still being generated.",
            
            $"Thanks for your prompt. I'm demonstrating how streaming responses work in this interface.\n\nAs you can see, the text appears gradually, which creates a more interactive experience. Users can begin processing the response immediately rather than waiting for the entire message.\n\nThis implementation uses SignalR to establish a WebSocket connection, allowing real-time updates without repeated HTTP requests.",
            
            $"Let me explain how this streaming functionality works:\n\n1. The client sends a request to the server\n2. The server creates an initial empty message\n3. The AI generates content and sends it chunk by chunk\n4. Each chunk is displayed immediately in the UI\n5. The complete message is saved once generation is complete\n\nThis approach feels more natural and conversational for users."
        };
        
        string fullResponse = responses[Math.Abs(userPrompt.GetHashCode()) % responses.Length];
        
        // Break the response into chunks by words for more natural streaming
        StringBuilder accumulatedText = new StringBuilder();
        string[] words = fullResponse.Split(' ');
        
        // First send an initial empty message to all clients in the group
        await _hubContext.Clients.Group(userId).ReceiveMessage(chatId, new MessageDto 
        {
            Id = messageId,
            Sender = "assistant",
            Timestamp = DateTime.UtcNow,
            Chunks = new List<MessageChunkDto>(),
            ContentType = "text"
        });
        
        // Stream each word or small group of words with a delay
        for (int i = 0; i < words.Length; i++)
        {
            // Sometimes group 1-3 words together
            int wordsToTake = Random.Shared.Next(1, 4);
            wordsToTake = Math.Min(wordsToTake, words.Length - i);
            
            // Build the chunk from the words
            string chunk = string.Join(' ', words.Skip(i).Take(wordsToTake));
            if (i > 0) chunk = " " + chunk; // Add space except for first word
            
            // Advance the counter (minus 1 because the loop will increment)
            i += wordsToTake - 1;
            
            // Is this the last chunk?
            bool isComplete = (i >= words.Length - 1);
            
            // Add chunk to accumulated text
            accumulatedText.Append(chunk);
            
            try
            {
                // Send the chunk via proper message chunk method to ALL clients in the user's group
                await _hubContext.Clients.Group(userId).ReceiveMessageChunk(
                    chatId,
                    messageId,
                    chunk,
                    isComplete
                );
                
                // Add small delay to let the SignalR connection send the message
                await Task.Delay(10);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message chunk to client");
            }
            
            // Artificial delay between chunks (100-400ms to simulate typing)
            await Task.Delay(Random.Shared.Next(100, 401));
        }
        
        // Update the message with the complete content
        if (_userChats.TryGetValue(userId, out var chats) && 
            chats.TryGetValue(chatId, out var chat))
        {
            var message = chat.Messages.FirstOrDefault(m => m.Id == messageId);
            if (message != null)
            {
                message.Content = new List<MessageChunk>
                {
                    new MessageChunk
                    {
                        Type = AiMessageChunkType.Text,
                        Content = accumulatedText.ToString()
                    }
                };
                
                // Send a complete message
                await SendMessageNotificationAsync(userId, chatId, message);
            }
        }
    }
    
    // Settings
    public async Task<AiChat?> UpdateChatSettingsAsync(string userId, string chatId, AiModelSettings settings)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (!_userChats.TryGetValue(userId, out var chats) || !chats.TryGetValue(chatId, out var chat))
        {
            return null;
        }
        
        chat.CurrentSettings = settings;
        
        // Notify about the update
        await NotifyChatListUpdatedAsync(userId);
        
        return chat;
    }
    
    // Get Messages
    public Task<List<AiChatMessage>> GetMessagesAsync(string userId, string chatId)
    {
        userId = string.IsNullOrEmpty(userId) ? "anonymous" : userId;
        
        if (_userChats.TryGetValue(userId, out var chats) && chats.TryGetValue(chatId, out var chat))
        {
            return Task.FromResult(chat.Messages.ToList());
        }
        
        throw new ArgumentException($"Chat with ID {chatId} not found");
    }
    
    // Helper Methods
    private async Task NotifyChatListUpdatedAsync(string userId)
    {
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("NotifyChatListUpdatedAsync called with empty userId");
            return; // No anonymous users allowed - exit early if userId is empty
        }
        
        try
        {
            var chats = await GetChatsAsync(userId);
            var chatListDtos = chats.Select(chat => new ChatListItemDto
            {
                Id = chat.Id,
                Title = chat.Name,
                LastUpdated = chat.UpdatedAt,
                AssistantId = chat.Assistant?.Id
            }).ToList();
            
            // Notify all clients in the user's group about the updated chat list
            await _hubContext.Clients.Group(userId).ChatListUpdated(chatListDtos);
            
            _logger.LogInformation("Notified user {UserId} about chat list update with {ChatCount} chats", 
                userId, chatListDtos.Count);
            
            // For reliability, implement a retry mechanism for critical broadcasts
            var retryCount = 0;
            const int maxRetries = 2;
            
            while (retryCount < maxRetries)
            {
                try
                {
                    // Small delay to allow any network issues to resolve
                    await Task.Delay(50 * (retryCount + 1));
                    
                    // Additional broadcast to ensure delivery to all clients
                    await _hubContext.Clients.Group(userId).ChatListUpdated(chatListDtos);
                    
                    break; // Success, exit retry loop
                }
                catch (Exception retryEx)
                {
                    retryCount++;
                    _logger.LogWarning(retryEx, "Retry {RetryCount}/{MaxRetries} failed for chat list update to user {UserId}", 
                        retryCount, maxRetries, userId);
                    
                    if (retryCount >= maxRetries)
                    {
                        throw; // Re-throw after max retries
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying clients about chat list update for user {UserId}", userId);
        }
    }
    
    private async Task SendMessageNotificationAsync(string userId, string chatId, AiChatMessage message)
    {
        try
        {
            // Convert the message to DTO using the extension method
            var messageDto = message.ToMessageDto();
            
            // Send to all clients in the user's group
            await _hubContext.Clients.Group(userId).ReceiveMessage(chatId, messageDto);
            
            _logger.LogInformation("Message notification sent to all clients in group {UserId} for chat {ChatId}, message ID {MessageId}", 
                userId, chatId, message.Id);
                
            // For critical messages, implement a retry mechanism
            var retryCount = 0;
            const int maxRetries = 1;
            
            while (retryCount < maxRetries)
            {
                try
                {
                    // Small delay to allow any network issues to resolve
                    await Task.Delay(100);
                    
                    // Additional broadcast to ensure delivery to all clients
                    await _hubContext.Clients.Group(userId).ReceiveMessage(chatId, messageDto);
                    break; // Success, exit retry loop
                }
                catch (Exception retryEx)
                {
                    retryCount++;
                    _logger.LogWarning(retryEx, "Retry {RetryCount}/{MaxRetries} failed for message notification to user {UserId}", 
                        retryCount, maxRetries, userId);
                    
                    if (retryCount >= maxRetries)
                    {
                        throw; // Re-throw after max retries
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message notification");
        }
    }
    
    private AiChat CloneChat(AiChat original)
    {
        return new AiChat
        {
            Id = original.Id,
            Name = original.Name,
            Messages = original.Messages.Select(m => new AiChatMessage
            {
                Id = m.Id,
                Content = m.Content.ToList(), // Clone the content list
                Role = m.Role,
                Timestamp = m.Timestamp,
                Filename = m.Filename
            }).ToList(),
            CurrentSettings = original.CurrentSettings != null ? new AiModelSettings
            {
                Temperature = original.CurrentSettings.Temperature,
                MaxTokens = original.CurrentSettings.MaxTokens,
                TopP = original.CurrentSettings.TopP,
                FrequencyPenalty = original.CurrentSettings.FrequencyPenalty,
                PresencePenalty = original.CurrentSettings.PresencePenalty,
                ReasoningEffort = original.CurrentSettings.ReasoningEffort
            } : new AiModelSettings(),
            Assistant = original.Assistant != null ? new AiAssistant
            {
                Id = original.Assistant.Id,
                Name = original.Assistant.Name
            } : null,
            CreatedAt = original.CreatedAt
        };
    }
}
