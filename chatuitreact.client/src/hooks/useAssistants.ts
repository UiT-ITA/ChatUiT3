import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  useAssistantsQuery,
  useCreateAssistant,
  useUpdateAssistant,
  useDeleteAssistant,
  useToggleAssistantVisibility,
  useAddSharedAssistant,
  useGenerateShareLink,
  useGetAvailableModels
} from './useAssistantsQuery';
import { CreateAssistantDto, UpdateAssistantDto, AnyAssistantDto } from '../types/dtos';

export const useAssistants = () => {
  const { isAuthenticated, isInitializing } = useAuth();
  const { data: assistantList, isLoading } = useAssistantsQuery(!isInitializing && isAuthenticated);
  const createMutation = useCreateAssistant();
  const updateMutation = useUpdateAssistant();
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

  const createAssistant = async (createDto: CreateAssistantDto) => {
    await createMutation.mutateAsync(createDto);
  };

  const updateAssistant = async (updateDto: UpdateAssistantDto) => {
    await updateMutation.mutateAsync(updateDto);
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
