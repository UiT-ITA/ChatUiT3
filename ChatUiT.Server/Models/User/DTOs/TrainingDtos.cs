namespace ChatUiT.Server.Models;

public class TrainingStatusDto
{
    public bool Completed { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public int? Score { get; set; }
    public int? QuestionCount { get; set; }
    public int? CompletedVersion { get; set; }
    public int CurrentVersion { get; set; }
    public int CurrentQuestionCount { get; set; }
    public int PassPercent { get; set; }
}

public class TrainingCourseDto
{
    public int Version { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Intro { get; set; } = string.Empty;
    public int PassPercent { get; set; }
    public List<TrainingSectionDto> Sections { get; set; } = new();
    public List<TrainingQuestionDto> Questions { get; set; } = new();
}

public class TrainingSectionDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
}

public class TrainingQuestionDto
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public List<TrainingOptionDto> Options { get; set; } = new();
}

public class TrainingOptionDto
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

public class TrainingAnswerRequest
{
    public int Version { get; set; }
    public string? Language { get; set; }
    public string QuestionId { get; set; } = string.Empty;
    public string OptionId { get; set; } = string.Empty;
}

public class TrainingSubmitRequest
{
    public int Version { get; set; }
    public string? Language { get; set; }
    public Dictionary<string, string> Answers { get; set; } = new();
}

public class TrainingSubmitResultDto
{
    public bool Passed { get; set; }
    public int Score { get; set; }
    public int QuestionCount { get; set; }
    public List<TrainingQuestionResultDto> Results { get; set; } = new();
    public TrainingStatusDto Status { get; set; } = new();
}

public class TrainingQuestionResultDto
{
    public string QuestionId { get; set; } = string.Empty;
    public bool Correct { get; set; }
    public string? CorrectOptionId { get; set; }
    public string? Explanation { get; set; }
}
