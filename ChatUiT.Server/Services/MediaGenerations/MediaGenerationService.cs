using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.AspNetCore.SignalR;

namespace ChatUiT.Server.Services.MediaGenerations;

using ChatUiT.Server.Hubs;
using ChatUiT.Server.Models;
using ChatUiT.Server.Services.AiProviders;
using ChatUiT.Server.Services.AiProviders.Images;
using ChatUiT.Server.Services.Streaming;

/// <summary>
/// Runs generations in the background, the way chat replies run: each run has a deadline and
/// can be cancelled, and its events go into a <see cref="LiveStream{TEvent}"/> that clients
/// read over the hub.
/// </summary>
public sealed class MediaGenerationService
{
    /// <summary>Upper bound on a run, per image it asks for.</summary>
    private static readonly TimeSpan TimeoutPerImage = TimeSpan.FromMinutes(5);

    /// <summary>How long a finished run's events stay readable for late clients.</summary>
    private static readonly TimeSpan StreamRetention = TimeSpan.FromMinutes(5);

    private const string GenerationFailedText = "The generation failed because of an error.";

    private readonly IAiProviderRegistry _providers;
    private readonly IMediaGenerationStore _store;
    private readonly IHubContext<AppHub, IAppHubClient> _hubContext;
    private readonly ILogger<MediaGenerationService> _logger;
    private readonly ConcurrentDictionary<string, LiveStream<MediaGenerationEvent>> _streams = new();
    private readonly ConcurrentDictionary<string, RunHandle> _runs = new();

    public MediaGenerationService(
        IAiProviderRegistry providers,
        IMediaGenerationStore store,
        IHubContext<AppHub, IAppHubClient> hubContext,
        ILogger<MediaGenerationService> logger)
    {
        _providers = providers;
        _store = store;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>Starts an image generation or edit. The request must already have passed <see cref="ImageParameterValidator"/>.</summary>
    public MediaGeneration StartImageGeneration(string userId, ImageRequest request)
    {
        var generation = new MediaGeneration
        {
            UserId = userId,
            Type = ModelType.Image,
            ModelId = request.Model.Id,
            ModelName = request.Model.ModelName,
            Prompt = request.Parameters.Prompt
        };

        var provider = _providers.For(request.Endpoint.EndpointType);
        Start(generation, TimeoutPerImage * request.Parameters.Count, (stream, stopwatch, cancellationToken) => RunImageGenerationAsync(provider, request, generation, stream, stopwatch, cancellationToken));
        return generation;
    }

    /// <summary>False when nothing is running: the run already finished, or the generation belongs to someone else.</summary>
    public bool TryCancel(string userId, string generationId)
    {
        if (!_runs.TryGetValue(Key(userId, generationId), out var handle))
        {
            return false;
        }

        // Flag before cancelling: the run reads it the moment the token fires.
        handle.UserCancelled = true;

        try
        {
            handle.Cts.Cancel();
        }
        catch (ObjectDisposedException)
        {
            return false;
        }

        return true;
    }

    /// <summary>Sends the generation's events, from the first, to one hub connection.</summary>
    public void StartClientStream(string connectionId, string userId, string generationId)
    {
        if (!_streams.TryGetValue(Key(userId, generationId), out var stream))
        {
            _logger.LogWarning("Client requested the stream of a generation that has none: {GenerationId}", generationId);
            return;
        }

        _ = Task.Run(async () =>
        {
            try
            {
                await foreach (var generationEvent in stream.GetReader())
                {
                    await _hubContext.Clients.Client(connectionId).ReceiveMediaGenerationEvent(generationId, generationEvent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error streaming generation {GenerationId} to client {ConnectionId}", generationId, connectionId);
            }
        });
    }

    private void Start(
        MediaGeneration generation,
        TimeSpan timeout,
        Func<LiveStream<MediaGenerationEvent>, Stopwatch, CancellationToken, Task> run)
    {
        var key = Key(generation.UserId, generation.Id);
        var stream = new LiveStream<MediaGenerationEvent>();
        _streams[key] = stream;
        _store.Add(generation);

        // The run is registered for cancelling before its task starts
        var cancellation = new CancellationTokenSource();
        var handle = new RunHandle { Cts = cancellation, Timeout = timeout };
        handle.Resume();
        _runs[key] = handle;

        _ = Task.Run(async () =>
        {
            using var ownedCancellation = cancellation;
            var stopwatch = Stopwatch.StartNew();

            try
            {
                await run(stream, stopwatch, cancellation.Token);
                Finish(generation, stream, stopwatch, MediaGenerationStatus.Completed);
            }
            catch (Exception) when (handle.UserCancelled)
            {
                _logger.LogInformation("Generation {GenerationId} cancelled by user", generation.Id);
                Finish(generation, stream, stopwatch, MediaGenerationStatus.Cancelled);
            }
            catch (OperationCanceledException)
            {
                _logger.LogWarning("Generation {GenerationId} timed out", generation.Id);
                Finish(generation, stream, stopwatch, MediaGenerationStatus.Failed, $"The model did not finish within {timeout.TotalMinutes:0} minutes.");
            }
            catch (ImageGenerationFailedException ex)
            {
                _logger.LogWarning("Generation {GenerationId} failed: {Reason} Service response: {ServiceResponse}", generation.Id, ex.Message, ex.ServiceResponse);
                Finish(generation, stream, stopwatch, MediaGenerationStatus.Failed, ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running generation {GenerationId}", generation.Id);
                Finish(generation, stream, stopwatch, MediaGenerationStatus.Failed, GenerationFailedText);
            }
            finally
            {
                _runs.TryRemove(key, out _);
                _store.Finish(generation);
                await Task.Delay(StreamRetention);
                if (_streams.TryRemove(key, out var removed))
                {
                    removed.Dispose();
                }
            }
        });
    }

    private static async Task RunImageGenerationAsync(
        IAiProvider provider,
        ImageRequest request,
        MediaGeneration generation,
        LiveStream<MediaGenerationEvent> stream,
        Stopwatch stopwatch,
        CancellationToken cancellationToken)
    {
        await foreach (var imageEvent in provider.GenerateImagesAsync(request, cancellationToken))
        {
            switch (imageEvent)
            {
                case ImageStreamEvent.PartialImage partial:
                    PublishOutput(generation.AddOutput(partial.ImageIndex, partial.PartialIndex, ImageApiHttp.MediaType(partial.Format), partial.Content), MediaGenerationEventKind.PartialOutput);
                    break;
                case ImageStreamEvent.Image image:
                    PublishOutput(generation.AddOutput(image.ImageIndex, null, ImageApiHttp.MediaType(image.Format), image.Content), MediaGenerationEventKind.Output);
                    break;
                case ImageStreamEvent.Usage usage:
                    generation.AddUsage(usage.InputTokens, usage.OutputTokens);
                    stream.Publish(new MediaGenerationEvent
                    {
                        Kind = MediaGenerationEventKind.Usage,
                        ElapsedMs = stopwatch.ElapsedMilliseconds,
                        InputTokens = generation.InputTokens,
                        OutputTokens = generation.OutputTokens
                    });
                    break;
            }
        }

        void PublishOutput(MediaOutput output, MediaGenerationEventKind kind) => stream.Publish(new MediaGenerationEvent
        {
            Kind = kind,
            ElapsedMs = stopwatch.ElapsedMilliseconds,
            OutputId = output.Id,
            OutputIndex = output.Index,
            PartialIndex = output.PartialIndex,
            MediaType = output.MediaType
        });
    }

    private static void Finish(MediaGeneration generation, LiveStream<MediaGenerationEvent> stream, Stopwatch stopwatch, MediaGenerationStatus status, string? error = null)
    {
        generation.Finish(status, error);
        stream.Publish(new MediaGenerationEvent
        {
            Kind = status switch
            {
                MediaGenerationStatus.Completed => MediaGenerationEventKind.Completed,
                MediaGenerationStatus.Cancelled => MediaGenerationEventKind.Cancelled,
                _ => MediaGenerationEventKind.Failed
            },
            ElapsedMs = stopwatch.ElapsedMilliseconds,
            Error = error
        });
        stream.Complete();
    }

    private static string Key(string userId, string generationId) => $"{userId}:{generationId}";
}
