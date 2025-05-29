using ChatUitReact.Server.Models;
using System.Collections.Concurrent;
using Microsoft.Extensions.Configuration;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService : IDatabaseService
{
    private readonly IConfiguration _configuration;
    
    private UserInfo _userInfo = new UserInfo
    {
        Preferences = new UserPreferences
        {
            Notifications = new NotificationSettings(),
            Display = new DisplaySettings()
        },
        Roles = new List<UserRole> { UserRole.Admin }
    };

    private List<AiChat> dummyHistory = new List<AiChat>
    {
        new AiChat
        {
            Id = "00000000-0000-0000-0000-000000000001",
            Name = "Chat 1",
            Messages = new List<AiChatMessage>
            {
                new AiChatMessage { Id = "1", Role = AiChatRole.User, Content = "Hello!", Timestamp = DateTime.UtcNow },
                new AiChatMessage { Id = "2", Role = AiChatRole.Assistant, Content = "Hi there!", Timestamp = DateTime.UtcNow.AddMinutes(1) }
            },
            Settings = new AiChatSettings { AssistantName = "Assistant 1" }
        },
        new AiChat
        {
            Id = "00000000-0000-0000-0000-000000000002",
            Name = "Chat 2",
            Messages = new List<AiChatMessage>
            {
                new AiChatMessage { Id = "3", Role = AiChatRole.User, Content = "How are you?", Timestamp = DateTime.UtcNow.AddMinutes(2) },
                new AiChatMessage { Id = "4", Role = AiChatRole.Assistant, Content = "I'm fine, thank you!", Timestamp = DateTime.UtcNow.AddMinutes(3) }
            },
            Settings = new AiChatSettings { AssistantName = "Assistant 2" }
        },
        new AiChat
        {
            Id = "00000000-0000-0000-0000-000000000003",
            Name = "Markdown",
            Messages = new List<AiChatMessage>
            {
                new AiChatMessage { Id = "5", Role = AiChatRole.User, Content = "Hi, I need examples of advanced markdown formatting for my documentation. Can you show me various features like tables, code blocks, math equations, etc.?", Timestamp = DateTime.UtcNow.AddMinutes(4) },
                new AiChatMessage { Id = "6", Role = AiChatRole.Assistant, Content = @"# Markdown Showcase

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
                new AiChatMessage { Id = "7", Role = AiChatRole.User, Content = "That's great! Can you show me more examples, particularly with math equations and diagrams? Also, can you show code examples in other languages?", Timestamp = DateTime.UtcNow.AddMinutes(6) },
                new AiChatMessage { Id = "8", Role = AiChatRole.Assistant, Content = @"## Math Equations

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
                new AiChatMessage { Id = "9", Role = AiChatRole.User, Content = "This is incredibly helpful! Can you also show me how to add quotes, horizontal rules, and maybe some advanced link formatting? Also, are there any markdown extensions for diagrams?", Timestamp = DateTime.UtcNow.AddMinutes(8) },
                new AiChatMessage { Id = "10", Role = AiChatRole.Assistant, Content = @"## Quotes and Horizontal Rules

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
                new AiChatMessage { Id = "11", Role = AiChatRole.User, Content = "This is an outstanding reference! One last thing - could you show me examples of embedding HTML directly in markdown? I heard that's possible too.", Timestamp = DateTime.UtcNow.AddMinutes(10) },
                new AiChatMessage { Id = "12", Role = AiChatRole.Assistant, Content = @"## HTML in Markdown

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
            Settings = new AiChatSettings { AssistantName = "Assistant 3" }
        }
    };

    private ConcurrentDictionary<string, List<AiChat>> _chatStorage = new ConcurrentDictionary<string, List<AiChat>>();
    private ConcurrentDictionary<string, AiModelEndpoint> _endpoints = new ConcurrentDictionary<string, AiModelEndpoint>();
    private ConcurrentDictionary<string, AiModel> _models = new ConcurrentDictionary<string, AiModel>();

    public MockDatabaseService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private void AddUserToService(string userId)
    {
        _chatStorage.GetOrAdd(userId, _ => 
        {
            List<AiChat> userChats = new List<AiChat>();
            foreach (var chat in dummyHistory)
            {
                userChats.Add(new AiChat
                {
                    Id = chat.Id,
                    Name = chat.Name,
                    Messages = chat.Messages.Select(m => new AiChatMessage
                    {
                        Id = m.Id,
                        Role = m.Role,
                        Content = m.Content,
                        Timestamp = m.Timestamp
                    }).ToList(),
                    Settings = new AiChatSettings
                    {
                        AssistantName = chat.Settings.AssistantName
                    }
                });
            }
            return userChats;
        });
    }
}
