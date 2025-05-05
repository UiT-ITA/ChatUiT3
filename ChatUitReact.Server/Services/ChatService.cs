using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Hubs;
using ChatUitReact.Server.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace ChatUitReact.Server.Services
{
    public class ChatService
    {
        private readonly OpenAiService _openAiService;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ILogger<ChatService> _logger;
        private readonly DatabaseService _databaseService;

        public ChatService(
            OpenAiService openAiService,
            IHubContext<ChatHub> hubContext,
            ILogger<ChatService> logger,
            DatabaseService databaseService)
        {
            _openAiService = openAiService;
            _hubContext = hubContext;
            _logger = logger;
            _databaseService = databaseService;
        }

        // Create a new chat
        public async Task<AiChat> CreateChatAsync(string userId, string username, AiAssistant assistant)
        {
            var chat = new AiChat
            {
                Name = $"Chat with {assistant.Name}",
                Assistant = assistant,
                CurrentSettings = assistant.ModelSettings
            };

            // Add initial system message if provided
            if (!string.IsNullOrEmpty(assistant.SystemPrompt))
            {
                chat.Messages.Add(new AiChatMessage
                {
                    Role = AiChatRole.System,
                    Content = assistant.SystemPrompt
                });
            }

            // Save to database
            await _databaseService.CreateChatAsync(chat, username);
            
            return chat;
        }

        // Send a message and get a response
        public async Task<AiChatMessage> SendMessageAsync(
            string chatId, 
            string userId,
            string username,
            string message)
        {
            // Get the chat from database
            var chat = await _databaseService.GetChatAsync(chatId, userId, username);
            if (chat == null)
            {
                throw new ArgumentException($"Chat not found: {chatId}");
            }

            // Add user message
            var userMessage = new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = message
            };
            
            chat.Messages.Add(userMessage);
            
            // Save the message to database
            await _databaseService.AddMessageAsync(userMessage, chatId, username);

            // Notify of user message
            await NotifyClientsOfUpdate(chatId, userId, userMessage);

            try
            {
                // Get assistant response
                var assistantMessage = await _openAiService.GetChatCompletionAsync(
                    chat.Messages,
                    chat.Assistant.Model,
                    chat.CurrentSettings);

                // Add to chat history in memory
                chat.Messages.Add(assistantMessage);
                
                // Save to database
                await _databaseService.AddMessageAsync(assistantMessage, chatId, username);
                
                // Notify connected clients
                await NotifyClientsOfUpdate(chatId, userId, assistantMessage);
                
                return assistantMessage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message");
                throw;
            }
        }

        // Stream a response for real-time updates
        public async Task<AiChatMessage> StreamMessageAsync(
            string chatId,
            string userId,
            string username,
            string message,
            CancellationToken cancellationToken = default)
        {
            // Get the chat from database
            var chat = await _databaseService.GetChatAsync(chatId, userId, username);
            if (chat == null)
            {
                throw new ArgumentException($"Chat not found: {chatId}");
            }

            // Add user message
            var userMessage = new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = message
            };
            
            chat.Messages.Add(userMessage);
            
            // Save the message to database
            await _databaseService.AddMessageAsync(userMessage, chatId, username);
            
            // Notify about the user message
            await NotifyClientsOfUpdate(chatId, userId, userMessage);

            try
            {
                // Create assistant message to build up
                var assistantMessage = new AiChatMessage
                {
                    Role = AiChatRole.Assistant,
                    Content = string.Empty
                };
                
                chat.Messages.Add(assistantMessage);

                // Get chunks from streaming API
                var chunks = await _openAiService.GetChatCompletionStreamChunksAsync(
                    chat.Messages,
                    chat.Assistant.Model,
                    chat.CurrentSettings,
                    cancellationToken);
                
                // Process chunks for real-time updates
                StringBuilder fullResponse = new StringBuilder();
                
                foreach (var chunk in chunks)
                {
                    fullResponse.Append(chunk);
                    
                    // Send the chunk to connected clients
                    await _hubContext.Clients.Group(userId)
                        .SendAsync("ReceiveMessageChunk", chatId, assistantMessage.Id, chunk, cancellationToken);
                }
                
                // Final update with complete message
                assistantMessage.Content = fullResponse.ToString();
                
                // Save the complete assistant message to database
                await _databaseService.AddMessageAsync(assistantMessage, chatId, username);
                
                // Notify clients of the complete message
                await NotifyClientsOfUpdate(chatId, userId, assistantMessage);
                
                return assistantMessage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error streaming message");
                throw;
            }
        }

        // Support for tools/functions
        public async Task<AiChatMessage> SendMessageWithToolsAsync(
            string chatId,
            string userId,
            string username,
            string message)
        {
            // Get the chat from database
            var chat = await _databaseService.GetChatAsync(chatId, userId, username);
            if (chat == null)
            {
                throw new ArgumentException($"Chat not found: {chatId}");
            }

            // Add user message
            var userMessage = new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = message
            };
            
            chat.Messages.Add(userMessage);
            
            // Save the message to database
            await _databaseService.AddMessageAsync(userMessage, chatId, username);

            // Notify of user message
            await NotifyClientsOfUpdate(chatId, userId, userMessage);

            try
            {
                // Get assistant response with tools
                var assistantMessage = await _openAiService.GetChatCompletionWithToolsAsync(
                    chat.Messages,
                    chat.Assistant.Model,
                    chat.CurrentSettings,
                    chat.Assistant.Tools);

                // Add to chat history
                chat.Messages.Add(assistantMessage);
                
                // Save to database
                await _databaseService.AddMessageAsync(assistantMessage, chatId, username);
                
                // Notify connected clients
                await NotifyClientsOfUpdate(chatId, userId, assistantMessage);
                
                return assistantMessage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending message with tools");
                throw;
            }
        }

        // Get chats for a user
        public async Task<List<AiChat>> GetUserChatsAsync(string userId, string username)
        {
            return await _databaseService.GetUserChatsAsync(userId, username);
        }

        // Get a specific chat
        public async Task<AiChat> GetChatAsync(string chatId, string userId, string username)
        {
            return await _databaseService.GetChatAsync(chatId, userId, username);
        }

        // Delete a chat
        public async Task DeleteChatAsync(string chatId, string username)
        {
            await _databaseService.DeleteChatAsync(chatId, username);
        }

        // Notify clients of a new message
        private async Task NotifyClientsOfUpdate(string chatId, string userId, AiChatMessage message)
        {
            await _hubContext.Clients.Group(userId)
                .SendAsync("ReceiveMessage", chatId, message);
        }
        
        // Attach a file to a chat
        public async Task<AiChatFile> AttachFileToChatAsync(string chatId, string userId, string username, string fileId)
        {
            return await _databaseService.AttachFileToChatAsync(chatId, username, fileId);
        }
    }
}
