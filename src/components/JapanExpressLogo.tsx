import React from 'react';

interface Props {
  size?: number;
  className?: string;
}

// Logo circular "Japan Express" — fundo rosa, anel duplo, flor de sakura e aviãozinho.
const JapanExpressLogo: React.FC<Props> = ({ size = 48, className = '' }) => {
  // Pétalas da sakura (5), distribuídas a cada 72° ao redor do centro.
  const petals = [0, 72, 144, 216, 288].map((deg) => (
    <ellipse
      key={deg}
      cx="0"
      cy="-8"
      rx="5"
      ry="8"
      fill="#F9A8D4"
      transform={`rotate(${deg})`}
    />
  ));

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Japan Express"
    >
      {/* Fundo circular rosa */}
      <circle cx="100" cy="100" r="98" fill="#EC4899" />
      {/* Anel duplo claro */}
      <circle cx="100" cy="100" r="88" fill="none" stroke="#FBCFE8" strokeWidth="5" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#FBCFE8" strokeWidth="2.5" />

      {/* Texto */}
      <text
        x="98"
        y="98"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="42"
        fontWeight="700"
        fill="#ffffff"
      >
        Japan
      </text>
      <text
        x="98"
        y="138"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="36"
        fontWeight="700"
        fill="#ffffff"
      >
        Express
      </text>

      {/* Flor de sakura (canto sup. direito do "Japan") */}
      <g transform="translate(150, 60)">
        {petals}
        <circle cx="0" cy="0" r="3.2" fill="#FBCFE8" />
      </g>

      {/* Trilha pontilhada do avião */}
      <path
        d="M 56 150 Q 100 168 138 150"
        fill="none"
        stroke="#FBCFE8"
        strokeWidth="2.5"
        strokeDasharray="2 5"
        strokeLinecap="round"
      />
      {/* Aviãozinho */}
      <g transform="translate(140, 142) rotate(-18)" fill="#ffffff">
        <path d="M 0 0 L 20 5 L 20 7 L 2 9 L -4 16 L -7 16 L -4 9 L -10 9 L -13 13 L -15 13 L -13 7 L -15 5 L -13 3 L -10 3 L -4 3 L -7 -4 L -4 -4 L 2 3 L 20 5 Z" />
      </g>
    </svg>
  );
};

export default JapanExpressLogo;
