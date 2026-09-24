import React from 'react';
import './StatsCard.css';

const StatsCard = ({ title, value, icon: Icon, color = 'primary' }) => {
  const colorClasses = {
    primary: {
      bg: 'bg-primary-100',
      text: 'text-primary-600',
      hover: 'hover:bg-primary-50'
    },
    green: {
      bg: 'bg-green-100',
      text: 'text-green-600',
      hover: 'hover:bg-green-50'
    },
    purple: {
      bg: 'bg-rose-100',
      text: 'text-rose-600',
      hover: 'hover:bg-rose-50'
    },
    red: {
      bg: 'bg-red-100',
      text: 'text-red-600',
      hover: 'hover:bg-red-50'
    }
  };

  const colors = colorClasses[color] || colorClasses.primary;

  return (
    <div className={`stats-card stats-card-${color}`}>
      <div className="stats-card-content">
        <div className="stats-card-info">
          <p className="stats-card-title">{title}</p>
          <p className="stats-card-value">{value}</p>
        </div>
        <div className="stats-card-icon-wrapper">
          <Icon className={`stats-card-icon stats-card-${color}-icon`} size={24} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
