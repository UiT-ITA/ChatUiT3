namespace ChatUitReact.Server.Models
{
    public class CompletionResponse
    {
        public string Text { get; set; } = string.Empty;
        public int TokensUsed { get; set; }
        public bool Success { get; set; } = true;
        public string? ErrorMessage { get; set; }
    }
}
