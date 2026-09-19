import React from 'react';

interface DiasSpartanLogoProps {
  className?: string;
  size?: number | string;
}

export const DiasSpartanLogo: React.FC<DiasSpartanLogoProps> = ({
  className = 'w-10 h-10',
  size,
}) => {
  return (
    <img
      src="/dias-spartan-logo.png?v=spartan2"
      width={size}
      height={size}
      className={className}
      alt="DIAS EAFIT Logo"
      style={{ objectFit: 'contain' }}
    />
  );
};

