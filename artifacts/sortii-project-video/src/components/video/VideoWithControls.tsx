import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';

import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  scene1: { title: 'Meet Sortii', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  scene2: { title: 'Meals and Money', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  scene3: { title: 'Family Planning', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  scene4: { title: 'Your Week, Sorted', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
};

const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBase = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBase.current = 0;
  }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const timer = window.setInterval(
      () => setElapsed(elapsedBase.current + performance.now() - start),
      60,
    );
    return () => {
      window.clearInterval(timer);
      elapsedBase.current += performance.now() - start;
    };
  }, [paused, tick]);

  const progress = activeDuration ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(
    totalDuration,
    activeStartTime + Math.min(elapsed, activeDuration),
  );

  return (
    <>
      <div className="flex flex-1 items-center gap-1.5">
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            onClick={() => onJumpTo(index)}
            className="relative h-3 min-h-[12px] flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20 transition-all hover:h-4"
            aria-label={`Jump to scene ${index + 1}`}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/90"
              style={{ width: `${index === activeIndex ? progress * 100 : 0}%` }}
            />
          </button>
        ))}
      </div>
      <span className="shrink-0 font-mono text-sm text-white/70">
        {activeIndex + 1}/{sceneKeys.length}
      </span>
      <span className="min-w-[10ch] shrink-0 text-right font-mono text-sm text-white/80">
        {formatTime(totalElapsed)} / {formatTime(totalDuration)}
      </span>
    </>
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const sensorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controls.paused) return;
    const frozen = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [controls.paused]);

  const handleJump = useCallback(
    (index: number) => {
      controls.jumpTo(index);
      const key = controls.sceneKeys[index];
      const details = SCENE_DETAILS[key];
      if (!details) return;
      window.parent.postMessage(
        {
          type: 'REPLIT_VIDEO_SCENE_SELECTED',
          payload: {
            sceneIndex: index,
            sceneCount: controls.sceneKeys.length,
            sceneTitle: details.title,
            filePath: details.filePath,
            lineNumber: 1,
          },
        },
        '*',
      );
    },
    [controls],
  );

  if (!isIframed) return <VideoTemplate />;
  const visible = !collapsed || hovering;
  const iconClass = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white';

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <VideoTemplate
        key={controls.mountKey}
        durations={controls.durations}
        paused={controls.paused}
        muted={muted}
        onSceneChange={controls.onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute inset-x-0 bottom-0 z-50 flex h-1/4 flex-col justify-end"
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setHovering(false)}
      >
        <div className="flex-1" />
        <div className={`flex items-center gap-2 bg-black/55 px-3 py-3 backdrop-blur-md transition-all ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`}>
          <button className={iconClass} onClick={controls.togglePause} aria-label={controls.paused ? 'Play' : 'Pause'}>
            {controls.paused ? <Play /> : <Pause />}
          </button>
          <button className={iconClass} onClick={controls.toggleLock} aria-label="Loop current scene">
            <Repeat className={controls.locked ? 'text-white' : ''} />
          </button>
          <button className={iconClass} onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <span className="h-9 w-px bg-white/20" />
          <PlaybackStatus
            sceneKeys={controls.sceneKeys}
            activeIndex={controls.activeIndex}
            activeDuration={controls.activeDuration}
            activeStartTime={controls.activeStartTime}
            totalDuration={controls.totalDuration}
            tick={controls.tick}
            paused={controls.paused}
            onJumpTo={handleJump}
          />
          <button className={iconClass} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Show controls' : 'Hide controls'}>
            {collapsed ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>
      </div>
    </div>
  );
}