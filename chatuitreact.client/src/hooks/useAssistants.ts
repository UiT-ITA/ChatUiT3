import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  useAssistantsQuery,
  useDeleteAssistant,
  useToggleAssistantVisibility,
  useAddSharedAssistant,
  useGenerateShareLink,
  useGetAvailableModels
} from './useAssistantsQuery';
import { CreateAssistantDto, UpdateAssistantDto, AnyAssistantDto } from '../types/dtos';
import { apiService } from '../services/apiService';

export const useAssistants = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const { data: assistantList, isLoading } = useAssistantsQuery(!isInitializing && isAuthenticated);
  const deleteMutation = useDeleteAssistant();
  const toggleVisibilityMutation = useToggleAssistantVisibility();
  const addSharedMutation = useAddSharedAssistant();
  const generateShareLinkMutation = useGenerateShareLink();
  const getAvailableModelsMutation = useGetAvailableModels();

  const allAssistants = useMemo((): AnyAssistantDto[] => {
    if (!assistantList) return [];
    return [
      ...assistantList.owned,
      ...assistantList.system,
      ...assistantList.shared
    ];
  }, [assistantList]);

  const visibleAssistants = useMemo((): AnyAssistantDto[] => {
    if (!assistantList) return [];
    
    return allAssistants.filter(assistant => assistant.isVisible);
  }, [allAssistants]);

  const createAssistant = (createDto: CreateAssistantDto) => {
    apiService.createAssistant(createDto);
  };

  const updateAssistant = (updateDto: UpdateAssistantDto) => {
    apiService.updateAssistant(updateDto);
  };

  const deleteAssistant = async (assistantId: string) => {
    await deleteMutation.mutateAsync(assistantId);
  };

  const toggleVisibility = async (assistantId: string) => {
    await toggleVisibilityMutation.mutateAsync(assistantId);
  };

  const addSharedAssistant = async (assistantId: string) => {
    await addSharedMutation.mutateAsync(assistantId);
  };

  const generateShareLink = async (assistantId: string) => {
    return await generateShareLinkMutation.mutateAsync(assistantId);
  };

  const getAvailableModels = async () => {
    return await getAvailableModelsMutation.mutateAsync();
  };

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
