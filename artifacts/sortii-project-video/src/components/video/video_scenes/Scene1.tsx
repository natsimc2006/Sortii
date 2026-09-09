import { motion } from 'framer-motion';
import { SafeFrame } from '@/lib/video';

export function Scene1() {
  return (
    <SafeFrame className="flex flex-col items-center justify-center h-full w-full relative">
      
      {/* Floating abstract elements representing "chaos" organizing */}
      <motion.div
        className="absolute w-24 h-24 bg-gold rounded-xl shadow-lg"
        initial={{ x: '-40vw', y: '-30vh', rotate: -45, opacity: 0 }}
        animate={{ x: '-20vw', y: '-15vh', rotate: 10, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
      />
      <motion.div
        className="absolute w-20 h-20 bg-teal rounded-full shadow-lg"
        initial={{ x: '40vw', y: '30vh', scale: 0 }}
        animate={{ x: '25vw', y: '20vh', scale: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.4, delay: 0.4 }}
      />
      <motion.div
        className="absolute w-32 h-12 bg-plum rounded-full shadow-lg"
        initial={{ x: '30vw', y: '-40vh', opacity: 0, rotate: 45 }}
        animate={{ x: '15vw', y: '-25vh', opacity: 1, rotate: -15 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
      />

      <motion.div
        className="relative z-10 w-[70%]"
        initial={{ scale: 0.8, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 1.2, opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 1, type: "spring", stiffness: 100, damping: 20 }}
      >
        <img 
          src={`${import.meta.env.BASE_URL}images/sortii-logo.png`} 
          alt="Sortii Logo" 
          className="w-full h-auto drop-shadow-xl"
        />
      </motion.div>
    </SafeFrame>
  );
}
