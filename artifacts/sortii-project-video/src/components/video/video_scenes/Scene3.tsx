import { motion } from 'framer-motion';
import { VideoText, SafeFrame } from '@/lib/video';

export function Scene3() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <SafeFrame className="flex flex-col items-center justify-center h-full w-full relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.1, filter: 'blur(5px)' }}
        transition={{ duration: 0.8 }}
        className="text-center px-8 mb-12"
      >
        <VideoText scale="heading" className="text-white font-display font-bold drop-shadow-md">
          A calmer
        </VideoText>
        <VideoText scale="heading" className="text-gold font-serif italic drop-shadow-md mt-2">
          weekly rhythm.
        </VideoText>
      </motion.div>

      {/* Calendar Strip */}
      <div className="flex gap-3 px-4 w-full justify-center">
        {days.map((day, i) => (
          <motion.div
            key={i}
            className={`w-12 h-16 rounded-full flex flex-col items-center justify-center shadow-lg border-2 ${
              i === 2 ? 'bg-gold border-gold text-dark' : 'bg-white/10 border-white/20 text-white'
            }`}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ 
              type: 'spring', 
              stiffness: 200, 
              damping: 20, 
              delay: 0.4 + i * 0.1 
            }}
          >
            <span className="font-bold text-lg">{day}</span>
            {i === 2 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 1.2 }}
                className="w-2 h-2 bg-dark rounded-full mt-1"
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Appointment / Bill list items */}
      <div className="w-full max-w-[80%] mt-12 flex flex-col gap-4">
        {[
          { text: "Dentist Appt", icon: "🦷", color: "text-teal", bg: "bg-teal/20" },
          { text: "Pay Electricity", icon: "⚡", color: "text-gold", bg: "bg-gold/20" },
          { text: "Family Dinner", icon: "🍝", color: "text-plum", bg: "bg-white" }
        ].map((item, i) => (
          <motion.div
            key={i}
            className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-xl"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 1.2 + i * 0.2 }}
          >
            <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center text-2xl`}>
              {item.icon}
            </div>
            <div className="flex-1">
              <div className={`h-3 w-1/3 ${i === 2 ? 'bg-plum/20' : 'bg-gray-200'} rounded mb-2`}></div>
              <div className={`text-xl font-bold ${item.color}`}>{item.text}</div>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 1.8 + i * 0.2 }}
              className="w-6 h-6 rounded-full border-2 border-green-500 flex items-center justify-center text-green-500"
            >
              ✓
            </motion.div>
          </motion.div>
        ))}
      </div>
    </SafeFrame>
  );
}
