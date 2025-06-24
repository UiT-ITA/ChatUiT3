import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { CreateAssistantDto, UpdateAssistantDto, AnyAssistantDto } from '../types/dtos';

export const assistantKeys = {
  all: ['assistants'] as const,
  lists: () => [...assistantKeys.all, 'list'] as const,
};

export const useAssistants = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  
  const { data: assistantList, isLoading } = useQuery({
    queryKey: assistantKeys.lists(),
    queryFn: () => apiService.getAssistants(),
    staleTime: 10 * 60 * 1000,
    enabled: !isInitializing && isAuthenticated,
  });

  const allAssistants = useMemo((): AnyAssistantDto[] => {
    if (!assistantList) return [];
    return [...assistantList.owned, ...assistantList.system, ...assistantList.shared];
  }, [assistantList]);

  const visibleAssistants = useMemo((): AnyAssistantDto[] => {
    return allAssistants.filter(assistant => assistant.isVisible);
  }, [allAssistants]);

  const createAssistant = (createDto: CreateAssistantDto) => 
    apiService.createAssistant(createDto);

  const updateAssistant = (updateDto: UpdateAssistantDto) => 
    apiService.updateAssistant(updateDto);

  const deleteAssistant = (assistantId: string) => 
    apiService.deleteAssistant(assistantId);

  const toggleVisibility = (assistantId: string) => 
    apiService.toggleAssistantVisibility(assistantId);

  const addSharedAssistant = (assistantId: string) => 
    apiService.addSharedAssistant(assistantId);

  const generateShareLink = (assistantId: string) => 
    apiService.generateShareLink(assistantId);

  const getAvailableModels = () => 
    apiService.getAvailableModels();

  return {
    assistantList,
    allAssistants,
    visibleAssistants,
    isLoading,
    createAssistant,
    updateAssistant,
    deleteAssistant,
    toggleVisibility,
    addSharedAssistant,
    generateShareLink,
    getAvailableModels
  };
};
