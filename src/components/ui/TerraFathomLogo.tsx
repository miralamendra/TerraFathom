import { motion } from 'framer-motion';

interface LogoProps {
  className?: string;
  size?: number;
  animateHover?: boolean;
}

export function TerraFathomLogo({ className = '', size = 18, animateHover = true }: LogoProps) {
  // 3 stacked GIS planes representing Fathom (depth layer deconstruction)
  const topLayerVariants = {
    rest: { y: 0 },
    hover: { y: -2.5 }
  };
  const midLayerVariants = {
    rest: { y: 0 },
    hover: { y: 0 }
  };
  const bottomLayerVariants = {
    rest: { y: 0 },
    hover: { y: 2.5 }
  };

  const transition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] };

  return (
    <motion.span 
      className={`inline-flex items-center justify-center ${className}`}
      initial="rest"
      whileHover={animateHover ? "hover" : "rest"}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Bottom Layer - Raster/Terrain */}
        <motion.path
          d="M 12 14.5 L 20 18.5 L 12 22.5 L 4 18.5 Z"
          fill="none"
          stroke="#555555"
          strokeWidth="1.2"
          variants={bottomLayerVariants}
          transition={transition}
        />
        <motion.path
          d="M 12 14.5 L 20 18.5 L 12 22.5 L 4 18.5 Z"
          fill="rgba(200, 164, 106, 0.05)"
          variants={bottomLayerVariants}
          transition={transition}
        />

        {/* Middle Layer - Vector Grids */}
        <motion.path
          d="M 12 8.5 L 20 12.5 L 12 16.5 L 4 12.5 Z"
          fill="none"
          stroke="#ECE8E1"
          strokeWidth="0.8"
          strokeDasharray="2 2"
          variants={midLayerVariants}
          transition={transition}
          opacity={0.35}
        />

        {/* Top Layer - Active Points */}
        <motion.path
          d="M 12 2.5 L 20 6.5 L 12 10.5 L 4 6.5 Z"
          fill="none"
          stroke="#C8A46A"
          strokeWidth="1.5"
          variants={topLayerVariants}
          transition={transition}
        />
        {/* Active focal node in center */}
        <motion.circle
          cx="12"
          cy="6.5"
          r="1"
          fill="#ECE8E1"
          variants={topLayerVariants}
          transition={transition}
        />
      </svg>
    </motion.span>
  );
}

export default TerraFathomLogo;
