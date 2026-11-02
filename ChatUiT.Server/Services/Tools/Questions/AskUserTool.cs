using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ChatUiT.Server.Models;

namespace ChatUiT.Server.Services.Tools;

public sealed record AskUserArgs(
    [property: Description("Every question you need answered before you can go on, 1 to 4, in the order the user should answer them.")]
    List<AskUserQuestion> Questions);

public sealed record AskUserQuestion(
    [property: Description("The question, short and complete on its own.")]
    string Question,
    [property: Description("The answers to choose from, when the likely answers can be guessed: 2 to 6, each a few words. Leave out for an open question. The user can always write their own answer instead.")]
    List<AskUserOption>? Options = null,
    [property: Description("True when the user may pick more than one option.")]
    bool? MultiSelect = null);

public sealed record AskUserOption(
    [property: Description("The answer as the user would say it, a few words.")]
    string Label,
    [property: Description("What choosing it means, one short sentence. Optional.")]
    string? Description = null);

/// <summary>
/// Asks the user one or more questions. One of the base tools: every chat and every Responses API
/// run has it, whatever the assistant is configured with, so it is built per request and never
/// offered in the assistant editor. The call ends with the questions; the answers continue it.
/// </summary>
public sealed class AskUserTool : QuestionTool<AskUserArgs>
{
    public const string ToolId = "ask_user";

    private const int MaxQuestions = 4;
    private const int MaxOptions = 10;
    private const int MaxQuestionLength = 500;
    private const int MaxLabelLength = 100;
    private const int MaxDescriptionLength = 300;
    private const int MaxAnswerLength = 4000;

    public override string Id => ToolId;

    public override string DisplayName => "Ask the user";

    public override DataClassification Classification => DataClassification.Red;

    public override string Description =>
        "Asks the user questions in a card above the message box and ends your turn until they answer. " +
        "Whenever you need something from the user before you can go on (a choice, a missing detail, a preference, what they meant), " +
        "call this tool instead of writing the question in your reply. Never put a question for the user in your reply text, " +
        "and never end a reply with a question: ask it with this tool. When the user asks you to ask them something, use this tool. " +
        "Put every question you need answered now into one call, up to 4: the user steps through them in one card and answers them together. " +
        "Never call this tool more than once in a turn. " +
        "Give 2 to 6 short options whenever the likely answers can be guessed. The user can always write their own answer, or skip a question. " +
        "Do not ask what you can find out from the conversation, their files or your other tools. " +
        "Do not use it to get approval for an action: actions that need approval ask for it themselves.";

    protected override Task<IReadOnlyList<UserQuestion>> PrepareQuestionsAsync(AskUserArgs args, ToolInvocation invocation, CancellationToken cancellationToken)
        => Task.FromResult(ToQuestions(args));

    protected override Task<ToolResult> AnswerAsync(AskUserArgs args, IReadOnlyList<UserAnswer?> answers, ToolInvocation invocation, CancellationToken cancellationToken)
    {
        var questions = ToQuestions(args);
        if (Validate(questions, answers) is { } problem)
        {
            return Task.FromResult(ToolResult.Error($"The answers could not be used: {problem}"));
        }

        var payload = questions.Zip(answers, (question, answer) => answer == null
            ? (object)new { question = question.Question, skipped = true }
            : new { question = question.Question, selected = answer.Selected, text = Text(answer) });

        var display = questions.Zip(answers, (question, answer) => answer == null
            ? $"{question.Question}\n  Skipped"
            : $"{question.Question}\n  {string.Join(" · ", answer.Selected.Concat(Text(answer) is { } text ? [text] : []))}");

        return Task.FromResult(ToolResult.Ok(new { answers = payload }, string.Join("\n", display)));
    }

    /// <summary>
    /// Why the answers do not fit the questions, or null when they do. There is one answer per
    /// question, null for a skipped one, and at least one is given.
    /// </summary>
    public static string? Validate(IReadOnlyList<UserQuestion> questions, IReadOnlyList<UserAnswer?> answers)
    {
        if (answers.Count != questions.Count)
        {
            return $"There are {questions.Count} questions and {answers.Count} answers.";
        }

        if (answers.All(answer => answer == null))
        {
            return "At least one question is answered; to answer none, decline instead.";
        }

        for (var i = 0; i < questions.Count; i++)
        {
            if (answers[i] is { } answer && Validate(questions[i], answer) is { } problem)
            {
                return $"Question {i + 1}: {problem}";
            }
        }

        return null;
    }

    private static string? Validate(UserQuestion question, UserAnswer answer)
    {
        var hasText = !string.IsNullOrWhiteSpace(answer.Text);
        if (answer.Selected.Count == 0 && !hasText)
        {
            return "An answer picks an option or has text.";
        }

        if (hasText && answer.Text!.Length > MaxAnswerLength)
        {
            return $"The written answer is longer than {MaxAnswerLength} characters.";
        }

        if (answer.Selected.Count > 1 && !question.MultiSelect)
        {
            return "The question takes one option.";
        }

        var labels = question.Options.Select(o => o.Label).ToHashSet(StringComparer.Ordinal);
        if (answer.Selected.FirstOrDefault(s => !labels.Contains(s)) is { } unknown)
        {
            return $"\"{unknown}\" is not one of the options.";
        }

        return answer.Selected.Distinct(StringComparer.Ordinal).Count() == answer.Selected.Count
            ? null
            : "An option is picked twice.";
    }

    private static string? Text(UserAnswer answer) => string.IsNullOrWhiteSpace(answer.Text) ? null : answer.Text.Trim();

    private static IReadOnlyList<UserQuestion> ToQuestions(AskUserArgs args)
    {
        var questions = args.Questions ?? [];
        if (questions.Count == 0 || questions.Count > MaxQuestions)
        {
            throw new ToolArgumentException($"Ask 1 to {MaxQuestions} questions.");
        }

        return questions.Select((question, index) => ToQuestion(question, index + 1)).ToList();
    }

    private static UserQuestion ToQuestion(AskUserQuestion args, int number)
    {
        var question = args.Question?.Trim() ?? string.Empty;
        if (question.Length == 0 || question.Length > MaxQuestionLength)
        {
            throw new ToolArgumentException($"Question {number}: the question is required and at most {MaxQuestionLength} characters.");
        }

        var options = (args.Options ?? [])
            .Select(o => new UserQuestionOption(o.Label?.Trim() ?? string.Empty, string.IsNullOrWhiteSpace(o.Description) ? null : o.Description.Trim()))
            .ToList();

        if (options.Count > MaxOptions)
        {
            throw new ToolArgumentException($"Question {number}: give at most {MaxOptions} options.");
        }

        if (options.Any(o => o.Label.Length == 0 || o.Label.Length > MaxLabelLength || o.Description?.Length > MaxDescriptionLength))
        {
            throw new ToolArgumentException($"Question {number}: every option needs a label of at most {MaxLabelLength} characters and a description of at most {MaxDescriptionLength}.");
        }

        if (options.Select(o => o.Label).Distinct(StringComparer.Ordinal).Count() != options.Count)
        {
            throw new ToolArgumentException($"Question {number}: option labels must be different from each other.");
        }

        return new UserQuestion(question, options, options.Count > 1 && args.MultiSelect == true);
    }
}
