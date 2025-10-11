import React, { useState } from 'react';
import { useTools } from '../hooks/useTools';
import { useCategories } from '../hooks/useCategories';
import { useConfirmationDialog } from '../hooks/useConfirmationDialog';
import { useNotifications } from '../contexts/NotificationContext';
import type { AdminCategory, AdminToolQuestion, DynamicTool } from '../types';
import { PlusIcon, EditIcon, TrashIcon, BoxIcon, StarIcon, SearchIcon } from './Icons';
import { useAuthStore } from '../stores/authStore';
import { StorageService } from '../services/storageService';
import { MarkdownEditor } from './MarkdownEditor';

const TruncatedDescription: React.FC<{ description: string; maxLength?: number }> = ({ 
  description, 
  maxLength = 100 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (description.length <= maxLength) {
    return <span>{description}</span>;
  }

  return (
    <div>
      <span>
        {isExpanded ? description : `${description.substring(0, maxLength)}...`}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="ml-2 text-xs text-primary-accent hover:underline"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
};

export const AdminTools: React.FC = () => {
  const confirmDialog = useConfirmationDialog();
  const notifications = useNotifications();
  const { allTools, createTool, updateTool, deleteTool, loading } = useTools();
  const { allCategories } = useCategories();

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<DynamicTool | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [knowledgeBaseFile, setKnowledgeBaseFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'title' | 'category' | 'primaryModel' | 'active'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    active: true,
    featured: false,
    primaryModel: 'Claude',
    fallbackModels: [] as string[],
    promptInstructions: '',
    questions: [] as AdminToolQuestion[],
  });

  const models = ['Claude', 'OpenAI', 'Grok', 'Gemini'];

  const handleCreate = () => {
    setEditingTool(null);
    setFormData({
      title: '',
      description: '',
      category: allCategories[0]?.name || '',
      active: true,
      featured: false,
      primaryModel: 'Claude',
      fallbackModels: ['OpenAI'],
      promptInstructions: '',
      questions: [],
    });
    setCurrentStep(1);
    setModalOpen(true);
  };

  const handleEdit = (tool: DynamicTool) => {
    setEditingTool(tool);
    setFormData({
      title: tool.title,
      description: tool.description,
      category: tool.category,
      active: tool.active,
      featured: tool.featured,
      primaryModel: tool.primaryModel,
      fallbackModels: tool.fallbackModels,
      promptInstructions: tool.promptInstructions,
      questions: tool.questions,
    });
    setCurrentStep(1);
    setModalOpen(true);
  };

  const addQuestion = () => {
    const newQuestion: AdminToolQuestion = {
      id: Date.now().toString(),
      label: '',
      type: 'input',
      required: true,
      order: formData.questions.length + 1,
    };
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
  };

  const updateQuestion = (id: string, updates: Partial<AdminToolQuestion>) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === id ? { ...q, ...updates } : q),
    }));
  };

  const removeQuestion = (id: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions
        .filter(q => q.id !== id)
        .map((q, index) => ({ ...q, order: index + 1 })),
    }));
  };

  // Text sanitization utility
  const sanitizeText = (text: string): string => {
    return text
      // Remove problematic Unicode characters
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
      .replace(/[\u2000-\u206F]/g, ' ') // General punctuation and spaces
      .replace(/[\u2070-\u209F]/g, '') // Superscripts and subscripts
      .replace(/[\u20A0-\u20CF]/g, '') // Currency symbols
      .replace(/[\u2100-\u214F]/g, '') // Letterlike symbols
      .replace(/[\u2190-\u21FF]/g, '') // Arrows
      .replace(/[\u2200-\u22FF]/g, '') // Mathematical operators
      .replace(/[\u2300-\u23FF]/g, '') // Miscellaneous technical
      .replace(/[\u2400-\u243F]/g, '') // Control pictures
      .replace(/[\u2440-\u245F]/g, '') // Optical character recognition
      .replace(/[\u2460-\u24FF]/g, '') // Enclosed alphanumerics
      .replace(/[\u25A0-\u25FF]/g, '') // Geometric shapes
      .replace(/[\u2600-\u26FF]/g, '') // Miscellaneous symbols
      .replace(/[\u2700-\u27BF]/g, '') // Dingbats
      .replace(/[\uE000-\uF8FF]/g, '') // Private use area
      .replace(/[\uFB00-\uFB4F]/g, '') // Alphabetic presentation forms
      .replace(/[\uFE00-\uFE0F]/g, '') // Variation selectors
      .replace(/[\uFE20-\uFE2F]/g, '') // Combining half marks
      .replace(/[\uFE30-\uFE4F]/g, '') // CJK compatibility forms
      .replace(/[\uFE50-\uFE6F]/g, '') // Small form variants
      .replace(/[\uFF00-\uFFEF]/g, '') // Halfwidth and fullwidth forms
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Upload knowledge base file to Supabase Storage
  const uploadKnowledgeBaseFile = async (file: File): Promise<string | null> => {
    if (!file) return null;
    
    setIsUploadingFile(true);
    try {
      const { user } = useAuthStore.getState();
      if (!user) throw new Error('User not authenticated');
      
      const storageService = StorageService.getInstance();
      const response = await storageService.uploadKnowledgeBaseFile(file, user.id);
      
      if (response.success && response.data) {
        console.log('Knowledge base file uploaded successfully:', response.data.fileId);

        // --- ADD THIS LINE to confirm the CONTENT was READ ---
        console.log('✅ Extracted text content:', response.data.processedContent);
        
        return response.data.fileId;
      } else {
        throw new Error(response.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Failed to upload knowledge base file:', error);
      setSaveError('Failed to upload knowledge base file. Please try again.');
      return null;
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSave = async () => {
    // Enhanced validation
    const sanitizedTitle = sanitizeText(formData.title);
    if (!sanitizedTitle) {
      setSaveError('Tool title is required');
      return;
    }
    
    const sanitizedDescription = sanitizeText(formData.description);
    if (!sanitizedDescription) {
      setSaveError('Tool description is required');
      return;
    }
    
    const sanitizedPromptInstructions = sanitizeText(formData.promptInstructions);
    if (!sanitizedPromptInstructions) {
      setSaveError('Prompt instructions are required');
      return;
    }
    
    if (!formData.category) {
      setSaveError('Please select a category');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Upload knowledge base file if present and get its ID
      let knowledgeBaseFileId: string | null = null;
      if (knowledgeBaseFile) {
        knowledgeBaseFileId = await uploadKnowledgeBaseFile(knowledgeBaseFile);
        if (!knowledgeBaseFileId) {
          // Error already set by uploadKnowledgeBaseFile, so just return
          return;
        }
      }

      // Log the attempt with data sizes for debugging
      console.log('AdminTools: Attempting to save tool with data sizes:', {
        titleLength: sanitizedTitle.length,
        descriptionLength: sanitizedDescription.length,
        promptLength: sanitizedPromptInstructions.length,
        questionCount: formData.questions.length,
        hasKnowledgeBase: !!knowledgeBaseFileId,
      });
      
      // Sanitize all question text fields
      const sanitizedQuestions = formData.questions.map(q => ({
        ...q,
        label: sanitizeText(q.label),
        placeholder: q.placeholder ? sanitizeText(q.placeholder) : q.placeholder,
        options: q.options?.map(opt => sanitizeText(opt)),
      }));
      
      const toolData: Omit<DynamicTool, 'id'> = {
        title: sanitizedTitle,
        description: sanitizedDescription,
        category: formData.category,
        active: formData.active,
        featured: formData.featured,
        primaryModel: formData.primaryModel,
        fallbackModels: formData.fallbackModels,
        promptInstructions: formData.promptInstructions,
        questions: sanitizedQuestions,
        knowledgeBaseFileId, // Include the file ID in tool data
      };

      // Set a timeout to prevent infinite loading
      const savePromise = editingTool 
        ? updateTool(editingTool.id, toolData)
        : createTool(toolData);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save operation timed out after 120 seconds')), 120000)
      );
      
      await Promise.race([savePromise, timeoutPromise]);
      
      console.log('AdminTools: Tool saved successfully');
      setModalOpen(false);
      setKnowledgeBaseFile(null);
      notifications.success(
        `Tool "${sanitizedTitle}" ${editingTool ? 'updated' : 'created'} successfully`,
        editingTool ? 'Tool Updated' : 'Tool Created'
      );
    } catch (error) {
      console.error('Failed to save tool:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          setSaveError('Save operation timed out. This may be due to large content size. Please try with shorter content or contact support.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          setSaveError('Network error. Please check your connection and try again.');
        } else {
          setSaveError(error.message);
        }
      } else {
        setSaveError('Failed to save tool. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const tool = allTools.find(t => t.id === id);
    if (!tool) return;

    const confirmed = await confirmDialog.confirmDelete(tool.title, 'tool');
    if (!confirmed) return;

    try {
      await deleteTool(id);
      notifications.success(`Tool "${tool.title}" deleted successfully`, 'Tool Deleted');
    } catch (error) {
      console.error('Failed to delete tool:', error);
      notifications.error('Failed to delete tool. Please try again.');
    }
  };

  const handleSort = (field: 'title' | 'category' | 'primaryModel' | 'active') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon: React.FC<{ field: 'title' | 'category' | 'primaryModel' | 'active' }> = ({ field }) => (
    <svg
      className={`w-3 h-3 inline ml-1 transition-colors ${
        sortField === field ? 'text-red-500' : 'text-light-text-tertiary dark:text-dark-text-tertiary'
      }`}
      fill="currentColor"
      viewBox="0 0 16 16"
      style={{ transform: sortField === field && sortDirection === 'desc' ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M8 3l4 5H4z"/>
    </svg>
  );

  const filteredTools = allTools
    .filter(tool => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        tool.title.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.category.toLowerCase().includes(query) ||
        tool.primaryModel.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let compareValue = 0;
      if (sortField === 'title') {
        compareValue = a.title.localeCompare(b.title);
      } else if (sortField === 'category') {
        compareValue = a.category.localeCompare(b.category);
      } else if (sortField === 'primaryModel') {
        compareValue = a.primaryModel.localeCompare(b.primaryModel);
      } else if (sortField === 'active') {
        compareValue = a.active === b.active ? 0 : a.active ? -1 : 1;
      }
      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-accent mx-auto mb-4"></div>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">Loading tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-light-text-primary dark:text-dark-text-primary mb-2">
            Tools
          </h1>
          <p className="text-light-text-secondary dark:text-dark-text-secondary">
            Manage AI tools and their configurations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <SearchIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-light-text-tertiary dark:text-dark-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools..."
              className="pl-10 pr-4 py-2 w-64 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary placeholder-light-text-tertiary dark:placeholder-dark-text-tertiary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={allCategories.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            title={allCategories.length === 0 ? 'Create categories first' : 'Add new tool'}
          >
            <PlusIcon className="w-4 h-4" />
            Add Tool
          </button>
        </div>
      </div>

      {allCategories.length === 0 ? (
        <div className="text-center py-20 bg-light-bg-sidebar dark:bg-dark-bg-component rounded-lg border border-light-border dark:border-dark-border">
          <BoxIcon className="w-12 h-12 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-light-text-primary dark:text-dark-text-primary">No categories available</h3>
          <p className="text-light-text-tertiary dark:text-dark-text-tertiary mt-1">
            Create categories first before adding tools.
          </p>
        </div>
      ) : (
        <div className="bg-light-bg-component dark:bg-dark-bg-component border border-light-border dark:border-dark-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-light-bg-sidebar dark:bg-dark-bg-sidebar">
                <tr>
                  <th
                    className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                    onClick={() => handleSort('title')}
                  >
                    Tool
                    <SortIcon field="title" />
                  </th>
                  <th
                    className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                    onClick={() => handleSort('category')}
                  >
                    Category
                    <SortIcon field="category" />
                  </th>
                  <th
                    className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                    onClick={() => handleSort('primaryModel')}
                  >
                    Model
                    <SortIcon field="primaryModel" />
                  </th>
                  <th
                    className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary cursor-pointer hover:bg-light-bg-page dark:hover:bg-dark-bg-component"
                    onClick={() => handleSort('active')}
                  >
                    Status
                    <SortIcon field="active" />
                  </th>
                  <th className="text-left p-4 font-medium text-light-text-primary dark:text-dark-text-primary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTools.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-light-text-tertiary dark:text-dark-text-tertiary">
                      {searchQuery.trim() ? (
                        <>
                          No tools found matching <span className="font-medium text-light-text-primary dark:text-dark-text-primary">"{searchQuery}"</span>
                        </>
                      ) : (
                        'No tools created yet. Click "Add Tool" to create your first tool.'
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTools.map((tool) => (
                    <tr key={tool.id} className="border-t border-light-border dark:border-dark-border">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <BoxIcon className="w-5 h-5 text-primary-accent" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                {tool.title}
                              </span>
                              {tool.featured && <StarIcon className="w-4 h-4 text-yellow-500" isFilled />}
                            </div>
                            <div className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                              <TruncatedDescription description={tool.description} maxLength={80} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-light-text-secondary dark:text-dark-text-secondary">
                          {tool.category}
                        </span>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="text-light-text-primary dark:text-dark-text-primary font-medium">
                            {tool.primaryModel}
                          </span>
                          {tool.fallbackModels.length > 0 && (
                            <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary">
                              Fallback: {tool.fallbackModels.join(', ')}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            tool.active 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {tool.active ? 'Active' : 'Inactive'}
                          </span>
                          {!tool.active && (
                            <button
                              onClick={() => updateTool(tool.id, { active: true })}
                              className="px-2 py-1 text-xs rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                              title="Reactivate tool"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(tool)}
                            className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-primary-accent hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md"
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tool.id)}
                            className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-red-500 hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Multi-step Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`bg-light-bg-component dark:bg-dark-bg-component rounded-lg shadow-lg transition-all duration-300 ${
            isMaximized 
              ? 'w-[98vw] h-[98vh] max-w-none max-h-none' 
              : 'w-full max-w-2xl max-h-[90vh]'
          } flex flex-col overflow-hidden`}>
            <div className="p-6 border-b border-light-border dark:border-dark-border">
              <div className="flex justify-between items-center">
                <h3 className="font-serif text-xl font-bold text-light-text-primary dark:text-dark-text-primary">
                  {editingTool ? 'Edit Tool' : 'Create Tool'} - Step {currentStep} of 3
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMaximized(!isMaximized)}
                    className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
                    title={isMaximized ? 'Minimize' : 'Maximize'}
                  >
                    {isMaximized ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setIsMaximized(false);
                    }}
                    className="p-2 text-light-text-tertiary dark:text-dark-text-tertiary hover:text-light-text-primary dark:hover:text-dark-text-primary hover:bg-light-bg-sidebar dark:hover:bg-dark-bg-page rounded-md transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div className={`p-6 flex-1 overflow-y-auto ${isMaximized ? 'min-h-0 flex-grow' : ''}`}>
              {saveError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">{saveError}</p>
                </div>
              )}
              
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: sanitizeText(e.target.value) }))}
                      className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                      placeholder="Tool name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: sanitizeText(e.target.value) }))}
                      rows={3}
                      className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                      placeholder="Describe what this tool does"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Category
                    </label>
                    {allCategories.length === 0 ? (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          No categories available. Create categories first.
                        </p>
                      </div>
                    ) : (
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                      >
                        {allCategories.map(category => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.active}
                        onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                        className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">Active</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.featured}
                        onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
                        className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">Featured</span>
                    </label>
                  </div>
                  <div className="pt-4 border-t border-light-border dark:border-dark-border">
                    <button
                      type="button"
                      onClick={() => {
                        // Sanitize basic text fields but preserve markdown in prompt instructions
                        setFormData(prev => ({
                          ...prev,
                          title: sanitizeText(prev.title),
                          description: sanitizeText(prev.description),
                          // Don't sanitize promptInstructions - preserve markdown formatting
                        }));
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                      title="Remove formatting from title and description"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Clean Text Fields
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Primary Model
                    </label>
                    <select
                      value={formData.primaryModel}
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryModel: e.target.value }))}
                      className="w-full p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none"
                    >
                      {models.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Fallback Models
                    </label>
                    <div className="space-y-2">
                      {models.filter(m => m !== formData.primaryModel).map(model => (
                        <label key={model} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.fallbackModels.includes(model)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, fallbackModels: [...prev.fallbackModels, model] }));
                              } else {
                                setFormData(prev => ({ ...prev, fallbackModels: prev.fallbackModels.filter(m => m !== model) }));
                              }
                            }}
                            className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                          />
                          <span className="text-sm text-light-text-primary dark:text-dark-text-primary">{model}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Prompt Instructions
                    </label>
                    <div className="border border-light-border dark:border-dark-border rounded-md">
                      <MarkdownEditor
                        value={formData.promptInstructions}
                        onChange={(value) => setFormData(prev => ({ ...prev, promptInstructions: value }))}
                        rows={isMaximized ? 25 : 8}
                        placeholder="You are an expert copywriter..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-light-text-primary dark:text-dark-text-primary mb-2">
                      Knowledge Base File (Optional)
                    </label>
                    <div className="border-2 border-dashed border-light-border dark:border-dark-border rounded-md p-4">
                      {knowledgeBaseFile ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <svg className="w-6 h-6 text-primary-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div>
                              <p className="font-medium text-light-text-primary dark:text-dark-text-primary">
                                {knowledgeBaseFile.name}
                              </p>
                              <p className="text-sm text-light-text-tertiary dark:text-dark-text-tertiary">
                                {(knowledgeBaseFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setKnowledgeBaseFile(null)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <svg className="w-8 h-8 text-light-text-tertiary dark:text-dark-text-tertiary mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-2">
                            Upload a knowledge base file to provide context for this tool
                          </p>
                          <input
                            type="file"
                            accept=".pdf,.docx,.doc,.txt,.md"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setKnowledgeBaseFile(e.target.files[0]);
                              }
                            }}
                            className="hidden"
                            id="knowledge-base-upload"
                          />
                          <label
                            htmlFor="knowledge-base-upload"
                            className="inline-flex items-center px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity cursor-pointer"
                          >
                            Choose File
                          </label>
                          <p className="text-xs text-light-text-tertiary dark:text-dark-text-tertiary mt-2">
                            Supports PDF, DOCX, TXT, and MD files (max 10MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-light-border dark:border-dark-border">
                    <button
                      type="button"
                      onClick={() => {
                        // Sanitize text fields except prompt instructions (keep markdown)
                        setFormData(prev => ({
                          ...prev,
                          title: sanitizeText(prev.title),
                          description: sanitizeText(prev.description),
                        }));
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                      title="Remove formatting from title and description (preserves markdown in prompt instructions)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Clean Text Fields
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-light-text-primary dark:text-dark-text-primary">Questions</h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          // Sanitize question text fields but preserve markdown in prompt instructions
                          setFormData(prev => ({
                            ...prev,
                            questions: prev.questions.map(q => ({
                              ...q,
                              label: sanitizeText(q.label),
                              placeholder: q.placeholder ? sanitizeText(q.placeholder) : q.placeholder,
                              options: q.options?.map(opt => sanitizeText(opt)),
                            })),
                          }));
                        }}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                        title="Remove formatting from question text fields"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Clean Questions
                      </button>
                      <button
                        onClick={addQuestion}
                        className="flex items-center gap-2 px-3 py-1 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity text-sm"
                      >
                        <PlusIcon className="w-4 h-4" />
                        Add Question
                      </button>
                    </div>
                  </div>
                  <div className={`space-y-3 ${isMaximized ? 'max-h-[calc(98vh-300px)]' : 'max-h-96'} overflow-y-auto`}>
                    {formData.questions.length === 0 ? (
                      <div className="text-center py-8 text-light-text-tertiary dark:text-dark-text-tertiary">
                        <p>No questions added yet. Click "Add Question" to create the conversation flow.</p>
                      </div>
                    ) : (
                      formData.questions.map((question, index) => (
                        <div key={question.id} className="border border-light-border dark:border-dark-border rounded-md p-4">
                          <div className="flex justify-between items-start mb-3">
                            <span className="text-sm font-medium text-light-text-primary dark:text-dark-text-primary">
                              Question {index + 1}
                            </span>
                            <button
                              onClick={() => removeQuestion(question.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-3">
                            <textarea
                              value={question.label}
                              onChange={(e) => updateQuestion(question.id, { label: sanitizeText(e.target.value) })}
                              placeholder="Question text"
                              className="w-full p-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none text-sm resize-none overflow-hidden min-h-[40px]"
                              rows={1}
                              style={{ height: 'auto' }}
                              onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                              }}
                            />
                            <div className="flex gap-4">
                              <select
                                value={question.type}
                                onChange={(e) => updateQuestion(question.id, { type: e.target.value as 'input' | 'textarea' | 'select' })}
                                className="p-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none text-sm"
                              >
                                <option value="input">Input</option>
                                <option value="textarea">Textarea</option>
                                <option value="select">Select</option>
                              </select>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={question.required}
                                  onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                                  className="h-4 w-4 text-primary-accent focus:ring-primary-accent border-gray-300 rounded"
                                />
                                <span className="text-sm text-light-text-primary dark:text-dark-text-primary">Required</span>
                              </label>
                            </div>
                            {question.type === 'select' && (
                              <div>
                                <label className="block text-xs font-medium text-light-text-primary dark:text-dark-text-primary mb-1">
                                  Options (one per line)
                                </label>
                                <textarea
                                  value={question.options?.join('\n') || ''}
                                  onChange={(e) => updateQuestion(question.id, { 
                                    options: e.target.value.split('\n').map(opt => sanitizeText(opt)).filter(opt => opt.trim()) 
                                  })}
                                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                                  className="w-full p-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg-component dark:bg-dark-bg-component text-light-text-primary dark:text-dark-text-primary focus:ring-2 focus:ring-primary-accent focus:border-primary-accent outline-none text-sm"
                                  rows={3}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-light-border dark:border-dark-border flex justify-between flex-shrink-0">
              <div>
                {currentStep > 1 && (
                  <button
                    onClick={() => setCurrentStep(prev => prev - 1)}
                    className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                  >
                    Previous
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text-primary dark:hover:text-dark-text-primary"
                >
                  Cancel
                </button>
                {currentStep < 3 ? (
                  <button
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    disabled={currentStep === 1 && allCategories.length === 0}
                    className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary-accent text-text-on-accent rounded-md hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-on-accent"></div>
                    )}
                    {isSaving ? 'Saving...' : (editingTool ? 'Update' : 'Create')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};