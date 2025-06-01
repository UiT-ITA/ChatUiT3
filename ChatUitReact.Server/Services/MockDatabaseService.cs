using ChatUitReact.Server.Models;
using System.Collections.Concurrent;
using Microsoft.Extensions.Configuration;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService : IDatabaseService
{
    private readonly IConfiguration _configuration;
    
    // Per-user storage instead of shared data
    private readonly ConcurrentDictionary<string, UserInfo> _userInfoStorage = new();
    
    // Existing storage structures
    private ConcurrentDictionary<string, List<Chat>> _chatStorage = new();
    private ConcurrentDictionary<string, ModelEndpoint> _endpoints = new();
    private ConcurrentDictionary<string, Model> _models = new();

    public MockDatabaseService(IConfiguration configuration)
    {
        _configuration = configuration;
        InitializeDummyData();
    }

    private void AddUserToService(string userId)
    {
        // Initialize user info if doesn't exist
        _userInfoStorage.GetOrAdd(userId, _ => new UserInfo
        {
            Username = userId,
            Roles = new List<UserRole>(_defaultUserRoles),
            Preferences = DeepCopyUserInfo(new UserInfo { Preferences = _defaultUserPreferences }).Preferences
        });

        // Initialize user chats if don't exist
        _chatStorage.GetOrAdd(userId, _ => 
        {
            return DeepCopyList(_dummyChatTemplate, DeepCopyChat);
        });
    }
}
