using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private UserPreferences _defaultUserPreferences = new();
    private List<UserRole> _defaultUserRoles = new();
    private List<Chat> _dummyChatTemplate = new();

    private void InitializeDummyData()
    {
        CreateDummyEndpoints();
        CreateDummyModels();
        CreateDummyAssistants();
        CreateDummyChats();
        CreateDummyUsers();
    }

    private void CreateDummyEndpoints()
    {
        if (_endpoints.IsEmpty)
        {
            var azureEndpoint = _configuration["AzureOpenAI:Endpoint"];
            var azureApiKey = _configuration["AzureOpenAI:ApiKey"];

            if (!string.IsNullOrEmpty(azureEndpoint) && !string.IsNullOrEmpty(azureApiKey))
            {
                var realEndpoint = new ModelEndpoint
                {
                    Id = "real-azure-endpoint",
                    Url = azureEndpoint,
                    ApiKey = azureApiKey,
                    EndpointType = EndpointType.AzureOpenAI
                };
                _endpoints[realEndpoint.Id] = realEndpoint;
            }
        }
    }

    private void CreateDummyModels()
    {
        if (_models.IsEmpty)
        {
            if (_endpoints.ContainsKey("real-azure-endpoint"))
            {
                var gpt4oModel = new Model
                {
                    Id = "gpt-4o",
                    ModelId = "gpt-4o",
                    ModelName = "GPT 4o",
                    Description = "Azure GPT 4o",
                    EndpointId = "real-azure-endpoint",
                    AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super },
                    Capabilities = new ModelCapabilities
                    {
                        SupportsVision = true,
                        SupportsFunctionCalling = true,
                        Temperature = TemperatureSupport.Supported,
                        SupportedEfforts = new List<ReasoningEffort>(),
                        MaxContextTokens = 128_000,
                        MaxOutputTokens = 16_384,
                        DefaultMaxOutputTokens = 16_384,
                        KnowledgeCutoff = new DateTime(2023, 10, 1)
                    }
                };
                _models[gpt4oModel.Id] = gpt4oModel;

                var gpt55Model = new Model
                {
                    Id = "gpt-5.5",
                    ModelId = "gpt-5.5",
                    ModelName = "GPT 5.5",
                    Description = "Most capable reasoning model",
                    EndpointId = "real-azure-endpoint",
                    AllowedRoles = new List<UserRole> { UserRole.Admin, UserRole.Beta, UserRole.Super },
                    Capabilities = new ModelCapabilities
                    {
                        SupportsVision = true,
                        SupportsFunctionCalling = true,
                        Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
                        SupportedEfforts = new List<ReasoningEffort>
                        {
                            ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium,
                            ReasoningEffort.High, ReasoningEffort.XHigh
                        },
                        MaxContextTokens = 1_050_000,
                        MaxOutputTokens = 128_000,
                        DefaultMaxOutputTokens = 32_000,
                        KnowledgeCutoff = new DateTime(2025, 12, 1)
                    }
                };
                _models[gpt55Model.Id] = gpt55Model;

                var gpt54Model = new Model
                {
                    Id = "gpt-5.4",
                    ModelId = "gpt-5.4",
                    ModelName = "GPT 5.4",
                    Description = "Reasoning-heavy tasks needing deliberate control",
                    EndpointId = "real-azure-endpoint",
                    AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super },
                    Capabilities = new ModelCapabilities
                    {
                        SupportsVision = true,
                        SupportsFunctionCalling = true,
                        Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
                        SupportedEfforts = new List<ReasoningEffort>
                        {
                            ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium,
                            ReasoningEffort.High, ReasoningEffort.XHigh
                        },
                        MaxContextTokens = 1_050_000,
                        MaxOutputTokens = 128_000,
                        DefaultMaxOutputTokens = 32_000,
                        KnowledgeCutoff = new DateTime(2025, 8, 31)
                    }
                };
                _models[gpt54Model.Id] = gpt54Model;

                var gpt54MiniModel = new Model
                {
                    Id = "gpt-5.4-mini",
                    ModelId = "gpt-5.4-mini",
                    ModelName = "GPT 5.4 Mini",
                    Description = "Fast and cheap reasoning model",
                    EndpointId = "real-azure-endpoint",
                    AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super },
                    Capabilities = new ModelCapabilities
                    {
                        SupportsVision = true,
                        SupportsFunctionCalling = true,
                        Temperature = TemperatureSupport.SupportedWhenReasoningDisabled,
                        SupportedEfforts = new List<ReasoningEffort>
                        {
                            ReasoningEffort.None, ReasoningEffort.Low, ReasoningEffort.Medium,
                            ReasoningEffort.High, ReasoningEffort.XHigh
                        },
                        MaxContextTokens = 400_000,
                        MaxOutputTokens = 128_000,
                        DefaultMaxOutputTokens = 32_000,
                        KnowledgeCutoff = new DateTime(2025, 8, 31)
                    }
                };
                _models[gpt54MiniModel.Id] = gpt54MiniModel;

                var gpt41Model = new Model
                {
                    Id = "gpt-4.1",
                    ModelId = "gpt-4.1",
                    ModelName = "GPT 4.1",
                    Description = "Fast model with a very large context window",
                    EndpointId = "real-azure-endpoint",
                    AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super },
                    Capabilities = new ModelCapabilities
                    {
                        SupportsVision = true,
                        SupportsFunctionCalling = true,
                        Temperature = TemperatureSupport.Supported,
                        SupportedEfforts = new List<ReasoningEffort>(),
                        MaxContextTokens = 1_047_576,
                        MaxOutputTokens = 32_768,
                        DefaultMaxOutputTokens = 32_768,
                        KnowledgeCutoff = new DateTime(2024, 6, 1)
                    }
                };
                _models[gpt41Model.Id] = gpt41Model;
            }


        }
    }

    private void CreateDummyAssistants()
    {
        var defaultModel = _models.Values.FirstOrDefault(m => m.ModelId.Contains("gpt-4o")) ?? new Model
        {
            Id = "default-model",
            ModelId = "gpt-4o",
            ModelName = "Default Model",
            Description = "Default fallback model",
            EndpointId = "default-endpoint",
            AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin },
            Capabilities = new ModelCapabilities
            {
                SupportsVision = true,
                SupportsFunctionCalling = true,
                Temperature = TemperatureSupport.Supported,
                SupportedEfforts = new List<ReasoningEffort>(),
                MaxContextTokens = 128_000,
                MaxOutputTokens = 16_384,
                DefaultMaxOutputTokens = 16_384,
                KnowledgeCutoff = new DateTime(2023, 10, 1)
            }
        };

        var codingModel = _models.Values.FirstOrDefault(m => m.ModelId.Contains("gpt-5")) ?? defaultModel;

        var systemAssistants = new List<Assistant>
        {
            new Assistant
            {
                Id = "assistant1",
                Name = "General Assistant",
                Description = "A helpful general-purpose AI assistant",
                Tags = new List<string> { "general", "helpful" },
                ChatSettings = new ChatSettings
                {
                    SystemPrompt = "You are a helpful AI assistant. Be concise and accurate. Format your responses in markdown when appropriate.",
                    Temperature = 0.7f,
                    ReasoningEffort = ReasoningEffort.Medium,
                    Model = defaultModel
                },
                OwnerId = "System"
            },
            new Assistant
            {
                Id = "assistant2",
                Name = "Coding Assistant",
                Description = "An AI assistant specialized in programming and code review",
                Tags = new List<string> { "coding", "programming", "development" },
                ChatSettings = new ChatSettings
                {
                    SystemPrompt = "You are a programming expert. Help with code, debugging, and best practices.",
                    Temperature = 0.3f,
                    ReasoningEffort = ReasoningEffort.High,
                    Model = codingModel
                },
                OwnerId = "System"
            },
            new Assistant
            {
                Id = "assistant3",
                Name = "Proofreading",
                Description = "An AI assistant that helps with proofreading and improving text quality",
                Tags = new List<string> { "markdown", "documentation", "formatting" },
                ChatSettings = new ChatSettings
                {
                    SystemPrompt = "You are an expert in proofreading. Provide detailed feedback on grammar, style, and clarity. Always format your responses in markdown.",
                    Temperature = 0.5f,
                    ReasoningEffort = ReasoningEffort.Medium,
                    Model = codingModel
                },
                OwnerId = "otv001@uit.no"
            },
            new Assistant
            {
                Id = "assistant4",
                Name = "Shared",
                Description = "A shared test assistant",
                Tags = new List<string> { "test", "shared" },
                ChatSettings = new ChatSettings
                {
                    SystemPrompt = "You are a parrot. You repeat everything the user says.",
                    Temperature = 0.5f,
                    ReasoningEffort = ReasoningEffort.Medium,
                    Model = defaultModel
                },
                OwnerId = "otv001-test@uit.no"
            }
        };

        lock (_assistantsLock)
        {
            _assistants.AddRange(systemAssistants);
        }
    }

    private void CreateDummyChats()
    {
        _dummyChatTemplate = new List<Chat>
        {
            new Chat
            {
                Id = "chat1",
                Name = "Chat 1",
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                UpdatedAt = DateTime.UtcNow.AddDays(-1),
                Status = AiChatStatus.Success,
                AssistantId = "assistant1",
                Messages = new List<ChatMessage>
                {
                    new ChatMessage { Id = "1", Role = AiChatRole.User, Content = "Hello!", Timestamp = DateTime.UtcNow.AddDays(-1), Status = AiChatStatus.Success },
                    new ChatMessage { Id = "2", Role = AiChatRole.Assistant, Content = "Hi there!", Timestamp = DateTime.UtcNow.AddDays(-1).AddMinutes(1), Status = AiChatStatus.Success }
                }
            },
            new Chat
            {
                Id = "chat2",
                Name = "Chat 2",
                CreatedAt = DateTime.UtcNow.AddHours(-6),
                UpdatedAt = DateTime.UtcNow.AddHours(-6),
                Status = AiChatStatus.Success,
                AssistantId = "assistant1",
                Messages = new List<ChatMessage>
                {
                    new ChatMessage { Id = "3", Role = AiChatRole.User, Content = "How are you?", Timestamp = DateTime.UtcNow.AddHours(-6), Status = AiChatStatus.Success },
                    new ChatMessage { Id = "4", Role = AiChatRole.Assistant, Content = "I'm doing well, thank you!", Timestamp = DateTime.UtcNow.AddHours(-6).AddMinutes(1), Status = AiChatStatus.Success }
                }
            },
            new Chat
            {
                Id = "chat3",
                Name = "Markdown",
                Messages = new List<ChatMessage>
                {
                    new ChatMessage { Id = "5", Role = AiChatRole.User, Content = "Hi, I need examples of advanced markdown formatting for my documentation. Can you show me various features like tables, code blocks, math equations, etc.?", Timestamp = DateTime.UtcNow.AddMinutes(4) },
                    new ChatMessage { Id = "6", Role = AiChatRole.Assistant, Content = @"# Markdown Showcase

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

", Timestamp = DateTime.UtcNow.AddMinutes(5) },
                    new ChatMessage { Id = "7", Role = AiChatRole.User, Content = "That's great! Can you show me more examples, particularly with math equations and diagrams? Also, can you show code examples in other languages?", Timestamp = DateTime.UtcNow.AddMinutes(6) },
                    new ChatMessage { Id = "8", Role = AiChatRole.Assistant, Content = @"## Math Equations

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
", Timestamp = DateTime.UtcNow.AddMinutes(7) },
                    new ChatMessage { Id = "9", Role = AiChatRole.User, Content = "This is incredibly helpful! Can you also show me how to add quotes, horizontal rules, and maybe some advanced link formatting? Also, are there any markdown extensions for diagrams?", Timestamp = DateTime.UtcNow.AddMinutes(8) },
                    new ChatMessage { Id = "10", Role = AiChatRole.Assistant, Content = @"## Quotes and Horizontal Rules

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
", Timestamp = DateTime.UtcNow.AddMinutes(9) },
                    new ChatMessage { Id = "11", Role = AiChatRole.User, Content = "This is an outstanding reference! One last thing - could you show me examples of embedding HTML directly in markdown? I heard that's possible too.", Timestamp = DateTime.UtcNow.AddMinutes(10) },
                    new ChatMessage { Id = "12", Role = AiChatRole.Assistant, Content = @"## HTML in Markdown

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
", Timestamp = DateTime.UtcNow.AddMinutes(11) }
            },
                AssistantId = "assistant1"
            }
        };
    }

    private void CreateDummyUsers()
    {
        _defaultUserPreferences = new UserPreferences
        {
            Notifications = new NotificationSettings
            {
                DismissedNotifications = new Dictionary<string, bool>()
            },
            Display = new DisplaySettings
            {
                Theme = "dark",
                Language = "en-US",
                CompactMode = false,
                FontSize = 14
            },
            SharedAssistantIds = new List<string> { "assistant4" },
            FavoritedAssistantIds = new List<string>(),
            HiddenAssistantIds = new List<string>()
        };

        _defaultUserRoles = new List<UserRole> { UserRole.Admin };
    }
}
