import { useState, useEffect, useRef } from 'react';
import { Globe, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TerraFathomLogo } from '../ui/TerraFathomLogo';
import { Dither } from '../ui/Dither';

const imageSlides = ['Geo1.png', 'Geo2.png', 'Geo3.png'];
const SLIDE_INTERVAL_MS = 5200;
const SLIDE_FADE_MS = 1100;

interface LandingPageProps {
  onEnter: () => void;
}

export function LandingPage({ onEnter }: LandingPageProps) {
  const baseImagePath = `${import.meta.env.BASE_URL}Images/`;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const images = imageSlides.map((slide) => {
      const img = new Image();
      img.src = `${baseImagePath}${slide}`;
      img.decoding = 'async';
      return img;
    });

    const preloadImages = images.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    );

    void Promise.all(preloadImages);
  }, [baseImagePath]);

  useEffect(() => {
    let cancelled = false;

    const advance = () => {
      if (cancelled) return;
      setIsTransitioning(true);
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
      transitionTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        setCurrentIndex((prev) => (prev + 1) % imageSlides.length);
        setIsTransitioning(false);
      }, SLIDE_FADE_MS);
    };

    const timer = window.setInterval(advance, SLIDE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  const currentImage = `${baseImagePath}${imageSlides[currentIndex]}`;
  const nextIndex = (currentIndex + 1) % imageSlides.length;
  const nextImage = `${baseImagePath}${imageSlides[nextIndex]}`;

  const viewportLabel =
    imageSlides[currentIndex] === 'Geo1.png'
      ? 'TERRAFATHOM_VIEWPORT_01 // SURFACE_MAP'
      : imageSlides[currentIndex] === 'Geo2.png'
        ? 'TERRAFATHOM_VIEWPORT_02 // HEATMAP_ANALYSIS'
        : 'TERRAFATHOM_VIEWPORT_03 // GEOMETRY_SCAN';
  
  const fadeUpProps = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] as const }
  };

  const capabilities = [
    { title: 'Interactive Mapping', desc: 'Render spatial telemetry overlays dynamically in the browser viewport.' },
    { title: 'Spatial Analytics', desc: 'Query spatial adjacencies and calculate precise coordinate boundaries.' },
    { title: 'Layer Management', desc: 'Deconstruct and filter dense multidimensional geospatial features.' },
    { title: 'High-performance Rendering', desc: 'Project millions of active coordinate nodes with GPU speed.' },
    { title: 'Data Visualization', desc: 'Map telemetry data points without aesthetic noise.' },
    { title: 'Professional Workflows', desc: 'Analyze urban systems with a meticulously engineered GIS toolset.' },
  ];

  const gridStyle = {
    backgroundImage: `
      linear-gradient(to right, rgba(43, 43, 43, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(43, 43, 43, 0.05) 1px, transparent 1px)
    `,
    backgroundSize: '80px 80px',
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#9E9A94] font-sans select-none overflow-x-hidden flex flex-col justify-between selection:bg-[#C8A46A]/20 selection:text-[#ECE8E1] relative" style={gridStyle}>
      
      {/* Background Interactive Dither Wave */}
      <div className="absolute inset-0 z-0 opacity-[0.1] pointer-events-none overflow-hidden">
        <Dither
          waveColor={[0.78, 0.64, 0.42]}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0.35}
          colorNum={3}
          waveAmplitude={0.16}
          waveFrequency={1.7}
          waveSpeed={0.02}
          pixelSize={4}
        />
      </div>

      {/* Sticky Header Navigation */}
      <nav className="sticky top-0 w-full bg-[#111111]/80 backdrop-blur-md border-b border-[#2B2B2B]/20 z-50 transition-all duration-300">
        <div className="w-full max-w-[1280px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={onEnter}>
            <TerraFathomLogo size={20} />
            <span className="font-sans text-[14px] md:text-[15px] font-semibold text-[#ECE8E1] normal-case">
              TerraFathom
            </span>
          </div>
          <button 
            onClick={onEnter} 
            className="text-[14px] md:text-[15px] font-medium text-[#ECE8E1] hover:text-[#C8A46A] transition-colors duration-200 cursor-pointer"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Main Content Container */}
      <div className="w-full max-w-[1280px] mx-auto px-8 flex-1 flex flex-col relative z-10">
        <main className="flex-1 flex flex-col">
          
          {/* ==================================================== */}
          {/* HERO SECTION */}
          {/* ==================================================== */}
          <section className="py-20 md:py-28 flex flex-col items-center text-center gap-10">
            
            <motion.div 
              {...fadeUpProps}
              className="flex flex-col items-center text-center gap-6 max-w-[850px]"
            >
              <span className="text-[13px] md:text-[14px] font-sans font-bold text-[#C8A46A] normal-case">
                TerraFathom Workspace
              </span>

              <h1 className="text-[44px] md:text-[72px] lg:text-[80px] font-bold text-[#ECE8E1] tracking-tight leading-[1.05] font-sans">
                Understand space. Reveal patterns.
              </h1>

              <p className="text-[18px] md:text-[21px] font-normal leading-relaxed text-[#9E9A94] max-w-[680px] mx-auto">
                An elegant, fast GIS workspace designed for telemetry observation, coordinate analysis, and structural urban&nbsp;understanding.
              </p>
            </motion.div>

            <motion.div 
              {...fadeUpProps}
              transition={{ ...fadeUpProps.transition, delay: 0.01 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 z-10 w-full"
            >
              <button
                onClick={onEnter}
                className="h-11 px-6 bg-[#ECE8E1] text-[#111111] hover:bg-[#ECE8E1]/90 font-medium text-[15px] md:text-[16px] rounded-control flex items-center justify-center transition-all duration-200 cursor-pointer shadow-tight active:scale-[0.98] w-full sm:w-auto"
              >
                Launch TerraFathom
              </button>
              <button
                onClick={onEnter}
                className="h-11 px-6 border border-[#2B2B2B] text-[#ECE8E1] hover:border-[#ECE8E1]/20 hover:bg-[#171717] font-medium text-[15px] md:text-[16px] rounded-control flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.98] w-full sm:w-auto"
              >
                Documentation
              </button>
            </motion.div>

            {/* Suspended Instrument Plate (Large Format Slideshow) */}
            <motion.div 
              initial={{ opacity: 0, y: 8, scale: 0.998 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ opacity: { duration: 0.16, ease: [0.22, 1, 0.36, 1], delay: 0.02 }, scale: { duration: 0.16, ease: [0.22, 1, 0.36, 1], delay: 0.02 } }}
              className="w-fit max-w-[1000px] mx-auto mt-10 md:mt-16 bg-[#171717] border border-[#2B2B2B] rounded-lg p-2.5 shadow-[0_32px_64px_rgba(0,0,0,0.85)] relative group cursor-pointer hover:border-[#C8A46A]/60 transition-colors duration-500 overflow-hidden"
              onClick={onEnter}
            >
              {/* Top Window Header */}
              <div className="flex items-center justify-between px-3 pb-2.5 border-b border-[#2B2B2B]/40">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2B2B2B] group-hover:bg-[#C8A46A]/50 transition-colors duration-300" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2B2B2B]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2B2B2B]" />
                </div>
                <span className="font-mono text-[8px] tracking-[0.2em] text-[#9E9A94]/40 uppercase select-none">
                  {viewportLabel}
                </span>
                <div className="flex items-center gap-1">
                  {imageSlides.map((image, i) => (
                    <div
                      key={image}
                      className={`w-1 h-1 rounded-full transition-all duration-300 ${currentIndex === i ? 'bg-[#C8A46A]' : 'bg-[#2B2B2B]'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Viewport Frame with Specular Glass Glare and seamless crossfade */}
              <div
                className="relative rounded overflow-hidden bg-[#111111] flex items-center justify-center w-full max-w-[1080px] mx-auto"
                style={{ aspectRatio: '1917 / 912' }}
              >
                <motion.img
                  key={`current-${currentIndex}`}
                  src={currentImage}
                  alt="TerraFathom Workspace Viewport"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  initial={false}
                  animate={{ opacity: isTransitioning ? 0 : 1, scale: isTransitioning ? 1.012 : 1 }}
                  transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-0 w-full h-full object-cover select-none will-change-[opacity,transform]"
                />
                <motion.img
                  key={`next-${currentIndex}`}
                  src={nextImage}
                  alt="TerraFathom Workspace Viewport"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  initial={false}
                  animate={{ opacity: isTransitioning ? 1 : 0, scale: isTransitioning ? 1 : 1.012 }}
                  transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute inset-0 w-full h-full object-cover select-none will-change-[opacity,transform]"
                />
                
                {/* Apple Specular Diagonal Reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none mix-blend-overlay z-10" />
                
                {/* Vignette Overlay for Depth */}
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)] pointer-events-none z-10" />
              </div>
              
              {/* Target Crosshairs in Corners */}
              <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 border-l border-t border-[#2B2B2B]/50 pointer-events-none group-hover:border-[#C8A46A]/40 transition-colors duration-300" />
              <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 border-r border-t border-[#2B2B2B]/50 pointer-events-none group-hover:border-[#C8A46A]/40 transition-colors duration-300" />
              <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 border-l border-b border-[#2B2B2B]/50 pointer-events-none group-hover:border-[#C8A46A]/40 transition-colors duration-300" />
              <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 border-r border-b border-[#2B2B2B]/50 pointer-events-none group-hover:border-[#C8A46A]/40 transition-colors duration-300" />
            </motion.div>

          </section>

          {/* ==================================================== */}
          {/* PRODUCT OVERVIEW SECTION */}
          {/* ==================================================== */}
          <section className="py-24 md:py-32 flex flex-col items-center justify-center text-center gap-6 border-t border-[#2B2B2B]/40 max-w-[850px] mx-auto">
            <span className="text-[13px] md:text-[14px] font-sans font-semibold tracking-[0.12em] text-[#C8A46A] uppercase block">
              Overview
            </span>
            <p className="text-[18px] md:text-[21px] leading-relaxed text-[#ECE8E1] font-normal tracking-tight">
              TerraFathom deconstructs dense multidimensional datasets into highly responsive analytical layers. Map viewports, topological indices, and attribute filters operate in perfect sync inside a single, zero-friction workspace.
            </p>
          </section>

          {/* ==================================================== */}
          {/* CAPABILITIES SECTION */}
          {/* ==================================================== */}
          <section className="py-24 md:py-32 flex flex-col items-center gap-16 border-t border-[#2B2B2B]/40">
            
            <div className="text-center">
              <h2 className="text-[32px] md:text-[44px] lg:text-[48px] font-semibold tracking-tight text-[#ECE8E1] leading-tight">
                Designed for Exploration
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
              {capabilities.map((item, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.25, ease: "easeInOut", delay: idx * 0.05 }}
                  className="flex flex-col items-center text-center gap-3 group/cap px-4 transition-all duration-300"
                >
                  <span className="text-[14px] md:text-[15px] font-sans font-semibold tracking-wide text-[#C8A46A] uppercase">
                    {item.title}
                  </span>
                  <p className="text-[16px] md:text-[18px] leading-relaxed text-[#9E9A94] group-hover/cap:text-[#ECE8E1] transition-colors duration-300">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>

          </section>

          {/* ==================================================== */}
          {/* FINAL CALL TO ACTION SECTION */}
          {/* ==================================================== */}
          <section className="py-24 md:py-32 flex flex-col items-center justify-center text-center gap-8 border-t border-[#2B2B2B]/40">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex flex-col items-center gap-4"
            >
              <h2 className="text-[32px] md:text-[44px] lg:text-[48px] font-semibold tracking-tight text-[#ECE8E1] leading-tight font-sans">
                Built for Precision
              </h2>
              <p className="text-[18px] md:text-[21px] font-normal text-[#9E9A94] max-w-[500px]">
                The instrument is ready.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.2, ease: "easeInOut", delay: 0.05 }}
              className="flex items-center gap-2 group/btn"
            >
              <button
                onClick={onEnter}
                className="h-11 px-8 bg-[#171717] border border-[#2B2B2B] hover:border-[#C8A46A] hover:text-[#ECE8E1] text-[#ECE8E1] font-medium text-[15px] md:text-[16px] rounded-control transition-all duration-200 cursor-pointer shadow-tight active:scale-[0.98] flex items-center gap-2"
              >
                Launch TerraFathom <ArrowUpRight size={15} className="text-[#C8A46A] group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-300" />
              </button>
            </motion.div>
          </section>

        </main>
      </div>

      {/* ==================================================== */}
      {/* FOOTER */}
      {/* ==================================================== */}
      <footer className="w-full py-10 px-8 text-center text-[10px] md:text-[11px] font-sans tracking-wide text-[#9E9A94]/40 border-t border-[#2B2B2B]/20 bg-[#111111] z-10">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 px-8">
          <div className="flex items-center gap-2">
            <Globe size={13} className="text-[#C8A46A]/40" />
            <span>TERRAFATHOM v1.0</span>
          </div>
          <span>&copy; 2026 DEEP SPATIAL INTELLIGENCE RESEARCH. ALL RIGHTS RESERVED.</span>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;
