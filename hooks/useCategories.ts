import { useState, useEffect, useMemo } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import type { AdminCategory, CategoriesApiResponse } from '../types';

export const useCategories = () => {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = SupabaseApiService.getInstance();

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('useCategories: Starting to fetch categories');
      const response: CategoriesApiResponse = await api.getCategories();
      console.log('useCategories: API response received:', response);
      if (response.success && response.data) {
        setCategories(response.data.sort((a, b) => a.displayOrder - b.displayOrder));
        console.log('useCategories: Categories set successfully:', response.data.length);
      } else {
        console.log('useCategories: API response failed:', response.error);
        setError(response.error || 'Failed to fetch categories');
      }
    } catch (err) {
      console.log('useCategories: Exception caught:', err);
      // Don't set error for network issues when Supabase isn't configured
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('TypeError') ||
          errorMessage.includes('session is not stable')) {
        console.log('useCategories: Network error, Supabase likely not configured');
        setCategories([]);
      } else {
        setError('Network error occurred');
      }
    } finally {
      console.log('useCategories: Fetch completed, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const createCategory = async (categoryData: Omit<AdminCategory, 'id'>) => {
    const response = await api.createCategory(categoryData);
    if (response.success && response.data) {
      await fetchCategories(); // Refetch instead of optimistic update
      return response.data;
    } else {
      throw new Error(response.error || 'Failed to create category');
    }
  };

  const updateCategory = async (id: string, updates: Partial<AdminCategory>) => {
    const response = await api.updateCategory(id, updates);
    if (response.success && response.data) {
      await fetchCategories(); // Refetch instead of optimistic update
      return response.data;
    } else {
      throw new Error(response.error || 'Failed to update category');
    }
  };

  const deleteCategory = async (id: string) => {
    const response = await api.deleteCategory(id);
    if (response.success) {
      await fetchCategories(); // Refetch instead of optimistic update
    } else {
      throw new Error(response.error || 'Failed to delete category');
    }
  };

  const activeCategories = useMemo(() => 
    categories.filter(cat => cat.active), 
    [categories]
  );

  return {
    categories: activeCategories,
    allCategories: categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
};