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
        
        // The extracted content chunks (text paragraphs, images, etc.)
        public List<FileContentChunk> ContentChunks { get; set; } = new List<FileContentChunk>();
        
        // Raw content when needed (not persisted directly)
        public byte[] RawContent { get; set; }
    }

    public class FileContentChunk
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public ChunkType Type { get; set; } = ChunkType.Text;
        public string Content { get; set; } = string.Empty;  // Text or base64 for images
        public int Order { get; set; }  // Position in the document
    }

    public enum ChunkType
    {
        Text,
        Image
    }
}
