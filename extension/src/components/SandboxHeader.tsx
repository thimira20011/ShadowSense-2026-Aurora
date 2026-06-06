import React from 'react';
import { IconCrown } from '@tabler/icons-react';

export const SandboxHeader: React.FC = () => {
  return (
    <header className="sandbox-header">
      <div className="header-badge">
        <IconCrown size={12} /> Finalist Space: Top 10 Team
      </div>
      <h1>ShadowSense AI — Interface Sandbox & Prototype Guide</h1>
      <div className="subtitle">
        Official dynamic development workbench for <b>Member 2</b> (Frontend) &{' '}
        <b>Member 1</b> (AI/Backend). Use the simulator below to coordinate state responses.
      </div>
    </header>
  );
};
