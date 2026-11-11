using ChatUiT.Server.Models;
using ChatUiT.Server.Services;
using ChatUiT.Server.Services.Training;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatUiT.Server.Controllers;

// The signed-in user's mandatory training: status, course, test and certificate.
[ApiController]
[Route("api/users/me/training")]
[AllowWithoutTraining]
[Authorize]
public class TrainingController : ControllerBase
{
    private readonly TrainingService _trainingService;
    private readonly TrainingCourseCatalog _catalog;
    private readonly UserService _userService;
    private readonly Telemetry.AppTelemetry _telemetry;

    public TrainingController(TrainingService trainingService, TrainingCourseCatalog catalog, UserService userService, Telemetry.AppTelemetry telemetry)
    {
        _trainingService = trainingService;
        _catalog = catalog;
        _userService = userService;
        _telemetry = telemetry;
    }

    [HttpGet]
    public async Task<ActionResult<TrainingStatusDto>> GetStatus()
    {
        var result = await _trainingService.GetResultAsync(_userService.GetCurrentUserId(User));
        return Ok(MapStatus(result));
    }

    [HttpGet("course")]
    public ActionResult<TrainingCourseDto> GetCourse([FromQuery] string? language)
    {
        var course = _catalog.Get(language);
        _telemetry.TrainingCourseOpened(course.Version);
        return Ok(new TrainingCourseDto
        {
            Version = course.Version,
            Title = course.Title,
            Intro = course.Intro,
            PassPercent = TrainingCourseCatalog.PassPercent,
            Sections = course.Sections
                .Select(section => new TrainingSectionDto { Id = section.Id, Title = section.Title, Body = section.Body })
                .ToList(),
            Questions = course.Questions
                .Select(question => new TrainingQuestionDto
                {
                    Id = question.Id,
                    Text = question.Text,
                    Options = question.Options
                        .Select(option => new TrainingOptionDto { Id = option.Id, Text = option.Text })
                        .ToList()
                })
                .ToList()
        });
    }

    [HttpPost("answer")]
    public ActionResult<TrainingQuestionResultDto> Answer([FromBody] TrainingAnswerRequest request)
    {
        if (request.Version != _catalog.Version)
        {
            return Conflict(new { message = "The course has a new version. Reload the course and take the test again.", code = "course_version_changed" });
        }

        var result = _trainingService.Check(request.QuestionId, request.OptionId, request.Language);
        if (result == null)
        {
            return BadRequest(new { message = "Unknown question." });
        }

        return Ok(new TrainingQuestionResultDto
        {
            QuestionId = result.QuestionId,
            Correct = result.Correct,
            CorrectOptionId = result.CorrectOptionId,
            Explanation = result.Explanation
        });
    }

    [HttpPost("submit")]
    public async Task<ActionResult<TrainingSubmitResultDto>> Submit([FromBody] TrainingSubmitRequest request)
    {
        if (request.Version != _catalog.Version)
        {
            return Conflict(new { message = "The course has a new version. Reload the course and take the test again.", code = "course_version_changed" });
        }

        var grade = await _trainingService.SubmitAsync(_userService.GetCurrentUserId(User), request.Answers, request.Language);
        _telemetry.TrainingSubmitted(_catalog.Version, grade.Score, grade.QuestionCount, grade.Passed, grade.Stored);

        return Ok(new TrainingSubmitResultDto
        {
            Passed = grade.Passed,
            Score = grade.Score,
            QuestionCount = grade.QuestionCount,
            Results = grade.Results
                .Select(result => new TrainingQuestionResultDto
                {
                    QuestionId = result.QuestionId,
                    Correct = result.Correct,
                    CorrectOptionId = result.CorrectOptionId,
                    Explanation = result.Explanation
                })
                .ToList(),
            Status = MapStatus(grade.StoredResult)
        });
    }

    [HttpGet("certificate")]
    public async Task<IActionResult> GetCertificate([FromQuery] string? language)
    {
        var result = await _trainingService.GetResultAsync(_userService.GetCurrentUserId(User));
        if (result == null)
        {
            return NotFound();
        }

        var identity = _userService.GetUserIdentity(User);
        var name = string.IsNullOrWhiteSpace(identity.DisplayName) ? identity.Username : identity.DisplayName;
        var pdf = TrainingCertificate.Build(name, result, _catalog.Get(language).Certificate);
        _telemetry.TrainingCertificateDownloaded(result.CourseVersion);
        return File(pdf, "application/pdf", "uit-ai-training-certificate.pdf");
    }

    private TrainingStatusDto MapStatus(TrainingResult? result) => new()
    {
        Completed = result != null,
        CompletedAt = result?.CompletedAt,
        Score = result?.Score,
        QuestionCount = result?.QuestionCount,
        CompletedVersion = result?.CourseVersion,
        CurrentVersion = _catalog.Version,
        CurrentQuestionCount = _catalog.QuestionCount,
        PassPercent = TrainingCourseCatalog.PassPercent
    };
}
