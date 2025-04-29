using ChatUitReact.Server.Models;
using ChatUitReact.Server.Models.DTOs;
using ChatUitReact.Server.Services.Mapping;
using System.Collections.Generic;

namespace ChatUitReact.Server.Services;

public class DummyService
{
    private readonly Dictionary<string, AiChat> _chats = new();
    private readonly Dictionary<string, AiAssistant> _assistants = new();
    private readonly Dictionary<string, AiModel> _models = new();
    private readonly Dictionary<string, AiChatTool> _tools = new();
    private readonly Dictionary<string, UserPreferences> _userPreferences = new();
    private readonly Dictionary<string, AiChatFile> _files = new();
    private readonly MapperService _mapper;

    public DummyService(MapperService mapper)
    {
        _mapper = mapper;
        // Initialize with some default data
        InitializeModels();
        InitializeTools();
        InitializeAssistants();
        InitializeChats();
        InitializeUserPreferences();
    }

    #region Model Retrieval Methods

    public List<AiAssistantDto> GetAssistants(string userId)
    {
        return _assistants.Values
            .Where(a => a.OwnerId == userId || a.IsSystemCreated || a.SharedWithUserIds.Contains(userId))
            .Select(_mapper.MapToAssistantDto)
            .ToList();
    }

    public AiAssistantDto? GetAssistant(string assistantId)
    {
        if (_assistants.TryGetValue(assistantId, out var assistant))
        {
            return _mapper.MapToAssistantDto(assistant);
        }
        return null;
    }

    public List<AiChatSummaryDto> GetChatSummaries(string userId)
    {
        return _chats.Values
            .Where(c => c.UserId == userId)
            .Select(_mapper.MapToChatSummaryDto)
            .ToList();
    }

    public AiChatDto? GetChat(string chatId, string userId)
    {
        if (_chats.TryGetValue(chatId, out var chat) && chat.UserId == userId)
        {
            return _mapper.MapToChatDto(chat);
        }
        return null;
    }

    public List<AiChatMessageDto> GetChatMessages(string chatId, string userId, int skip = 0, int take = 50)
    {
        if (_chats.TryGetValue(chatId, out var chat) && chat.UserId == userId)
        {
            return chat.Messages
                .OrderBy(m => m.Timestamp)
                .Skip(skip)
                .Take(take)
                .Select(m => _mapper.MapToChatMessageDto(m, chat.Files))
                .ToList();
        }
        return new List<AiChatMessageDto>();
    }

    public List<AiModelDto> GetAvailableModels()
    {
        return _models.Values.Select(_mapper.MapToModelDto).ToList();
    }

    public UserPreferencesDto GetUserPreferences(string userId)
    {
        if (_userPreferences.TryGetValue(userId, out var preferences))
        {
            return new UserPreferencesDto
            {
                Theme = preferences.Theme,
                Language = preferences.Language,
                Notifications = new NotificationSettingsDto
                {
                    EnableEmailNotifications = preferences.Notifications.EnableEmailNotifications,
                    EnablePushNotifications = preferences.Notifications.EnablePushNotifications,
                    DismissedNotifications = preferences.Notifications.DismissedNotifications
                },
                Display = new DisplaySettingsDto
                {
                    CompactMode = preferences.Display.CompactMode,
                    FontSize = preferences.Display.FontSize,
                    ShowTimestamps = preferences.Display.ShowTimestamps
                }
            };
        }

        // Return default preferences if not found
        return new UserPreferencesDto();
    }

    public List<AiChatToolDto> GetAvailableTools()
    {
        return _tools.Values.Select(t => new AiChatToolDto
        {
            Id = t.Id,
            Name = t.Name,
            Description = t.Description,
            Type = t.Type.ToString().ToLower()
        }).ToList();
    }

    #endregion

    #region Create/Update Methods

    public AiChatDto CreateChat(string userId, AiChatCreateDto createDto)
    {
        var assistantId = createDto.AssistantId;
        if (!_assistants.TryGetValue(assistantId, out var assistant))
        {
            // Fall back to first system assistant if specified one not found
            assistant = _assistants.Values.FirstOrDefault(a => a.IsSystemCreated) 
                ?? _assistants.Values.First();
        }

        var chat = new AiChat
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Name = string.IsNullOrWhiteSpace(createDto.Name) 
                ? $"Chat with {assistant.Name}" 
                : createDto.Name,
            Assistant = assistant,
            CurrentSettings = assistant.ModelSettings,
            CreatedAt = DateTime.UtcNow,
            Messages = new List<AiChatMessage>()
        };

        // Add initial message if provided
        if (!string.IsNullOrWhiteSpace(createDto.InitialMessage))
        {
            chat.Messages.Add(new AiChatMessage
            {
                Role = AiChatRole.User,
                Content = createDto.InitialMessage,
                Timestamp = DateTime.UtcNow
            });
            
            // Generate an assistant response
            chat.Messages.Add(new AiChatMessage
            {
                Role = AiChatRole.Assistant,
                Content = $"Hello! I'm {assistant.Name}. How can I help you today?",
                Timestamp = DateTime.UtcNow.AddSeconds(1)
            });
        }

        _chats[chat.Id] = chat;
        return _mapper.MapToChatDto(chat);
    }

    public AiChatMessageDto AddChatMessage(string userId, AiChatMessageCreateDto messageDto)
    {
        if (!_chats.TryGetValue(messageDto.ChatId, out var chat) || chat.UserId != userId)
        {
            return null;
        }

        // Create the user message
        var userMessage = new AiChatMessage
        {
            Role = AiChatRole.User,
            Content = messageDto.Content,
            Timestamp = DateTime.UtcNow,
            FileIds = messageDto.FileIds ?? new List<string>()
        };
        chat.Messages.Add(userMessage);

        // Generate a mock assistant response
        var assistantMessage = new AiChatMessage
        {
            Role = AiChatRole.Assistant,
            Content = GenerateAssistantResponse(messageDto.Content, chat.Assistant),
            Timestamp = DateTime.UtcNow.AddSeconds(1)
        };
        chat.Messages.Add(assistantMessage);

        return _mapper.MapToChatMessageDto(userMessage, chat.Files);
    }

    public AiAssistantDto CreateAssistant(string userId, AiAssistantCreateDto createDto)
    {
        // Ensure we have a valid model
        if (!_models.TryGetValue(createDto.ModelId, out var model))
        {
            model = _models.Values.First();
        }

        var assistant = new AiAssistant
        {
            Id = Guid.NewGuid().ToString(),
            Name = createDto.Name,
            Description = createDto.Description,
            Model = model,
            SystemPrompt = createDto.SystemPrompt,
            ModelSettings = new AiModelSettings
            {
                Temperature = createDto.ModelSettings.Temperature,
                MaxTokens = createDto.ModelSettings.MaxTokens,
                TopP = createDto.ModelSettings.TopP,
                ReasoningEffort = (ReasoningEffort)Enum.Parse(typeof(ReasoningEffort), 
                    createDto.ModelSettings.ReasoningEffort, true)
            },
            OwnerId = userId,
            IsSystemCreated = false,
            Tools = new List<AiChatTool>()
        };

        // Add tools
        if (createDto.ToolIds?.Any() == true)
        {
            foreach (var toolId in createDto.ToolIds)
            {
                if (_tools.TryGetValue(toolId, out var tool))
                {
                    assistant.Tools.Add(tool);
                }
            }
        }

        _assistants[assistant.Id] = assistant;
        return _mapper.MapToAssistantDto(assistant);
    }

    public AiChatFileDto UploadFile(string userId, string fileName, string contentType, long size)
    {
        var file = new AiChatFile
        {
            Id = Guid.NewGuid().ToString(),
            FileName = fileName,
            ContentType = contentType,
            Size = size,
            UploadedAt = DateTime.UtcNow,
            IsProcessed = true,
            StoragePath = $"/dummy/storage/{Guid.NewGuid()}/{fileName}",
            ProcessingStatus = "Processed successfully"
        };

        _files[file.Id] = file;
        return _mapper.MapToFileDto(file);
    }

    public UserPreferencesDto UpdateUserPreferences(string userId, UserPreferencesDto preferencesDto)
    {
        var preferences = _userPreferences.GetValueOrDefault(userId) ?? new UserPreferences { UserId = userId };
        
        preferences.Theme = preferencesDto.Theme;
        preferences.Language = preferencesDto.Language;
        
        preferences.Notifications.EnableEmailNotifications = preferencesDto.Notifications.EnableEmailNotifications;
        preferences.Notifications.EnablePushNotifications = preferencesDto.Notifications.EnablePushNotifications;
        preferences.Notifications.DismissedNotifications = preferencesDto.Notifications.DismissedNotifications;
        
        preferences.Display.CompactMode = preferencesDto.Display.CompactMode;
        preferences.Display.FontSize = preferencesDto.Display.FontSize;
        preferences.Display.ShowTimestamps = preferencesDto.Display.ShowTimestamps;

        _userPreferences[userId] = preferences;
        return preferencesDto;
    }

    #endregion

    #region Helper Methods

    private string GenerateAssistantResponse(string userMessage, AiAssistant assistant)
    {
        // A very simple mock response generator
        var responses = new List<string>
        {
            $"I understand you're asking about '{userMessage}'. As {assistant.Name}, I'll do my best to help.",
            $"That's an interesting question about '{userMessage}'. Let me think about that.",
            $"Thanks for your message. To respond to '{userMessage}', I would need to consider a few factors.",
            $"I've processed your request about '{userMessage}'. Here's what I can tell you...",
            $"Based on my training as {assistant.Name}, I can provide some insights on '{userMessage}'."
        };

        // If the message contains specific keywords, provide targeted responses
        if (userMessage.Contains("hello", StringComparison.OrdinalIgnoreCase) || 
            userMessage.Contains("hi", StringComparison.OrdinalIgnoreCase))
        {
            return $"Hello! I'm {assistant.Name}. How can I assist you today?";
        }
        
        if (userMessage.Contains("help", StringComparison.OrdinalIgnoreCase))
        {
            return $"I'm here to help! As {assistant.Name}, I can assist with questions, tasks, and information. What specific help do you need?";
        }

        // Generate a random response for other messages
        var random = new Random();
        return responses[random.Next(responses.Count)];
    }

    #endregion

    #region Initialization Methods

    private void InitializeModels()
    {
        var models = new List<AiModel>
        {
            new AiModel
            {
                Id = "gpt-4-turbo",
                Name = "GPT-4 Turbo",
                Description = "Most capable GPT-4 model, optimized for speed and cost",
                ModelId = "gpt-4-turbo",
                ModelType = AiModelType.AzureOpenAI,
                Capabilities = new AiModelCapabilities
                {
                    SupportsVision = true,
                    SupportsReasoning = true,
                    SupportsFunctionCalling = true,
                    MaxContextLength = 128000
                }
            },
            new AiModel
            {
                Id = "gpt-3.5-turbo",
                Name = "GPT-3.5 Turbo",
                Description = "Most capable GPT-3.5 model optimized for chat at 1/10th the cost of GPT-4",
                ModelId = "gpt-35-turbo",
                ModelType = AiModelType.AzureOpenAI,
                Capabilities = new AiModelCapabilities
                {
                    SupportsVision = false,
                    SupportsReasoning = true,
                    SupportsFunctionCalling = true,
                    MaxContextLength = 16000
                }
            },
            new AiModel
            {
                Id = "claude-3-opus",
                Name = "Claude 3 Opus",
                Description = "Anthropic's most powerful model for highly complex tasks",
                ModelId = "claude-3-opus-20240229",
                ModelType = AiModelType.Anthropic,
                Capabilities = new AiModelCapabilities
                {
                    SupportsVision = true,
                    SupportsReasoning = true,
                    SupportsFunctionCalling = true,
                    MaxContextLength = 200000
                }
            }
        };

        foreach (var model in models)
        {
            _models[model.Id] = model;
        }
    }

    private void InitializeTools()
    {
        var tools = new List<AiChatTool>
        {
            new AiChatTool
            {
                Id = "web-search",
                Name = "Web Search",
                Description = "Search the web for current information",
                Type = ToolType.WebSearch
            },
            new AiChatTool
            {
                Id = "code-interpreter",
                Name = "Code Interpreter",
                Description = "Execute code and analyze data",
                Type = ToolType.CodeInterpreter
            },
            new AiChatTool
            {
                Id = "document-retrieval",
                Name = "Document Retrieval",
                Description = "Retrieve information from uploaded documents",
                Type = ToolType.FileSearch
            }
        };

        foreach (var tool in tools)
        {
            _tools[tool.Id] = tool;
        }
    }

    private void InitializeAssistants()
    {
        var assistants = new List<AiAssistant>
        {
            new AiAssistant
            {
                Id = "general-assistant",
                Name = "General Assistant",
                Description = "A helpful and versatile assistant for general questions and tasks",
                Model = _models["gpt-4-turbo"],
                SystemPrompt = "You are a helpful, harmless, and honest assistant. Always provide accurate information and admit when you don't know something.",
                ModelSettings = new AiModelSettings
                {
                    Temperature = 0.7f,
                    MaxTokens = 4000,
                    ReasoningEffort = ReasoningEffort.Medium
                },
                IsSystemCreated = true,
                OwnerId = "system",
                Tools = new List<AiChatTool> { _tools["web-search"] }
            },
            new AiAssistant
            {
                Id = "code-assistant",
                Name = "Code Assistant",
                Description = "Specialized assistant for programming and software development",
                Model = _models["gpt-4-turbo"],
                SystemPrompt = "You are a code assistant specialized in programming and software development. Provide clear explanations and well-structured code examples.",
                ModelSettings = new AiModelSettings
                {
                    Temperature = 0.3f,
                    MaxTokens = 8000,
                    ReasoningEffort = ReasoningEffort.High
                },
                IsSystemCreated = true,
                OwnerId = "system",
                Tools = new List<AiChatTool> { _tools["code-interpreter"] }
            },
            new AiAssistant
            {
                Id = "research-assistant",
                Name = "Research Assistant",
                Description = "Assistant designed for academic research and data analysis",
                Model = _models["claude-3-opus"],
                SystemPrompt = "You are a research assistant. Help users analyze information, find scholarly sources, and understand complex topics. Be thorough and precise in your explanations.",
                ModelSettings = new AiModelSettings
                {
                    Temperature = 0.2f,
                    MaxTokens = 8000,
                    ReasoningEffort = ReasoningEffort.High
                },
                IsSystemCreated = true,
                OwnerId = "system",
                Tools = new List<AiChatTool> { _tools["web-search"], _tools["document-retrieval"] }
            }
        };

        foreach (var assistant in assistants)
        {
            _assistants[assistant.Id] = assistant;
        }
    }

    private void InitializeChats()
    {
        // Sample user IDs
        var userIds = new[] { "user-1", "user-2" };

        // Create some sample conversations for each user
        foreach (var userId in userIds)
        {
            // Chat with the general assistant
            var chat1 = CreateSampleChat(
                userId,
                _assistants["general-assistant"],
                "Everyday Questions",
                new List<(AiChatRole Role, string Content)>
                {
                    (AiChatRole.User, "What are some good productivity techniques?"),
                    (AiChatRole.Assistant, "There are several effective productivity techniques that can help you manage your time and focus better:\n\n1. **Pomodoro Technique**: Work for 25 minutes, then take a 5-minute break. After completing 4 cycles, take a longer break of 15-30 minutes.\n\n2. **Time Blocking**: Dedicate specific blocks of time to particular tasks or types of work.\n\n3. **Eisenhower Matrix**: Prioritize tasks based on their urgency and importance.\n\n4. **Getting Things Done (GTD)**: Capture all tasks in an external system, clarify what they mean, organize them, reflect on priorities, and engage with the most important tasks.\n\n5. **Eat That Frog**: Start your day by tackling the most challenging or important task first.\n\nThe key is finding which technique works best for your work style and consistently applying it. Would you like me to elaborate on any of these techniques?"),
                    (AiChatRole.User, "Tell me more about the Eisenhower Matrix"),
                    (AiChatRole.Assistant, "The Eisenhower Matrix (also known as the Urgent-Important Matrix) is a productivity and decision-making framework attributed to Dwight D. Eisenhower, the 34th President of the United States.\n\nHere's how it works:\n\n1. **Quadrant 1: Urgent and Important** - Tasks that require immediate attention and have significant consequences. These are typically crises, pressing problems, or deadline-driven projects. Action: Do these tasks immediately.\n\n2. **Quadrant 2: Important but Not Urgent** - Tasks that contribute to long-term goals, relationships, and personal development. These include planning, prevention, capability improvement, relationship building, and recognizing new opportunities. Action: Schedule time to do these tasks.\n\n3. **Quadrant 3: Urgent but Not Important** - Tasks that demand attention but don't contribute significantly to your goals. These might include some meetings, calls, emails, or interruptions that feel urgent but don't align with your priorities. Action: Delegate these tasks if possible.\n\n4. **Quadrant 4: Neither Urgent nor Important** - Tasks that are distractions and don't contribute to your goals. These might include excessive TV watching, some social media browsing, or other time-wasting activities. Action: Eliminate these tasks.\n\nThe matrix helps you prioritize by distinguishing between what's truly important versus what merely seems urgent. The goal is to spend more time in Quadrant 2 (Important but Not Urgent), which reduces the time you'll need to spend handling crises in Quadrant 1.\n\nWould you like me to suggest ways to implement this matrix in your daily routine?")
                });

            // Chat with the code assistant
            var chat2 = CreateSampleChat(
                userId,
                _assistants["code-assistant"],
                "Learning Python",
                new List<(AiChatRole Role, string Content)>
                {
                    (AiChatRole.User, "How do I create a simple API in Python?"),
                    (AiChatRole.Assistant, "Creating a simple API in Python is straightforward, especially with frameworks like Flask or FastAPI. Let me show you both approaches:\n\n### Using Flask (Lightweight and Simple)\n\n```python\nfrom flask import Flask, jsonify, request\n\napp = Flask(__name__)\n\n# Sample data\ntodos = [\n    {\"id\": 1, \"task\": \"Learn Python\", \"completed\": False},\n    {\"id\": 2, \"task\": \"Build an API\", \"completed\": False}\n]\n\n@app.route('/todos', methods=['GET'])\ndef get_todos():\n    return jsonify(todos)\n\n@app.route('/todos/<int:todo_id>', methods=['GET'])\ndef get_todo(todo_id):\n    todo = next((item for item in todos if item[\"id\"] == todo_id), None)\n    if todo:\n        return jsonify(todo)\n    return jsonify({\"error\": \"Todo not found\"}), 404\n\n@app.route('/todos', methods=['POST'])\ndef create_todo():\n    if not request.json or 'task' not in request.json:\n        return jsonify({\"error\": \"Task is required\"}), 400\n    \n    new_todo = {\n        \"id\": todos[-1][\"id\"] + 1 if todos else 1,\n        \"task\": request.json[\"task\"],\n        \"completed\": request.json.get(\"completed\", False)\n    }\n    todos.append(new_todo)\n    return jsonify(new_todo), 201\n\nif __name__ == '__main__':\n    app.run(debug=True)\n```\n\n### Using FastAPI (Modern, Fast, with Automatic Documentation)\n\n```python\nfrom fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\nfrom typing import List, Optional\n\napp = FastAPI()\n\nclass TodoBase(BaseModel):\n    task: str\n    completed: bool = False\n\nclass Todo(TodoBase):\n    id: int\n\n# Sample data\ntodos = [\n    Todo(id=1, task=\"Learn Python\", completed=False),\n    Todo(id=2, task=\"Build an API\", completed=False)\n]\n\n@app.get(\"/todos\", response_model=List[Todo])\ndef get_todos():\n    return todos\n\n@app.get(\"/todos/{todo_id}\", response_model=Todo)\ndef get_todo(todo_id: int):\n    todo = next((item for item in todos if item.id == todo_id), None)\n    if not todo:\n        raise HTTPException(status_code=404, detail=\"Todo not found\")\n    return todo\n\n@app.post(\"/todos\", response_model=Todo, status_code=201)\ndef create_todo(todo: TodoBase):\n    new_id = max(t.id for t in todos) + 1 if todos else 1\n    new_todo = Todo(id=new_id, task=todo.task, completed=todo.completed)\n    todos.append(new_todo)\n    return new_todo\n```\n\nTo run either of these examples:\n\n1. Install the required framework:\n   - Flask: `pip install flask`\n   - FastAPI: `pip install fastapi uvicorn`\n\n2. Save the code in a file (e.g., `app.py`)\n\n3. Run the application:\n   - Flask: `python app.py`\n   - FastAPI: `uvicorn app:app --reload`\n\n4. Access your API:\n   - Flask: http://127.0.0.1:5000/todos\n   - FastAPI: http://127.0.0.1:8000/todos\n\nWith FastAPI, you also get automatic interactive documentation at http://127.0.0.1:8000/docs\n\nWhich approach would you like me to explain in more detail?"),
                    (AiChatRole.User, "How would I add authentication to the FastAPI version?"),
                    (AiChatRole.Assistant, "Adding authentication to a FastAPI application is straightforward using built-in security utilities. Here's how you can implement JWT (JSON Web Token) authentication, which is a common approach for APIs:\n\n```python\nfrom fastapi import FastAPI, HTTPException, Depends, status\nfrom fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm\nfrom pydantic import BaseModel\nfrom typing import List, Optional\nfrom datetime import datetime, timedelta\nfrom jose import JWTError, jwt\nfrom passlib.context import CryptContext\n\n# Security configuration\nSECRET_KEY = \"your-secret-key\"  # In production, use a proper secret management solution\nALGORITHM = \"HS256\"\nACCESS_TOKEN_EXPIRE_MINUTES = 30\n\n# Password hashing\npwd_context = CryptContext(schemes=[\"bcrypt\"], deprecated=\"auto\")\noauth2_scheme = OAuth2PasswordBearer(tokenUrl=\"token\")\n\n# FastAPI app\napp = FastAPI()\n\n# Models\nclass User(BaseModel):\n    username: str\n    email: str = None\n    full_name: str = None\n    disabled: bool = False\n    hashed_password: str\n\nclass UserInDB(User):\n    hashed_password: str\n\nclass Token(BaseModel):\n    access_token: str\n    token_type: str\n\nclass TokenData(BaseModel):\n    username: str = None\n\nclass TodoBase(BaseModel):\n    task: str\n    completed: bool = False\n\nclass Todo(TodoBase):\n    id: int\n    owner: str\n\n# Mock database\nusers_db = {\n    \"johndoe\": {\n        \"username\": \"johndoe\",\n        \"full_name\": \"John Doe\",\n        \"email\": \"johndoe@example.com\",\n        \"hashed_password\": pwd_context.hash(\"secret\"),\n        \"disabled\": False,\n    }\n}\n\ntodos_db = [\n    {\"id\": 1, \"task\": \"Learn Python\", \"completed\": False, \"owner\": \"johndoe\"},\n    {\"id\": 2, \"task\": \"Build an API\", \"completed\": False, \"owner\": \"johndoe\"}\n]\n\n# Helper functions\ndef verify_password(plain_password, hashed_password):\n    return pwd_context.verify(plain_password, hashed_password)\n\ndef get_user(db, username: str):\n    if username in db:\n        user_dict = db[username]\n        return UserInDB(**user_dict)\n    return None\n\ndef authenticate_user(fake_db, username: str, password: str):\n    user = get_user(fake_db, username)\n    if not user:\n        return False\n    if not verify_password(password, user.hashed_password):\n        return False\n    return user\n\ndef create_access_token(data: dict, expires_delta: timedelta = None):\n    to_encode = data.copy()\n    if expires_delta:\n        expire = datetime.utcnow() + expires_delta\n    else:\n        expire = datetime.utcnow() + timedelta(minutes=15)\n    to_encode.update({\"exp\": expire})\n    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)\n    return encoded_jwt\n\nasync def get_current_user(token: str = Depends(oauth2_scheme)):\n    credentials_exception = HTTPException(\n        status_code=status.HTTP_401_UNAUTHORIZED,\n        detail=\"Could not validate credentials\",\n        headers={\"WWW-Authenticate\": \"Bearer\"},\n    )\n    try:\n        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])\n        username: str = payload.get(\"sub\")\n        if username is None:\n            raise credentials_exception\n        token_data = TokenData(username=username)\n    except JWTError:\n        raise credentials_exception\n    user = get_user(users_db, username=token_data.username)\n    if user is None:\n        raise credentials_exception\n    return user\n\nasync def get_current_active_user(current_user: User = Depends(get_current_user)):\n    if current_user.disabled:\n        raise HTTPException(status_code=400, detail=\"Inactive user\")\n    return current_user\n\n# Routes\n@app.post(\"/token\", response_model=Token)\nasync def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):\n    user = authenticate_user(users_db, form_data.username, form_data.password)\n    if not user:\n        raise HTTPException(\n            status_code=status.HTTP_401_UNAUTHORIZED,\n            detail=\"Incorrect username or password\",\n            headers={\"WWW-Authenticate\": \"Bearer\"},\n        )\n    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)\n    access_token = create_access_token(\n        data={\"sub\": user.username}, expires_delta=access_token_expires\n    )\n    return {\"access_token\": access_token, \"token_type\": \"bearer\"}\n\n@app.get(\"/users/me\")\nasync def read_users_me(current_user: User = Depends(get_current_active_user)):\n    return current_user\n\n@app.get(\"/todos\", response_model=List[Todo])\nasync def get_todos(current_user: User = Depends(get_current_active_user)):\n    return [Todo(id=todo[\"id\"], task=todo[\"task\"], completed=todo[\"completed\"], owner=todo[\"owner\"])\n            for todo in todos_db if todo[\"owner\"] == current_user.username]\n\n@app.get(\"/todos/{todo_id}\", response_model=Todo)\nasync def get_todo(todo_id: int, current_user: User = Depends(get_current_active_user)):\n    for todo in todos_db:\n        if todo[\"id\"] == todo_id and todo[\"owner\"] == current_user.username:\n            return Todo(id=todo[\"id\"], task=todo[\"task\"], completed=todo[\"completed\"], owner=todo[\"owner\"])\n    raise HTTPException(status_code=404, detail=\"Todo not found\")\n\n@app.post(\"/todos\", response_model=Todo, status_code=201)\nasync def create_todo(todo: TodoBase, current_user: User = Depends(get_current_active_user)):\n    new_id = max(todo[\"id\"] for todo in todos_db) + 1 if todos_db else 1\n    new_todo = {\n        \"id\": new_id, \n        \"task\": todo.task, \n        \"completed\": todo.completed, \n        \"owner\": current_user.username\n    }\n    todos_db.append(new_todo)\n    return Todo(**new_todo)\n```\n\nTo use this authentication system:\n\n1. Install the required dependencies:\n   ```\n   pip install fastapi python-jose[cryptography] passlib[bcrypt] python-multipart\n   ```\n\n2. To obtain a token, make a POST request to `/token` with form data:\n   - username: johndoe\n   - password: secret\n\n3. Use the returned token in subsequent requests by including an `Authorization` header:\n   ```\n   Authorization: Bearer <your_token>\n   ```\n\n### Security Notes:\n\n1. In a production environment, use a strong, randomly generated secret key and store it securely.\n2. Consider using refresh tokens for better security.\n3. Implement proper user registration and password reset flows.\n4. Consider using HTTPS for all API communications.\n5. You may want to add rate limiting to prevent brute force attacks.\n\nThis implementation uses JWT tokens, which are stateless. If you need to invalidate tokens (e.g., for logout), you'd need to implement a token blacklist or switch to a different authentication method.\n\nWould you like me to explain any part of this implementation in more detail?")
                });

            // Chat with the research assistant
            var chat3 = CreateSampleChat(
                userId,
                _assistants["research-assistant"],
                "Climate Change Research",
                new List<(AiChatRole Role, string Content)>
                {
                    (AiChatRole.User, "What are the latest findings on climate change mitigation strategies?"),
                    (AiChatRole.Assistant, "# Recent Climate Change Mitigation Strategies: Key Findings\n\nRecent research on climate change mitigation has produced several important developments across multiple sectors. Here's a synthesis of the latest significant findings:\n\n## Energy Transition Innovations\n\n1. **Enhanced Renewable Integration**\n   - Recent advancements in grid-scale battery storage have significantly improved the viability of intermittent renewables\n   - Development of AI-optimized smart grids has reduced integration costs by 15-30% in pilot projects\n   - Green hydrogen is increasingly viewed as crucial for sectors resistant to direct electrification\n\n2. **Nuclear Energy Reassessment**\n   - Small Modular Reactors (SMRs) are showing promise with reduced construction times and enhanced safety features\n   - Several next-generation designs addressing waste and safety concerns are in advanced testing phases\n\n## Carbon Capture Technologies\n\n1. **Direct Air Capture (DAC)**\n   - Cost reductions of approximately 30-40% have been achieved in newer DAC systems\n   - Commercial-scale DAC facilities are being deployed in Iceland, Canada, and the United States\n   - Research indicates geological storage capacity is sufficient for large-scale carbon sequestration\n\n2. **Enhanced Natural Carbon Sinks**\n   - Improved forestry management techniques have demonstrated 20-35% greater carbon sequestration\n   - Biochar application to agricultural soils shows significant carbon sequestration potential alongside soil health benefits\n   - Blue carbon ecosystems (coastal mangroves, seagrass beds) are increasingly recognized for their exceptional carbon storage capacity\n\n## Policy & Economic Frameworks\n\n1. **Carbon Pricing Effectiveness**\n   - Empirical studies now demonstrate significant emissions reductions in regions with well-designed carbon pricing\n   - Border carbon adjustments are increasingly being implemented to prevent carbon leakage\n\n2. **Sectoral Approaches**\n   - Targeted policies for hard-to-abate sectors (cement, steel, aviation) are showing promise\n   - Circular economy strategies are reducing embedded carbon in manufacturing\n\n## Behavioral & Social Dimensions\n\n1. **Consumption Patterns**\n   - Dietary shifts toward plant-based foods show substantial mitigation potential\n   - Sharing economy and product-as-service models demonstrate significant resource efficiency improvements\n\n2. **Just Transition Frameworks**\n   - Evidence-based approaches for equitable transition planning are emerging\n   - Community-based initiatives show enhanced adoption rates and sustainability\n\n## Integrated Assessment\n\nRecent integrated assessment models suggest that combining multiple strategies across sectors—particularly when reinforced by policy incentives and behavioral changes—can achieve emissions reductions consistent with limiting warming to 1.5°C, though the window for action continues to narrow.\n\nWould you like me to elaborate on any particular aspect of these findings?"),
                    (AiChatRole.User, "Tell me more about Direct Air Capture technology and its potential"),
                    (AiChatRole.Assistant, "# Direct Air Capture (DAC) Technology: Current Status and Future Potential\n\n## Fundamental Principles\n\nDirect Air Capture (DAC) technologies extract CO₂ directly from ambient air rather than from concentrated point sources. The two predominant approaches are:\n\n1. **Liquid Solvent Systems**\n   - Use aqueous solutions (typically potassium hydroxide) that react with CO₂\n   - Example: Carbon Engineering's technology\n   - Benefits: Established chemical engineering principles, scalable\n   - Challenges: High water usage, significant heat requirements\n\n2. **Solid Sorbent Systems**\n   - Utilize porous materials functionalized with amine groups or metal-organic frameworks\n   - Examples: Climeworks, Global Thermostat technologies\n   - Benefits: Lower heat requirements, modular design\n   - Challenges: Sorbent degradation over time, complex material science\n\n## Current Technological Status\n\n### Operational Facilities\n\n- **Orca (Iceland)**: Climeworks' facility captures 4,000 tons CO₂/year, mineralizing it in basaltic rock formations\n- **Squamish (Canada)**: Carbon Engineering's pilot plant demonstrating liquid solvent technology\n- **Arizona State University**: Global Thermostat's demonstration facility\n\n### Efficiency Metrics\n\n- **Energy Requirements**: Current technologies require 1.5-2.5 GJ of energy per ton of CO₂\n- **Capture Cost**: $250-600 per ton of CO₂, with some companies projecting $100-150/ton at scale\n- **Land Use**: Relatively compact compared to biological approaches (~100-1000x more efficient per unit area)\n\n## Recent Breakthroughs\n\n1. **Material Science Advances**\n   - Novel metal-organic frameworks (MOFs) with 3-5x greater CO₂ selectivity\n   - Bio-inspired sorbents mimicking enzymatic CO₂ capture mechanisms\n   - Reduced regeneration temperatures, lowering energy requirements by 20-30%\n\n2. **Process Engineering Improvements**\n   - Enhanced heat integration reducing waste energy\n   - Modular designs allowing for manufacturing efficiencies\n   - Co-location with renewable energy sources to reduce operational carbon intensity\n\n## Scale-up Potential and Challenges\n\n### Pathways to Gigatonne Scale\n\n- Current global DAC capacity is ~10,000 tons/year\n- IPCC scenarios suggest 2-10 Gt/year of negative emissions may be needed by 2050\n- Scale-up requires:\n  - Order-of-magnitude cost reductions\n  - Massive clean energy expansion (could require 5-15% of global energy)\n  - Supply chain development for specialized materials\n\n### Economic Viability\n\n- Carbon markets currently offer insufficient incentives ($5-80/ton in most markets)\n- Corporate net-zero commitments driving voluntary purchases at premium prices\n- Government procurement (e.g., US Department of Energy's Carbon Negative Shot) providing early market pull\n\n### Environmental Considerations\n\n- **Water Usage**: 5-15 tons water per ton CO₂ for some designs\n- **Land Requirements**: Substantially less than biological approaches\n- **Life Cycle Analysis**: Full carbon negativity requires low-carbon energy sources\n\n## Integration with Carbon Management Systems\n\n### Utilization Pathways\n\n1. **Enhanced Hydrocarbon Recovery**: Using captured CO₂ for enhanced oil recovery (controversial from climate perspective)\n2. **Synthetic Fuels**: Combining CO₂ with green hydrogen to produce drop-in replacements for jet fuel, diesel\n3. **Materials Production**: Creating building materials, plastics, and other carbon-based products\n4. **Agricultural Applications**: Greenhouses, food preservation, soil amendments\n\n### Permanent Storage Options\n\n1. **Geological Sequestration**: Injecting into saline aquifers or depleted oil/gas fields\n2. **Mineral Carbonation**: Converting CO₂ to stable carbonates (natural or accelerated weathering)\n3. **Ocean Alkalinity Enhancement**: Increasing ocean's capacity to safely store carbon\n\n## Research Frontiers\n\n- **Passive Systems**: Developing sorbents that capture CO₂ without energy input for regeneration\n- **Direct Air to Fuels**: Integrated systems converting air-captured CO₂ directly to fuels\n- **Hybrid Biological-Technological Systems**: Combining DAC with biological systems for enhanced efficiency\n\n## Policy and Market Context\n\n- **45Q Tax Credit** (US): Now offering up to $180/ton for DAC with geological storage\n- **Innovation Funding**: Major investments from Breakthrough Energy Ventures, US DOE, EU Innovation Fund\n- **Corporate Offtake Agreements**: Microsoft, Stripe, Shopify purchasing future DAC credits\n\n## Expert Assessment\n\nWhile DAC faces significant challenges in cost, energy requirements, and scalability, recent technological progress and increased investment suggest it will be an important component of the climate solution portfolio. However, most climate scientists emphasize that DAC should complement—not replace—rapid emissions reductions across all sectors.\n\nWould you like me to explore any particular aspect of DAC technology in greater depth?")
                });

            // Add the chats to the collection
            _chats[chat1.Id] = chat1;
            _chats[chat2.Id] = chat2;
            _chats[chat3.Id] = chat3;
        }
    }

    private AiChat CreateSampleChat(string userId, AiAssistant assistant, string chatName, List<(AiChatRole Role, string Content)> messages)
    {
        var chat = new AiChat
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Name = chatName,
            Assistant = assistant,
            CurrentSettings = assistant.ModelSettings,
            CreatedAt = DateTime.UtcNow.AddDays(-7).AddMinutes(new Random().Next(1, 10080)), // Random time within the last 7 days
            Messages = new List<AiChatMessage>()
        };

        // Add messages with incrementing timestamps
        var timestamp = chat.CreatedAt;
        foreach (var (role, content) in messages)
        {
            chat.Messages.Add(new AiChatMessage
            {
                Role = role,
                Content = content,
                Timestamp = timestamp
            });
            timestamp = timestamp.AddMinutes(1 + new Random().Next(5)); // Random time between messages
        }

        return chat;
    }

    private void InitializeUserPreferences()
    {
        var userIds = new[] { "user-1", "user-2" };

        foreach (var userId in userIds)
        {
            _userPreferences[userId] = new UserPreferences
            {
                UserId = userId,
                Theme = userId == "user-1" ? "dark" : "light",
                Language = "en-US",
                Notifications = new NotificationSettings
                {
                    EnableEmailNotifications = true,
                    EnablePushNotifications = true,
                    DismissedNotifications = new Dictionary<string, bool>
                    {
                        { "welcome-tour", true },
                        { "new-features-2025", false }
                    }
                },
                Display = new DisplaySettings
                {
                    CompactMode = userId == "user-1",
                    FontSize = userId == "user-1" ? 16 : 14,
                    ShowTimestamps = true
                }
            };
        }
    }
    #endregion
}