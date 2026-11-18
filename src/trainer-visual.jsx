import React from 'react';

export function TrainerVisual() {
  return (
    <div className="project-visual trainer-visual" aria-hidden="true">
      <div className="trainer-panel">
        <div><b>Training run</b><span>Illustrative metrics</span></div>
        <div className="training-plot">
          {[19, 28, 25, 42, 46, 57, 54, 67, 71, 77, 80, 81].map((height, index) => (
            <i key={index} style={{ '--height': height + '%' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
