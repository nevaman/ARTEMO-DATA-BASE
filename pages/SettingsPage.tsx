import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsView } from '../components/SettingsView';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <SettingsView onBack={() => navigate('/')} />
  );
};