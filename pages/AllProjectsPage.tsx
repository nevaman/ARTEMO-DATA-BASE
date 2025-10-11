import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useUIStore } from '../stores/uiStore';
import { AllProjectsView } from '../components/AllProjectsView';

export const AllProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, deleteProject, updateProject } = useProjects();
  const { openModal } = useUIStore();

  const handleViewProjectDetail = (project: any) => {
    navigate(`/projects/${project.id}`);
  };

  const handleNewProject = () => {
    openModal();
  };

  return (
    <AllProjectsView
      projects={projects}
      loading={loading}
      onNewProject={handleNewProject}
      onUpdateProject={updateProject}
      onDeleteProject={deleteProject}
      onViewProjectDetail={handleViewProjectDetail}
    />
  );
};