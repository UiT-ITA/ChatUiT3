using ChatUitReact.Server.Models;

namespace ChatUitReact.Server.Services;

public partial class MockDatabaseService
{
    private void InitializeEndpointsAndModels()
    {
        if (_endpoints.IsEmpty)
        {
            // Add real endpoint from configuration if available
            var azureEndpoint = _configuration["AzureOpenAI:Endpoint"];
            var azureApiKey = _configuration["AzureOpenAI:ApiKey"];

            if (!string.IsNullOrEmpty(azureEndpoint) && !string.IsNullOrEmpty(azureApiKey))
            {
                var realEndpoint = new ModelEndpoint
                {
                    Id = "real-azure-endpoint",
                    Url = azureEndpoint,
                    ApiKey = azureApiKey,
                    EndpointType = EndpointType.AzureOpenAI
                };
                _endpoints[realEndpoint.Id] = realEndpoint;

                // Add gpt-4o and gpt-4o-mini models for the real endpoint
                var gpt4oModel = new Model
                {
                    Id = "real-gpt-4o",
                    ModelName = "gpt-4o",
                    EndpointId = realEndpoint.Id,
                    AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super }
                };
                var gpt4oMiniModel = new Model
                {
                    Id = "real-gpt-4o-mini",
                    ModelName = "gpt-4o-mini",
                    EndpointId = realEndpoint.Id,
                    AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super }
                };
                var o4MiniModel = new Model
                {
                    Id = "real-04-mini",
                    ModelName = "o4-mini",
                    EndpointId = realEndpoint.Id,
                    AllowedRoles = new List<UserRole> { UserRole.Admin, UserRole.Beta, UserRole.Super }
                };
                var o3Model = new Model
                {
                    Id = "real-o3",
                    ModelName = "o3",
                    EndpointId = realEndpoint.Id,
                    AllowedRoles = new List<UserRole> { UserRole.Admin }
                };

                _models[gpt4oModel.Id] = gpt4oModel;
                _models[gpt4oMiniModel.Id] = gpt4oMiniModel;
                _models[o4MiniModel.Id] = o4MiniModel;
                _models[o3Model.Id] = o3Model;
            }

            // Add mock endpoints for testing
            var endpoint1 = new ModelEndpoint
            {
                Id = "endpoint-1",
                Url = "https://api.openai.com/v1",
                ApiKey = "sk-test-key-1",
                EndpointType = EndpointType.OpenAI
            };
            var endpoint2 = new ModelEndpoint
            {
                Id = "endpoint-2",
                Url = "https://your-resource.openai.azure.com/",
                ApiKey = "azure-test-key",
                EndpointType = EndpointType.AzureOpenAI
            };

            _endpoints[endpoint1.Id] = endpoint1;
            _endpoints[endpoint2.Id] = endpoint2;

            // Add mock models
            var model1 = new Model
            {
                Id = "model-1",
                ModelName = "gpt-4",
                EndpointId = endpoint1.Id,
                AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super }
            };
            var model2 = new Model
            {
                Id = "model-2",
                ModelName = "gpt-3.5-turbo",
                EndpointId = endpoint1.Id,
                AllowedRoles = new List<UserRole> { UserRole.User, UserRole.Admin, UserRole.Beta, UserRole.Super }
            };

            _models[model1.Id] = model1;
            _models[model2.Id] = model2;
        }
        

    }
}
