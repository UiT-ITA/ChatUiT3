using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;

namespace ChatUitReact.Server.Extentions
{
    public static class ChatExtensions
    {
        public static ChatDto ToChatDto(this AiChat chat)
        {
            return new ChatDto
            {
                Id = chat.Id,
                Title = chat.Name,
                CreatedAt = chat.CreatedAt,
                LastUpdated = chat.UpdatedAt,
                Messages = chat.Messages.Select(m => m.ToMessageDto()).ToList(),
                AssistantId = chat.Assistant?.Id
            };
        }

        public static MessageDto ToMessageDto(this AiChatMessage message)
        {
            // Determine content type based on chunks
            string contentType = "text";
            if (message.Content.Count > 0)
            {
                var hasText = message.Content.Any(c => c.Type == AiMessageChunkType.Text);
                var hasImage = message.Content.Any(c => c.Type == AiMessageChunkType.Image);
                
                if (hasText && hasImage)
                    contentType = "mixed";
                else if (hasImage)
                    contentType = "image";
            }
            
            return new MessageDto
            {
                Id = message.Id,
                Timestamp = message.Timestamp,
                Sender = message.Role.ToString().ToLower(),
                ContentType = contentType,
                Filename = message.Role == AiChatRole.File ? message.Filename : null,
                Chunks = message.Content.Select(chunk => new MessageChunkDto
                {
                    Type = chunk.Type.ToString().ToLower(),
                    Content = chunk.Content
                }).ToList()
            };
        }
    }
}
