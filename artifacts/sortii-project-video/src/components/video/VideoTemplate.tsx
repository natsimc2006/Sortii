// Video Template - Replace ReplitLoadingScene with your scenes

import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';

export const SCENE_DURATIONS = {
  scene1: 3000,
  scene2: 4500,
  scene3: 4000,
  scene4: 4500,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '9:16';

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  scene1: Scene1,
  scene2: Scene2,
  scene3: Scene3,
  scene4: Scene4,
};

const SCENE_START_SEC = Object.entries(SCENE_DURATIONS).reduce<Record<string, number>>(
  (offsets, [key, duration]) => {
    offsets[key] = Object.values(offsets).length
      ? Object.entries(SCENE_DURATIONS)
          .slice(0, Object.keys(offsets).length)
          .reduce((sum, [, value]) => sum + value, 0) / 1000
      : 0;
    return offsets;
  },
  {},
);

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSceneKey = useRef<string | null>(null);
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const currentScene = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  useEffect(() => onSceneChange?.(currentSceneKey), [currentSceneKey, onSceneChange]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKey.current !== currentSceneKey) {
      lastSceneKey.current = currentSceneKey;
      const target = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - target) > 0.18) audio.currentTime = target;
    }
    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoPausedContext.Provider value={paused}>
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      {/* Background layer outside AnimatePresence for continuity */}
      <motion.div
        className="absolute inset-0 bg-cream"
        animate={{
          backgroundColor:
            currentScene === 0
              ? 'var(--color-bg-light)'
              : currentScene === 1
              ? 'var(--color-teal)'
              : currentScene === 2
              ? 'var(--color-plum)'
              : 'var(--color-gold)',
        }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
      
      {/* Dynamic background shapes */}
      <motion.div
        className="absolute rounded-full mix-blend-multiply opacity-30"
        animate={{
          width: currentScene === 0 ? '120vw' : currentScene === 2 ? '150vw' : '80vw',
          height: currentScene === 0 ? '120vw' : currentScene === 2 ? '150vw' : '80vw',
          x: currentScene === 1 ? '10vw' : currentScene === 3 ? '-20vw' : '-30vw',
          y: currentScene === 0 ? '-50vh' : currentScene === 2 ? '-20vh' : '60vh',
          backgroundColor:
            currentScene === 0
              ? 'var(--color-teal)'
              : currentScene === 1
              ? 'var(--color-plum)'
              : currentScene === 2
              ? 'var(--color-gold)'
              : 'var(--color-bg-light)',
        }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />
      
      <motion.div
        className="absolute rounded-full mix-blend-multiply opacity-20"
        animate={{
          width: currentScene === 1 ? '140vw' : '90vw',
          height: currentScene === 1 ? '140vw' : '90vw',
          x: currentScene === 0 ? '40vw' : currentScene === 2 ? '10vw' : '50vw',
          y: currentScene === 0 ? '40vh' : currentScene === 1 ? '10vh' : '-20vh',
          backgroundColor:
            currentScene === 0
              ? 'var(--color-gold)'
              : currentScene === 1
              ? 'var(--color-bg-light)'
              : 'var(--color-teal)',
        }}
        transition={{ duration: 2.5, ease: 'easeInOut' }}
      />

      {/* mode="wait" = sequential, "sync" = simultaneous, "popLayout" = new snaps in while old animates out */}
      <AnimatePresence mode="popLayout">
        {SceneComponent && <SceneComponent key={currentSceneKey} />}
      </AnimatePresence>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </VideoCanvas>
    </VideoPausedContext.Provider>
  );
}
