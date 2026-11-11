using System.Reflection;
using System.Text.Json;

namespace ChatUiT.Server.Services.Training;

/// <summary>The mandatory training in one language, as written in Content/course.&lt;language&gt;.json.</summary>
public sealed class TrainingCourse
{
    public int Version { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Intro { get; set; } = string.Empty;
    public List<TrainingSection> Sections { get; set; } = new();
    public List<TrainingQuestion> Questions { get; set; } = new();
    public TrainingCertificateText Certificate { get; set; } = new();
}

public sealed class TrainingSection
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    /// <summary>Markdown.</summary>
    public string Body { get; set; } = string.Empty;
}

public sealed class TrainingQuestion
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public List<TrainingOption> Options { get; set; } = new();
    public string CorrectOptionId { get; set; } = string.Empty;
    /// <summary>Shown to a user who answered wrong: which answer is correct and why.</summary>
    public string Explanation { get; set; } = string.Empty;
}

public sealed class TrainingOption
{
    public string Id { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

/// <summary>The texts printed on the certificate.</summary>
public sealed class TrainingCertificateText
{
    public string Heading { get; set; } = string.Empty;
    public string AwardedTo { get; set; } = string.Empty;
    public string Statement { get; set; } = string.Empty;
    public string CourseName { get; set; } = string.Empty;
    public string Completed { get; set; } = string.Empty;
    public string Score { get; set; } = string.Empty;
    /// <summary>The score, with {0} for the correct answers and {1} for the number of questions.</summary>
    public string ScoreFormat { get; set; } = "{0}/{1}";
    public string Version { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    /// <summary>The .NET culture name and date format of the completion date.</summary>
    public string Culture { get; set; } = "en-GB";
    public string DateFormat { get; set; } = "d MMMM yyyy";
}

/// <summary>
/// The course in every language, read once from the embedded content files. Every language has
/// the same version, question ids, option ids and correct answers, or the constructor throws.
/// </summary>
public sealed class TrainingCourseCatalog
{
    public const string DefaultLanguage = "en-US";
    public const int PassPercent = 80;

    private static readonly string[] Languages = { DefaultLanguage, "no-NB" };

    private readonly Dictionary<string, TrainingCourse> _courses = new(StringComparer.OrdinalIgnoreCase);

    public TrainingCourseCatalog()
    {
        foreach (var language in Languages)
        {
            _courses[language] = Load(language);
        }

        var reference = _courses[DefaultLanguage];
        if (reference.Questions.Count == 0)
        {
            throw new InvalidOperationException("The training course has no questions.");
        }

        foreach (var (language, course) in _courses)
        {
            if (Shape(course) != Shape(reference))
            {
                throw new InvalidOperationException($"The training course in {language} does not match {DefaultLanguage} in version, questions, options or correct answers.");
            }

            foreach (var question in course.Questions)
            {
                if (question.Options.All(option => option.Id != question.CorrectOptionId))
                {
                    throw new InvalidOperationException($"Training question {question.Id} in {language} has no option with its correct option id.");
                }
            }
        }
    }

    public int Version => _courses[DefaultLanguage].Version;

    public int QuestionCount => _courses[DefaultLanguage].Questions.Count;

    /// <summary>The course in the language, or in the default language when it has none.</summary>
    public TrainingCourse Get(string? language) =>
        language != null && _courses.TryGetValue(language, out var course) ? course : _courses[DefaultLanguage];

    public static bool IsPass(int score, int questionCount) => score * 100 >= PassPercent * questionCount;

    private static string Shape(TrainingCourse course) =>
        course.Version + "|" + string.Join(";", course.Questions.Select(q =>
            $"{q.Id}:{string.Join(",", q.Options.Select(o => o.Id))}:{q.CorrectOptionId}"));

    private static TrainingCourse Load(string language)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var name = $"Training.course.{language}.json";
        using var stream = assembly.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException($"Training course content is missing: {name}");
        return JsonSerializer.Deserialize<TrainingCourse>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException($"Training course content is empty: {name}");
    }
}
