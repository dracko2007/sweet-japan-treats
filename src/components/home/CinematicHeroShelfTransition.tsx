import React from 'react';
import CinematicHeroShelf from '@/components/home/CinematicHeroShelf';

/**
 * Variante de comparação: travelling da loja seguido pela vinheta Japan Express
 * em um crossfade de dois segundos. O hero original permanece como padrão.
 */
const CinematicHeroShelfTransition: React.FC = () => (
  <CinematicHeroShelf introVariant="transition" />
);

export default CinematicHeroShelfTransition;
