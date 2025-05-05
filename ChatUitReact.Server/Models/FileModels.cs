using System;
using System.Collections.Generic;

namespace ChatUitReact.Server.Models
{
    // In-memory file model for application use
    public class AiFile
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long Size { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // The file content is represented as chunks of text or base64 for images
        public List<FileContentChunk> ContentChunks { get; set; } = new List<FileContentChunk>();
    }

    public class FileContentChunk
    {
        // No Id needed for in-memory model - the list maintains the chunks
        public ChunkType Type { get; set; } = ChunkType.Text;
        public string Content { get; set; } = string.Empty;  // Text or base64 for images
        // Order is implied by the list order - no need for Order property
    }

    public enum ChunkType
    {
        Text,
        Image
    }
}
