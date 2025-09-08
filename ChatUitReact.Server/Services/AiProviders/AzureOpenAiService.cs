namespace ChatUitReact.Server.Services;

using Azure;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ChatUitReact.Server.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using OpenAI.Chat;
using System.ClientModel;

public class AzureOpenAiService
{
    private readonly AzureOpenAIClient _client; // ONLY used for development
    private readonly ILogger<AzureOpenAiService> _logger;
    private readonly IAssistantService _assistantService;

    public AzureOpenAiService(IConfiguration configuration, ILogger<AzureOpenAiService> logger, IAssistantService assistantService)
    {
        _logger = logger;
        _assistantService = assistantService;

        // Get Azure OpenAI configuration
        // Will be replaced with propper configuration management
        var endpoint = configuration["AzureOpenAI:Endpoint"]; // Remove
        var key = configuration["AzureOpenAI:ApiKey"];
        
        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(key))
        {
            throw new ArgumentException("Azure OpenAI endpoint and key must be configured");
        }

        _client = new AzureOpenAIClient(
            new Uri(endpoint),
            new AzureKeyCredential(key));
    }


    public async Task<string> GetChatCompletionAsync(
        List<Models.ChatMessage> messages, // replace
        ChatSettings settings, // replace
        //AiChat chat, // Should be used instead of messages and settings
        CancellationToken cancellationToken = default)
    {
        try
        {
            var chatClient = _client.GetChatClient(settings.Model.ModelName);
            var chatMessages = ConvertToChatMessages(messages);
            if (!string.IsNullOrEmpty(settings.SystemPrompt))
            {
                chatMessages.Insert(0, new SystemChatMessage(settings.SystemPrompt));
            }
            var options = BuildCompletionOptions(settings);
            
            var completion = await chatClient.CompleteChatAsync(chatMessages, options, cancellationToken);
            
            var response = completion.Value.Content[0].Text;


            _logger.LogInformation("Chat completion response: {Response}", response);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat completion");
            throw;
        }
    }
    
    // Used for testing purposes
    public async Task<string> GetChatCompletionAsync(
        List<Models.ChatMessage> messages,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var chatClient = _client.GetChatClient("gpt-4o-mini");
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(null);

            var completion = await chatClient.CompleteChatAsync(chatMessages, options, cancellationToken);

            var response = completion.Value.Content[0].Text;

            _logger.LogInformation("Chat completion response: {Response}", response);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat completion");
            throw;
        }
    }

    
    public AsyncCollectionResult<StreamingChatCompletionUpdate> GetChatCompletionStreamingAsync(
        List<Models.ChatMessage> messages,
        Model model,
        ChatSettings settings,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var chatClient = _client.GetChatClient(model.ModelName);
            var chatMessages = ConvertToChatMessages(messages);
            if (!string.IsNullOrEmpty(settings.SystemPrompt))
            {
                chatMessages.Insert(0, new SystemChatMessage(settings.SystemPrompt));
            }
            var options = BuildCompletionOptions(settings);

            Console.WriteLine($"Streaming chat completion with model: {model.ModelName}, messages count: {chatMessages.Count}");

            // foreach (var msg in chatMessages)
            // {
            //     var role = "Unknown";
            //     if (msg is SystemChatMessage) role = "System";
            //     else if (msg is UserChatMessage) role = "User";
            //     else if (msg is AssistantChatMessage) role = "Assistant";
            //     else if (msg is ToolChatMessage) role = "Tool";

            //     Console.WriteLine($"Message Role: {role}, Content Parts: {msg.Content[0].Text}");
            // }

            return chatClient.CompleteChatStreamingAsync(chatMessages, options, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat completion");
            throw;
        }
    }
    
    // Used for testing purposes
        public AsyncCollectionResult<StreamingChatCompletionUpdate> GetChatCompletionStreamingAsync(
    List<Models.ChatMessage> messages,
    CancellationToken cancellationToken = default)
    {
        try
        {
            var chatClient = _client.GetChatClient("gpt-4o");
            var chatMessages = ConvertToChatMessages(messages);
            var options = BuildCompletionOptions(null);

            return chatClient.CompleteChatStreamingAsync(chatMessages, options, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error streaming chat completion");
            throw;
        }
    }

   
    public async Task<string> GetChatName(string prompt)
    {
        try
        {
            var chatClient = _client.GetChatClient("gpt-4o-mini");
            var chatMessages = new List<OpenAI.Chat.ChatMessage> {
                new SystemChatMessage("Create a name for this chat based on the users initial message. The name must be shorter than 30 characters. Make the name as descriptive as possible. You should **only** respond with the name, exactly the way the name should be written. It should have no quotes around it. It should not have any formating. It will be set directly as the name of the chat. The user's message:\n\n" + prompt)
            };
            var options = new ChatCompletionOptions
            {
                Temperature = 1f,
                MaxOutputTokenCount = 50,
            };
            var completion = await chatClient.CompleteChatAsync(chatMessages, options);

            var response = completion.Value.Content[0].Text.Trim();

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat name");
            throw;
        }
    }



    // Helper methods
    private List<OpenAI.Chat.ChatMessage> ConvertToChatMessages(List<Models.ChatMessage> messages)
    {
        var result = new List<OpenAI.Chat.ChatMessage>();
        
        foreach (var message in messages)
        {
            switch (message.Role)
            {
                case AiChatRole.User:
                    if (message.Files?.Any() == true)
                    {
                        var contentParts = new List<ChatMessageContentPart>();
                        
                        // Add main text content first
                        if (!string.IsNullOrEmpty(message.Content))
                            contentParts.Add(ChatMessageContentPart.CreateTextPart(message.Content));
                        
                        // Process all files
                        foreach (var file in message.Files)
                        {
                            ProcessFileRecursively(file, contentParts);
                        }
                        
                        result.Add(new UserChatMessage(contentParts));
                    }
                    else
                    {
                        result.Add(new UserChatMessage(message.Content));
                    }
                    break;
                case AiChatRole.Assistant:
                    result.Add(new AssistantChatMessage(message.Content));
                    break;
                case AiChatRole.System:
                    result.Add(new SystemChatMessage(message.Content));
                    break;
            }
        }
        
        return result;
    }

    private void ProcessFileRecursively(ChatFile file, List<ChatMessageContentPart> contentParts)
    {
        try
        {
            switch (file)
            {
                case ChatFileText textFile:
                    contentParts.Add(ChatMessageContentPart.CreateTextPart(
                        $"\n--- FILE: {textFile.Filename} (Text) ---\n{textFile.Content}\n--- END FILE ---\n"
                    ));
                    break;
                    
                case ChatFileImage imageFile:
                    // Add text header for the image
                    contentParts.Add(ChatMessageContentPart.CreateTextPart(
                        $"\n--- FILE: {imageFile.Filename} (Image) ---"
                    ));
                    
                    // Add the actual image
                    var imageBytes = Convert.FromBase64String(imageFile.Content);
                    var imageBinaryData = BinaryData.FromBytes(imageBytes);
                    contentParts.Add(ChatMessageContentPart.CreateImagePart(imageBinaryData, "image/jpeg"));
                    
                    // Add closing header
                    contentParts.Add(ChatMessageContentPart.CreateTextPart(
                        "--- END FILE ---\n"
                    ));
                    break;
                    
                case ChatFileMixed mixedFile:
                    // Start of mixed file
                    contentParts.Add(ChatMessageContentPart.CreateTextPart(
                        $"\n--- FILE: {mixedFile.Filename} (Mixed Document) ---\n"
                    ));
                    
                    // Process each chunk with chunk numbering
                    for (int i = 0; i < mixedFile.Chunks.Count; i++)
                    {
                        var chunk = mixedFile.Chunks[i];
                        
                        // Add chunk header
                        contentParts.Add(ChatMessageContentPart.CreateTextPart(
                            $"[CHUNK {i + 1}/{mixedFile.Chunks.Count}] ({chunk.Type})\n"
                        ));
                        
                        // Process the chunk content
                        switch (chunk)
                        {
                            case ChatFileText textChunk:
                                contentParts.Add(ChatMessageContentPart.CreateTextPart(
                                    textChunk.Content + "\n"
                                ));
                                break;
                                
                            case ChatFileImage imageChunk:
                                var chunkImageBytes = Convert.FromBase64String(imageChunk.Content);
                                var chunkImageData = BinaryData.FromBytes(chunkImageBytes);
                                contentParts.Add(ChatMessageContentPart.CreateImagePart(chunkImageData, "image/jpeg"));
                                contentParts.Add(ChatMessageContentPart.CreateTextPart("\n"));
                                break;
                                
                            case ChatFileMixed nestedMixed:
                                // Recursive call for nested mixed files
                                ProcessFileRecursively(nestedMixed, contentParts);
                                break;
                        }
                    }
                    
                    // End of mixed file
                    contentParts.Add(ChatMessageContentPart.CreateTextPart(
                        $"--- END FILE: {mixedFile.Filename} ---\n"
                    ));
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file {FileName} of type {FileType}", file.Filename, file.Type);
            contentParts.Add(ChatMessageContentPart.CreateTextPart(
                $"\n--- ERROR: Could not process file {file.Filename} ({file.Type}) ---\n"
            ));
        }
    }

    private ChatCompletionOptions BuildCompletionOptions(ChatSettings? settings)
    {
        // Create options with available properties in the current version
        var options = new ChatCompletionOptions
        {
            Temperature = settings?.Temperature ?? 0.5f
        };
        
        return options;
    }

}
