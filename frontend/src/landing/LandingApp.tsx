import React from 'react';
import { Outlet } from 'react-router-dom';

const LandingApp: React.FC = () => {
  return (
    <div style={{ margin: 0, padding: 0 }}>
      <Outlet />
    </div>
  );
};

export default LandingApp;
