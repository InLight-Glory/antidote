import React from 'react';
import PlayerHUD from './PlayerHUD';

const Game = () => {
  const [health, setHealth] = React.useState(100);
  const [score, setScore] = React.useState(0);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ...existing game rendering code... */}
      <PlayerHUD health={health} score={score} />
    </div>
  );
};

export default Game;