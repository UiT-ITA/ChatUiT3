using ChatUitReact.Server.Models.DTOs;
using System.Diagnostics;

namespace ChatUitReact.Server.Services;

public class DatabaseService
{
    private readonly List<AiChatDto> _chats = new();
    private readonly List<AiAssistantDto> _assistants = new();
    private readonly object _lock = new();
    private readonly ILogger<DatabaseService> _logger;

    public DatabaseService(ILogger<DatabaseService> logger)
    {
        _logger = logger;

        // Initialize with some sample assistants
        _assistants.Add(new AiAssistantDto
        {
            Id = "gpt-4",
            Name = "GPT-4",
            Description = "Advanced AI assistant capable of complex reasoning",
            ModelId = "gpt-4"
        });

        _assistants.Add(new AiAssistantDto
        {
            Id = "gpt-3.5-turbo",
            Name = "GPT-3.5 Turbo",
            Description = "Fast and efficient AI assistant for general tasks",
            ModelId = "gpt-3.5-turbo"
        });
    }

    // We now create sample chats for the user on the first request
    private void CreateSampleChatsForUser(string userId)
    {
        _logger.LogInformation("Creating sample chats for user: {UserId}", userId);

        // Check if user already has chats
        if (_chats.Any(c => c.UserId == userId))
        {
            _logger.LogInformation("User already has chats, not creating samples");
            return;
        }

        var sampleChat1 = new AiChatDto
        {
            Id = Guid.NewGuid().ToString(),
            Name = "Project Brainstorming",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
            UpdatedAt = DateTime.UtcNow.AddHours(-5),
            UserId = userId,
            Assistant = _assistants[0]
        };

        sampleChat1.Messages.Add(new AiChatMessageDto
        {
            Id = Guid.NewGuid().ToString(),
            ChatId = sampleChat1.Id,
            Role = "user",
            Content = "Hello, I need help brainstorming ideas for my new app.",
            CreatedAt = sampleChat1.CreatedAt
        });

        sampleChat1.Messages.Add(new AiChatMessageDto
        {
            Id = Guid.NewGuid().ToString(),
            ChatId = sampleChat1.Id,
            Role = "assistant",
            Content = "I'd be happy to help brainstorm app ideas! What kind of problem are you trying to solve?",
            CreatedAt = sampleChat1.CreatedAt.AddSeconds(2)
        });

        var sampleChat2 = new AiChatDto
        {
            Id = Guid.NewGuid().ToString(),
            Name = "Code Review Help",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddHours(-1),
            UserId = userId,
            Assistant = _assistants[1]
        };

        sampleChat2.Messages.Add(new AiChatMessageDto
        {
            Id = Guid.NewGuid().ToString(),
            ChatId = sampleChat2.Id,
            Role = "user",
            Content = "Can you review my React component code?",
            CreatedAt = sampleChat2.CreatedAt
        });

        sampleChat2.Messages.Add(new AiChatMessageDto
        {
            Id = Guid.NewGuid().ToString(),
            ChatId = sampleChat2.Id,
            Role = "assistant",
            Content = "Of course, please share your code and I'll review it for you.",
            CreatedAt = sampleChat2.CreatedAt.AddSeconds(1)
        });

        _chats.Add(sampleChat1);
        _chats.Add(sampleChat2);

        _logger.LogInformation("Created sample chats with IDs: {ChatId1}, {ChatId2}",
            sampleChat1.Id, sampleChat2.Id);
    }

    public IEnumerable<AiChatSummaryDto> GetChatSummaries(string userId)
    {
        _logger.LogInformation("Getting chat summaries for user: {UserId}", userId);

        // Create sample chats for this user if they don't have any
        CreateSampleChatsForUser(userId);

        var chats = _chats
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new AiChatSummaryDto
            {
                Id = c.Id,
                Name = c.Name,
                AssistantName = c.Assistant.Name,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt,
                LastMessagePreview = c.Messages.OrderByDescending(m => m.CreatedAt).FirstOrDefault()?.Content.Truncate(50) ?? ""
            }).ToList();

        _logger.LogInformation("Found {Count} chats for user {UserId}", chats.Count, userId);
        return chats;
    }

    public AiChatDto? GetChat(string id, string userId)
    {
        return _chats.FirstOrDefault(c => c.Id == id && c.UserId == userId);
    }

    public AiChatDto CreateChat(string userId, AiChatCreateDto createDto)
    {
        var assistant = _assistants.FirstOrDefault(a => a.Id == createDto.AssistantId) ?? _assistants[0];

        var chat = new AiChatDto
        {
            Id = Guid.NewGuid().ToString(),
            Name = createDto.Name,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            UserId = userId,
            Assistant = assistant
        };

        lock (_lock)
        {
            _chats.Add(chat);
        }

        _logger.LogInformation("Created chat {ChatId} for user {UserId}", chat.Id, userId);
        return chat;
    }

    public AiChatMessageDto AddMessage(string userId, string chatId, string role, string content)
    {
        var chat = GetChat(chatId, userId);
        if (chat == null)
        {
            throw new Exception("Chat not found");
        }

        var message = new AiChatMessageDto
        {
            Id = Guid.NewGuid().ToString(),
            ChatId = chatId,
            Role = role,
            Content = content,
            CreatedAt = DateTime.UtcNow
        };

        lock (_lock)
        {
            chat.Messages.Add(message);
            chat.UpdatedAt = DateTime.UtcNow;
        }

        return message;
    }

    public bool DeleteChat(string id, string userId)
    {
        lock (_lock)
        {
            var chatToRemove = _chats.FirstOrDefault(c => c.Id == id && c.UserId == userId);
            if (chatToRemove != null)
            {
                _chats.Remove(chatToRemove);
                _logger.LogInformation("Deleted chat {ChatId} for user {UserId}", id, userId);
                return true;
            }
            return false;
        }
    }

    public IEnumerable<AiAssistantDto> GetAssistants()
    {
        return _assistants;
    }
}

public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return value;
        return value.Length <= maxLength ? value : value.Substring(0, maxLength) + "...";
    }
}