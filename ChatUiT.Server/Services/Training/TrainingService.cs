using ChatUiT.Server.Models;
using Microsoft.Extensions.Caching.Memory;

namespace ChatUiT.Server.Services.Training;

/// <summary>One graded question of a submitted test.</summary>
public sealed record TrainingQuestionResult(string QuestionId, bool Correct, string? CorrectOptionId, string? Explanation);

/// <summary>A graded test, and the user's stored result after it.</summary>
public sealed record TrainingGrade(bool Passed, int Score, int QuestionCount, bool Stored, IReadOnlyList<TrainingQuestionResult> Results, TrainingResult? StoredResult);

/// <summary>Grades the mandatory training test and keeps each user's stored result.</summary>
public sealed class TrainingService
{
    private readonly IDatabaseService _databaseService;
    private readonly TrainingCourseCatalog _catalog;
    private readonly IMemoryCache _cache;
    private readonly TimeProvider _time;

    public TrainingService(IDatabaseService databaseService, TrainingCourseCatalog catalog, IMemoryCache cache, TimeProvider time)
    {
        _databaseService = databaseService;
        _catalog = catalog;
        _cache = cache;
        _time = time;
    }

    /// <summary>Whether the user has a stored result. A completed user is remembered in memory.</summary>
    public async Task<bool> HasCompletedAsync(string userId)
    {
        if (_cache.TryGetValue(CacheKey(userId), out _))
        {
            return true;
        }

        var user = await _databaseService.GetUserAsync(userId);
        if (user?.Training == null)
        {
            return false;
        }

        _cache.Set(CacheKey(userId), true);
        return true;
    }

    public async Task<TrainingResult?> GetResultAsync(string userId) =>
        (await _databaseService.GetUserAsync(userId))?.Training;

    /// <summary>
    /// Grades the answers (question id to option id) against the current course. A passed attempt
    /// is stored when the user has no result, or when it has a higher score or a newer course
    /// version than the stored one. Wrong answers carry the correct option and its explanation
    /// in the given language.
    /// </summary>
    public async Task<TrainingGrade> SubmitAsync(string userId, IReadOnlyDictionary<string, string> answers, string? language)
    {
        var course = _catalog.Get(language);
        var results = course.Questions
            .Select(question =>
            {
                var correct = answers.TryGetValue(question.Id, out var answer) && answer == question.CorrectOptionId;
                return new TrainingQuestionResult(question.Id, correct, correct ? null : question.CorrectOptionId, correct ? null : question.Explanation);
            })
            .ToList();

        var score = results.Count(result => result.Correct);
        var questionCount = course.Questions.Count;
        var passed = TrainingCourseCatalog.IsPass(score, questionCount);

        var user = await _databaseService.GetUserAsync(userId);
        var previous = user?.Training;
        var stored = false;
        if (user != null && passed && (previous == null || course.Version > previous.CourseVersion || score > previous.Score))
        {
            user.Training = new TrainingResult
            {
                CompletedAt = _time.GetUtcNow(),
                Score = score,
                QuestionCount = questionCount,
                CourseVersion = course.Version
            };
            await _databaseService.SetUserTrainingAsync(userId, user.Training);
            _cache.Set(CacheKey(userId), true);
            stored = true;
        }

        return new TrainingGrade(passed, score, questionCount, stored, results, user?.Training);
    }

    /// <summary>
    /// Grades one answer against the current course, or returns null for an unknown question.
    /// A wrong answer carries the correct option and its explanation in the given language.
    /// </summary>
    public TrainingQuestionResult? Check(string questionId, string optionId, string? language)
    {
        var question = _catalog.Get(language).Questions.FirstOrDefault(candidate => candidate.Id == questionId);
        if (question == null)
        {
            return null;
        }

        var correct = optionId == question.CorrectOptionId;
        return new TrainingQuestionResult(question.Id, correct, correct ? null : question.CorrectOptionId, correct ? null : question.Explanation);
    }

    private static string CacheKey(string userId) => $"training-completed:{userId}";
}
