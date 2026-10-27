using ChatUiT.Server.Models;
using System;
using System.Collections.Generic;

namespace ChatUiT.Server.Extentions
{
    public static class MessageFactoryExtensions
    {
        #region Extension Methods
        
        //// Create a text message with a single text chunk
        //public static AiChatMessage CreateTextMessage(this AiChatMessage _, string content, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage
        //    {
        //        Id = Guid.NewGuid().ToString(),
        //        Role = role,
        //        Timestamp = DateTime.UtcNow,
        //        Content = new List<MessageChunk>
        //        {
        //            new MessageChunk
        //            {
        //                Type = AiContentType.Text,
        //                Content = content
        //            }
        //        }
        //    };
        //}
        
        //// Create an image message with a single image chunk
        //public static AiChatMessage CreateImageMessage(this AiChatMessage _, string base64Image, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage
        //    {
        //        Id = Guid.NewGuid().ToString(),
        //        Role = role,
        //        Timestamp = DateTime.UtcNow,
        //        Content = new List<MessageChunk>
        //        {
        //            new MessageChunk
        //            {
        //                Type = AiContentType.Image,
        //                Content = base64Image
        //            }
        //        }
        //    };
        //}
        
        //// Create a message with text and image
        //public static AiChatMessage CreateTextAndImageMessage(this AiChatMessage _, string text, string base64Image, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage
        //    {
        //        Id = Guid.NewGuid().ToString(),
        //        Role = role,
        //        Timestamp = DateTime.UtcNow,
        //        Content = new List<MessageChunk>
        //        {
        //            new MessageChunk
        //            {
        //                Type = AiContentType.Text,
        //                Content = text
        //            },
        //            new MessageChunk
        //            {
        //                Type = AiContentType.Image,
        //                Content = base64Image
        //            }
        //        }
        //    };
        //}
        
        //// Create a message with multiple chunks
        //public static AiChatMessage CreateWithChunks(this AiChatMessage _, List<MessageChunk> chunks, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage
        //    {
        //        Id = Guid.NewGuid().ToString(),
        //        Role = role,
        //        Timestamp = DateTime.UtcNow,
        //        Content = chunks
        //    };
        //}
        
        //// Create a file message with associated chunks
        //public static AiChatMessage CreateFileMessage(this AiChatMessage _, string filename, List<MessageChunk> chunks)
        //{
        //    return new AiChatMessage
        //    {
        //        Id = Guid.NewGuid().ToString(),
        //        Role = AiChatRole.File,
        //        Timestamp = DateTime.UtcNow,
        //        Content = chunks,
        //        Filename = filename
        //    };
        //}
        
        #endregion
        
        #region Static Factory Methods
        
        //// Static versions of the factory methods that don't require an instance
        
        //// Create a text message
        //public static AiChatMessage TextMessage(string content, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage().CreateTextMessage(content, role);
        //}
        
        //// Create an image message
        //public static AiChatMessage ImageMessage(string base64Image, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage().CreateImageMessage(base64Image, role);
        //}
        
        //// Create a text and image message
        //public static AiChatMessage TextAndImageMessage(string text, string base64Image, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage().CreateTextAndImageMessage(text, base64Image, role);
        //}
        
        //// Create with chunks
        //public static AiChatMessage WithChunks(List<MessageChunk> chunks, AiChatRole role = AiChatRole.User)
        //{
        //    return new AiChatMessage().CreateWithChunks(chunks, role);
        //}
        
        //// Create file message
        //public static AiChatMessage FileMessage(string filename, List<MessageChunk> chunks)
        //{
        //    return new AiChatMessage().CreateFileMessage(filename, chunks);
        //}
        
        #endregion
    }
}
