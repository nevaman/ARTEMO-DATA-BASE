import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DynamicTool, Project, ChatHistoryItem } from '../types';

interface UIState {
  theme: 'light' | 'dark';
  isSidebarOpen: boolean;
  searchTerm: string;
  favoriteTools: string[];
  recentTools: string[];
  isModalOpen: boolean;
  isChatSearchOpen: boolean;
  itemToRename: { id: string; name: string; type: 'project' | 'chat' } | null;
  toolForActivation: DynamicTool | null;
  
  // Actions
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSearchTerm: (term: string) => void;
  toggleFavorite: (toolId: string) => void;
  addRecentTool: (toolId: string) => void;
  openModal: () => void;
  closeModal: () => void;
  openChatSearch: () => void;
  closeChatSearch: () => void;
  setItemToRename: (item: { id: string; name: string; type: 'project' | 'chat' } | null) => void;
  setToolForActivation: (tool: DynamicTool | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
    theme: 'dark',
    isSidebarOpen: false,
    searchTerm: '',
    favoriteTools: [],
    recentTools: [],
    isModalOpen: false,
    isChatSearchOpen: false,
    itemToRename: null,
    toolForActivation: null,

    toggleTheme: () => set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light'
    })),
    
    toggleSidebar: () => set((state) => ({
      isSidebarOpen: !state.isSidebarOpen
    })),
    
    setSearchTerm: (term: string) => set({
      searchTerm: term
    }),
    
    toggleFavorite: (toolId: string) => set((state) => {
      const isFavorite = state.favoriteTools.includes(toolId);
      return {
        favoriteTools: isFavorite
          ? state.favoriteTools.filter(id => id !== toolId)
          : [...state.favoriteTools, toolId]
      };
    }),
    
    openModal: () => set({ isModalOpen: true }),
    closeModal: () => set({ isModalOpen: false }),
    openChatSearch: () => set({ isChatSearchOpen: true }),
    closeChatSearch: () => set({ isChatSearchOpen: false }),
    setItemToRename: (item) => set({ itemToRename: item }),
    setToolForActivation: (tool) => set({ toolForActivation: tool }),
    
    addRecentTool: (toolId: string) => set((state) => {
      const newRecents = [toolId, ...state.recentTools.filter(id => id !== toolId)];
      const limitedRecents = newRecents.slice(0, 10);
      return { recentTools: limitedRecents };
    })
  }),
  {
    name: 'ui-store'
  }
  )
);