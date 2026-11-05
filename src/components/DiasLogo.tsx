import React from 'react';

/**
 * Logo oficial DÍAS EAFIT (manual de marca, GT de Publicidad).
 *
 * Variantes:
 *  - "light": logo a color con EAFIT en negro, para fondos claros (crema/blanco).
 *  - "dark":  logo a color con EAFIT en blanco, para fondos negros.
 *  - "white": logo completo en blanco, para fondos de color de marca.
 *  - "mark":  solo las letras DÍAS a color (sin EAFIT), para espacios pequeños.
 *
 * Según el manual: no aplicar sombras, bordes, transparencias, inclinaciones
 * ni ponerlo dentro de una caja de color.
 */
export type DiasLogoVariant = 'light' | 'dark' | 'white' | 'mark';

const SOURCES: Record<DiasLogoVariant, string> = {
  light: '/brand/dias-logo.svg',
  dark: '/brand/dias-logo-on-dark.svg',
  white: '/brand/dias-logo-white.svg',
  mark: '/brand/dias-mark.svg',
};

interface DiasLogoProps {
  variant?: DiasLogoVariant;
  className?: string;
}

export const DiasLogo: React.FC<DiasLogoProps> = ({ variant = 'light', className = 'h-10 w-auto' }) => (
  <img src={SOURCES[variant]} className={className} alt="DÍAS EAFIT" draggable={false} />
);
