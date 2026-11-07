namespace ChatUiT.Server.Services.Insights;

/// <summary>
/// The fixed KQL queries of each Insights page, keyed by page and then by query name. Every query
/// runs against the Application Insights resource over the page's time range and starts with
/// <see cref="Prelude"/>.
/// </summary>
public static class InsightsQueries
{
    /// <summary>
    /// The let statements every query can use: <c>bucket</c> and <c>rangeStart</c> from the range;
    /// <c>ev</c>, the custom events with their common fields; <c>er</c>, the error records with their
    /// source; and <c>rq</c>, the requests with the scanner probes marked. Each keeps only records
    /// that carry service.version.
    /// </summary>
    public static string Prelude(InsightsRange range) => $$"""
        let bucket = totimespan('{{range.Bucket:c}}');
        let rangeStart = ago(totimespan('{{range.Duration:c}}'));
        let ev = customEvents
            | where isnotempty(tostring(customDimensions["service.version"]))
            | extend uid = tostring(customDimensions["user.id"]),
                upn = tostring(customDimensions["user.upn"]),
                session = tostring(customDimensions["client.session"]),
                app = tostring(customDimensions["client.app"]),
                chat = tostring(customDimensions["chat.id"]),
                model = tostring(customDimensions["model.id"]),
                eventKind = tostring(customDimensions["event.kind"]);
        let er = union traces, exceptions
            | where isnotempty(tostring(customDimensions["service.version"]))
            | extend en = tostring(customDimensions["event.name"])
            | where tostring(customDimensions["event.kind"]) == "error" or severityLevel >= 3
            | extend source = iff(en startswith "client.", "client", "server"), session = tostring(customDimensions["client.session"]);
        let rq = requests
            | where isnotempty(tostring(customDimensions["service.version"]))
            | extend probe = success == false and resultCode == "404" and name matches regex @"^[A-Z]+ /";

        """;

    public static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> Pages =
        new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["usage"] = new Dictionary<string, string>
            {
                ["headline"] = """
                    ev
                    | summarize users = dcountif(uid, isnotempty(uid)),
                        sessions = dcountif(session, isnotempty(session)),
                        messages = countif(name == "message.sent"),
                        chats = dcountif(chat, name == "message.sent" and isnotempty(chat)),
                        toolCalls = countif(name == "tool.call_finished")
                    | extend messagesPerUser = iff(users == 0, 0.0, todouble(messages) / users)
                    """,
                ["activity"] = """
                    ev
                    | make-series users = dcountif(uid, isnotempty(uid)) default = 0,
                        messages = countif(name == "message.sent") default = 0,
                        toolCalls = countif(name == "tool.call_finished") default = 0
                        on timestamp from bin(rangeStart, bucket) to now() step bucket
                    | mv-expand timestamp to typeof(datetime), users to typeof(long), messages to typeof(long), toolCalls to typeof(long)
                    | project at = timestamp, users, messages, toolCalls
                    """,
                ["users"] = """
                    let users = ev | where isnotempty(uid);
                    let topModel = users
                        | where name == "generation.finished"
                        | summarize n = count() by uid, model
                        | summarize arg_max(n, model) by uid
                        | project uid, topModel = model;
                    users
                    | summarize messages = countif(name == "message.sent"),
                        chats = dcountif(chat, name == "message.sent"),
                        sessions = dcountif(session, isnotempty(session)),
                        toolCalls = countif(name == "tool.call_finished"),
                        tokens = sumif(coalesce(tolong(customDimensions["tokens.input"]), 0) + coalesce(tolong(customDimensions["tokens.output"]), 0), name == "generation.finished"),
                        apps = make_set(iff(app in ("", "unknown"), "not tagged", app)),
                        upn = take_anyif(upn, isnotempty(upn)),
                        lastSeen = max(timestamp)
                        by uid
                    | join kind = leftouter topModel on uid
                    | project uid, upn, messages, chats, sessions, toolCalls, tokens, topModel = coalesce(topModel, ""), apps, lastSeen
                    | order by messages desc, toolCalls desc, lastSeen desc
                    """,
                ["clients"] = """
                    union requests, customEvents
                    | where isnotempty(tostring(customDimensions["service.version"]))
                    | extend app = tostring(customDimensions["client.app"]), uid = tostring(customDimensions["user.id"]), session = tostring(customDimensions["client.session"])
                    | where isnotempty(uid)
                    | summarize users = dcount(uid),
                        sessions = dcountif(session, isnotempty(session)),
                        messages = countif(itemType == "customEvent" and name == "message.sent")
                        by app = iff(app in ("", "unknown"), "not tagged", app)
                    | order by users desc
                    """,
                ["pages"] = """
                    ev
                    | where name == "client.page_viewed"
                    | summarize pageViews = count(), sessions = dcountif(session, isnotempty(session)) by route = tostring(customDimensions.route)
                    | order by pageViews desc
                    """,
                ["features"] = """
                    ev
                    | where name in ("message.sent", "chat.created", "tool.call_finished", "knowledge_file.loaded", "knowledge_source.loaded",
                        "client.file_imported", "image.generation_finished", "agent.run_finished", "client.message_copied", "chat.red_enabled",
                        "chat.deleted", "assistant.created", "assistant.updated", "assistant.shared_added", "assistant.share_link_created",
                        "client.setting_changed", "profile.updated")
                    | summarize uses = count(), users = dcountif(uid, isnotempty(uid)), sessions = dcountif(session, isnotempty(session)) by feature = name
                    | order by uses desc
                    """,
                ["models"] = """
                    ev
                    | where name == "generation.finished"
                    | summarize generations = count(), users = dcountif(uid, isnotempty(uid)) by model
                    | order by generations desc
                    """,
                ["messageMix"] = """
                    let redAt = ev | where name == "chat.red_enabled" | summarize redAt = min(timestamp) by chat;
                    let sent = ev | where name == "message.sent";
                    union
                        (sent
                            | join kind = leftouter redAt on chat
                            | extend logged = tostring(customDimensions["chat.red_enabled"])
                            | extend red = iff(isnotempty(logged), tobool(logged), isnotempty(redAt) and timestamp >= redAt)
                            | summarize messages = count() by value = iff(red, "on", "off")
                            | extend dimension = "redChat"),
                        (sent
                            | summarize messages = count() by value = tostring(customDimensions.classification)
                            | extend dimension = "classification"),
                        (sent
                            | summarize messages = count() by value = tostring(customDimensions.reasoning_effort)
                            | extend dimension = "reasoningEffort"),
                        (sent
                            | extend files = coalesce(toint(customDimensions["file.count"]), 0) + coalesce(toint(customDimensions["pinned_file.count"]), 0) + coalesce(toint(customDimensions["on_demand_file.count"]), 0)
                            | summarize messages = count() by value = iff(files > 0, "with", "without")
                            | extend dimension = "attachments"),
                        (sent
                            | extend toolboxes = tostring(customDimensions.toolboxes)
                            | extend toolbox = iff(isempty(toolboxes), dynamic([""]), split(toolboxes, ","))
                            | mv-expand toolbox to typeof(string)
                            | summarize messages = count() by value = toolbox
                            | extend dimension = "toolboxes")
                    | project dimension, value = iff(isempty(value), "none", value), messages
                    | order by dimension asc, messages desc
                    """,
                ["settings"] = """
                    ev
                    | where name == "client.setting_changed"
                    | summarize changes = count(), users = dcountif(uid, isnotempty(uid))
                        by setting = tostring(customDimensions.setting), value = tostring(customDimensions.value)
                    | order by changes desc
                    """
            },
            ["models"] = new Dictionary<string, string>
            {
                ["headline"] = """
                    ev
                    | summarize generations = countif(name == "generation.finished"),
                        failedGenerations = countif(name == "generation.finished" and tostring(customDimensions.outcome) == "failed"),
                        toolCalls = countif(name == "tool.call_finished"),
                        failedToolCalls = countif(name == "tool.call_finished" and tostring(customDimensions.status) in ("Error", "Timeout"))
                    """,
                ["generations"] = """
                    ev
                    | where name == "generation.finished"
                    | extend firstToken = todouble(customDimensions.time_to_first_token_ms),
                        duration = todouble(customDimensions.duration_ms),
                        rounds = toint(customDimensions["tool.rounds"])
                    | summarize generations = count(),
                        failed = countif(tostring(customDimensions.outcome) == "failed"),
                        p50FirstToken = percentile(firstToken, 50),
                        p95FirstToken = percentile(firstToken, 95),
                        p50Duration = percentile(duration, 50),
                        p95Duration = percentile(duration, 95),
                        avgToolRounds = avg(rounds),
                        tokensIn = sum(tolong(customDimensions["tokens.input"])),
                        tokensOut = sum(tolong(customDimensions["tokens.output"])),
                        tokensCached = sum(tolong(customDimensions["tokens.cached"]))
                        by model
                    | order by generations desc
                    """,
                ["tools"] = """
                    ev
                    | where name == "tool.call_finished"
                    | extend status = tostring(customDimensions.status), duration = todouble(customDimensions.duration_ms)
                    | summarize calls = count(),
                        failed = countif(status in ("Error", "Timeout")),
                        p50 = percentile(duration, 50),
                        p95 = percentile(duration, 95)
                        by tool = tostring(customDimensions["tool.id"]), toolbox = tostring(customDimensions.toolbox), execution = tostring(customDimensions.execution)
                    | order by calls desc
                    """
            },
            ["diagnostics"] = new Dictionary<string, string>
            {
                ["headline"] = """
                    print clientErrors = toscalar(er | where source == "client" | count),
                        serverErrors = toscalar(er | where source == "server" | count),
                        failedRequests = toscalar(rq | where success == false and not(probe) | count),
                        scannerProbes = toscalar(rq | where probe | count),
                        failedToolCalls = toscalar(ev | where name == "tool.call_finished" and tostring(customDimensions.status) in ("Error", "Timeout") | count)
                    """,
                ["errorsOverTime"] = """
                    er
                    | make-series client = countif(source == "client") default = 0, server = countif(source == "server") default = 0
                        on timestamp from bin(rangeStart, bucket) to now() step bucket
                    | mv-expand timestamp to typeof(datetime), client to typeof(long), server to typeof(long)
                    | project at = timestamp, client, server
                    """,
                ["errors"] = """
                    er
                    | extend event = iff(isempty(en), tostring(customDimensions.CategoryName), en),
                        detail = coalesce(tostring(customDimensions.kind), tostring(customDimensions["error.category"])),
                        errorName = coalesce(tostring(customDimensions["error.name"]), tostring(customDimensions["error.code"]), tostring(type)),
                        location = coalesce(tostring(customDimensions.route), tostring(customDimensions["tool.id"]), tostring(customDimensions.RequestPath)),
                        level = case(severityLevel == 4, "critical", severityLevel == 3, "error", severityLevel == 2, "warning", "info")
                    | summarize records = count(), sessions = dcountif(session, isnotempty(session)), lastSeen = max(timestamp)
                        by source, event, detail, errorName, location, level
                    | order by records desc
                    | take 100
                    """,
                ["failedRequests"] = """
                    rq
                    | where success == false
                    | summarize requests = count(), lastSeen = max(timestamp) by request = iff(probe, "", name), resultCode, probe
                    | order by requests desc
                    | take 100
                    """,
                ["audit"] = """
                    ev
                    | where eventKind == "audit"
                    | extend detail = strcat_array(pack_array(tostring(customDimensions.route), tostring(customDimensions.reason), tostring(customDimensions["entity.type"]), tostring(customDimensions.action)), " ")
                    | summarize records = count(), users = dcountif(uid, isnotempty(uid)), lastSeen = max(timestamp) by event = name, detail = trim(@"\s+", detail)
                    | order by records desc
                    """,
                ["clientVersions"] = """
                    union requests, customEvents, traces
                    | where isnotempty(tostring(customDimensions["service.version"]))
                    | extend app = tostring(customDimensions["client.app"]), version = tostring(customDimensions["client.version"]), session = tostring(customDimensions["client.session"])
                    | where app !in ("", "unknown")
                    | summarize sessions = dcountif(session, isnotempty(session)), records = count(), lastSeen = max(timestamp) by app, version
                    | order by lastSeen desc
                    """
            },
            ["logging"] = new Dictionary<string, string>
            {
                ["volume"] = """
                    let rows = union traces, exceptions, customEvents
                        | where isnotempty(tostring(customDimensions["service.version"]))
                        | extend en = tostring(customDimensions["event.name"])
                        | extend group = case(itemType == "customEvent", "events", isnotempty(en), "records", "category"),
                            source = iff(itemType == "customEvent" or isnotempty(en), "", tostring(customDimensions.CategoryName)),
                            level = case(itemType == "customEvent", "event", severityLevel == 4, "critical", severityLevel == 3, "error", severityLevel == 2, "warning", "info");
                    let total = toscalar(rows | count);
                    rows
                    | summarize records = count() by group, source, level
                    | extend share = iff(total == 0, 0.0, todouble(records) / total)
                    | order by records desc
                    | take 50
                    """,
                ["events"] = """
                    ev
                    | extend outcome = tostring(customDimensions.outcome), status = tostring(customDimensions.status)
                    | summarize records = count(),
                        sessions = dcountif(session, isnotempty(session)),
                        failed = countif(outcome == "failed" or status in ("Error", "Timeout")),
                        lastSeen = max(timestamp)
                        by event = name, eventKind
                    | order by records desc
                    """
            }
        };
}
