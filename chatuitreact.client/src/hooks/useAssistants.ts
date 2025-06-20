import { useMemo } from 'react';
import { useSignalR } from '../contexts/SignalRContext';
import { CreateAssistantDto, UpdateAssistantDto, AnyAssistantDto } from '../types/dtos';

export const useAssistants = () => {
  const { 
    assistantList,
    isLoadingAssistants: isLoading,
    getUserAssistants, 
    createAssistant: createAssistantSignalR, 
    updateAssistant: updateAssistantSignalR, 
    deleteAssistant: deleteAssistantSignalR, 
    toggleAssistantVisibility, 
    addSharedAssistant: addSharedAssistantSignalR,
    getAvailableModels
  } = useSignalR();

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
    await createAssistantSignalR(createDto);
  };

  const updateAssistant = async (updateDto: UpdateAssistantDto) => {
    await updateAssistantSignalR(updateDto);
  };

  const deleteAssistant = async (assistantId: string) => {
    await deleteAssistantSignalR(assistantId);
  };

  const toggleVisibility = async (assistantId: string) => {
    await toggleAssistantVisibility(assistantId);
  };

  const addSharedAssistant = async (assistantId: string) => {
    await addSharedAssistantSignalR(assistantId);
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
    getUserAssistants,
    getAvailableModels
  };
};
