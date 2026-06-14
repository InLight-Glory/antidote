import React from 'react';

interface PlayerHUDProps {
  health: number;
  score: number;
  // Add more props as needed
}

const PlayerHUD: React.FC<PlayerHUDProps> = ({ health, score }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      padding: '12px 24px',
      borderRadius: '8px',
      fontSize: '1.2rem',
      zIndex: 1000
    }}>
      <div>Health: {health}</div>
      <div>Score: {score}</div>
    </div>
  );
};

export default PlayerHUD;
