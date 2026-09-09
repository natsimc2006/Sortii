import { motion } from 'framer-motion';
import { VideoText, SafeFrame } from '@/lib/video';

export function Scene2() {
  return (
    <SafeFrame className="flex flex-col items-center justify-center h-full w-full relative">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="absolute top-[15vh] w-full text-center px-8"
      >
        <VideoText scale="heading" className="text-white font-display font-bold drop-shadow-md">
          Meals & Money
        </VideoText>
        <VideoText scale="body" className="text-cream opacity-90 font-body mt-2">
          in one simple flow.
        </VideoText>
      </motion.div>

      {/* Cards container */}
      <div className="relative w-full h-[50vh] flex items-center justify-center mt-20">
        
        {/* Meal Card */}
        <motion.div
          className="absolute bg-white rounded-3xl p-6 shadow-2xl w-[65vw]"
          initial={{ x: '-60vw', rotate: -20, opacity: 0 }}
          animate={{ x: '-15vw', rotate: -8, opacity: 1 }}
          exit={{ x: '-60vw', opacity: 0, rotate: -20 }}
          transition={{ type: 'spring', stiffness: 150, damping: 18, delay: 0.5 }}
        >
          <div className="w-full h-32 bg-teal/20 rounded-2xl mb-4 flex items-center justify-center">
            <span className="text-6xl">🥗</span>
          </div>
          <div className="h-4 w-3/4 bg-teal/20 rounded mb-2"></div>
          <div className="h-4 w-1/2 bg-teal/10 rounded"></div>
        </motion.div>

        {/* Money Card */}
        <motion.div
          className="absolute bg-white rounded-3xl p-6 shadow-2xl w-[65vw]"
          initial={{ x: '60vw', rotate: 20, opacity: 0 }}
          animate={{ x: '15vw', rotate: 6, opacity: 1 }}
          exit={{ x: '60vw', opacity: 0, rotate: 20 }}
          transition={{ type: 'spring', stiffness: 150, damping: 18, delay: 0.7 }}
        >
          <div className="w-full h-32 bg-gold/20 rounded-2xl mb-4 flex items-center justify-center">
            <span className="text-6xl">💰</span>
          </div>
          <div className="h-4 w-2/3 bg-gold/20 rounded mb-2"></div>
          <div className="h-4 w-1/3 bg-gold/10 rounded"></div>
        </motion.div>

      </div>
    </SafeFrame>
  );
}
