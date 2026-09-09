import { motion } from 'framer-motion';
import { VideoText, SafeFrame } from '@/lib/video';

export function Scene4() {
  return (
    <SafeFrame className="flex flex-col items-center justify-center h-full w-full relative">
      
      {/* Decorative radial bursts */}
      <motion.div
        className="absolute w-[200vw] h-[200vw] rounded-full bg-white opacity-20"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
      <motion.div
        className="absolute w-[150vw] h-[150vw] rounded-full bg-cream opacity-40"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
      />
      <motion.div
        className="absolute w-[100vw] h-[100vw] rounded-full bg-white opacity-60"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.0, ease: "easeOut", delay: 0.4 }}
      />

      <motion.div
        className="relative z-10 w-[85%] flex flex-col items-center"
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 1, type: "spring", stiffness: 100, damping: 20, delay: 0.8 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/sortii-logo-v2-landing.png`} 
          alt="Sortii Logo Landing" 
          className="w-full h-auto drop-shadow-2xl"
        />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.8 }}
          className="mt-16 text-center"
        >
          <VideoText scale="heading" className="font-display font-bold text-dark drop-shadow-md leading-tight">
            Your week,
          </VideoText>
          <VideoText scale="heading" className="font-serif italic text-dark drop-shadow-md leading-tight">
            sorted.
          </VideoText>
        </motion.div>
      </motion.div>
      
    </SafeFrame>
  );
}
