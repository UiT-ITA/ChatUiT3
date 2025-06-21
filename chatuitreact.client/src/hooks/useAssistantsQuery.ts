import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { CreateAssistantDto, UpdateAssistantDto } from '../types/dtos';

// Query keys for assistants
export const assistantKeys = {
  all: ['assistants'] as const,
  lists: () => [...assistantKeys.all, 'list'] as const,
};

// Get all assistants
export const useAssistantsQuery = (enabled = true) => {
  return useQuery({
    queryKey: assistantKeys.lists(),
    queryFn: () => apiService.getAssistants(),
    staleTime: 10 * 60 * 1000, // 10 minutes - assistants don't change often
    enabled,
  });
};

// Create assistant
export const useCreateAssistant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (createDto: CreateAssistantDto) => apiService.createAssistant(createDto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
    },
  });
};

// Update assistant
export const useUpdateAssistant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updateDto: UpdateAssistantDto) => apiService.updateAssistant(updateDto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
    },
  });
};

// Delete assistant
export const useDeleteAssistant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assistantId: string) => apiService.deleteAssistant(assistantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
    },
  });
};

// Toggle assistant visibility
export const useToggleAssistantVisibility = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assistantId: string) => apiService.toggleAssistantVisibility(assistantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
    },
  });
};

// Add shared assistant
export const useAddSharedAssistant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (assistantId: string) => apiService.addSharedAssistant(assistantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
    },
  });
};

// Generate share link
export const useGenerateShareLink = () => {
  return useMutation({
    mutationFn: (assistantId: string) => apiService.generateShareLink(assistantId),
  });
};

// Get available models
export const useGetAvailableModels = () => {
  return useMutation({
    mutationFn: () => apiService.getAvailableModels(),
  });
};
