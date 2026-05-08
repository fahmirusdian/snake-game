import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, RefreshCcw } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIRECTION = { x: 0, y: -1 }; // UP
const GAME_SPEED = 120; // ms per tick

const TRACKS = [
  { id: 1, title: 'Cyber Pulse (AI Generated)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: 'Digital Dawn (AI Generated)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: 'Neon Nights (AI Generated)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' }
];

type Point = { x: number; y: number };

export default function App() {
  // Game State
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION);
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  
  // Refs for Game Loop to avoid dependency issues in setInterval
  const directionRef = useRef(direction);
  const nextDirectionRef = useRef(direction);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const gameOverRef = useRef(gameOver);
  const gameStartedRef = useRef(gameStarted);

  // Audio State
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Decorative Visualizer State
  const [visLevels, setVisLevels] = useState<number[]>(Array(16).fill(10));

  // Sync refs
  useEffect(() => { directionRef.current = direction; }, [direction]);
  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { gameStartedRef.current = gameStarted; }, [gameStarted]);

  // Audio initialization
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(TRACKS[0].url);
      audioRef.current.loop = false;
      audioRef.current.addEventListener('ended', handleSkipForward);
    }
    return () => {
      audioRef.current?.removeEventListener('ended', handleSkipForward);
      audioRef.current?.pause();
    };
  }, []);

  // Handle Track Changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = TRACKS[currentTrackIdx].url;
      audioRef.current.volume = isMuted ? 0 : volume;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback prevented", e));
      }
    }
  }, [currentTrackIdx]);

  // Audio Playback Sync (Handles the play/pause state changing correctly)
  useEffect(() => {
      if (audioRef.current) {
         if (isPlaying && audioRef.current.paused) {
             audioRef.current.play().catch(e => {
               console.error("Playback prevented", e);
               setIsPlaying(false);
             });
         } else if (!isPlaying && !audioRef.current.paused) {
             audioRef.current.pause();
         }
      }
  }, [isPlaying]);

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Visualizer Animation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setVisLevels(Array.from({length: 16}).map(() => 20 + Math.random() * 80));
      }, 200); // 200ms updates
    } else {
      setVisLevels(Array(16).fill(10));
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSkipForward = useCallback(() => {
    setCurrentTrackIdx((prev) => (prev + 1) % TRACKS.length);
  }, []);

  const handleSkipBack = useCallback(() => {
    setCurrentTrackIdx((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
  }, []);

  // Game Logic
  const generateFood = (currentSnake: Point[]) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      const isOnSnake = currentSnake.some(segment => segment.x === newFood!.x && segment.y === newFood!.y);
      if (!isOnSnake) break;
    }
    return newFood;
  };

  const startGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    nextDirectionRef.current = INITIAL_DIRECTION;
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    setFood(generateFood(INITIAL_SNAKE));
    if (!isPlaying) {
      setIsPlaying(true); // Auto-start music if not playing
    }
  };

  const tick = useCallback(() => {
    if (gameOverRef.current || !gameStartedRef.current) return;

    let currentDirection = nextDirectionRef.current;
    const currentActualDirection = directionRef.current;
    
    // Validate direction to prevent 180 degree turns
    if (
        (currentDirection.x === -currentActualDirection.x && currentDirection.x !== 0) ||
        (currentDirection.y === -currentActualDirection.y && currentDirection.y !== 0)
    ) {
        currentDirection = currentActualDirection; // Ignore the invalid turn
        nextDirectionRef.current = currentDirection;
    }

    setDirection(currentDirection);

    const currentSnake = snakeRef.current;
    const head = currentSnake[0];
    const newHead = {
      x: head.x + currentDirection.x,
      y: head.y + currentDirection.y
    };

    // Check collision with walls
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      setGameOver(true);
      return;
    }

    // Check collision with self
    if (currentSnake.some((segment, idx) => {
        // Only body collision is bad. The very tip of the tail might move, but simple approach is solid.
        return idx !== 0 && segment.x === newHead.x && segment.y === newHead.y;
    })) {
       setGameOver(true);
       return;
    }

    const newSnake = [newHead, ...currentSnake];

    // Check food
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      setScore(s => s + 10);
      setFood(generateFood(newSnake));
      // Don't pop tail, so snake grows
    } else {
      newSnake.pop(); // Remove tail
    }

    setSnake(newSnake);
  }, []);

  useEffect(() => {
    if (gameStarted && !gameOver) {
      const intervalId = setInterval(tick, GAME_SPEED);
      return () => clearInterval(intervalId);
    }
  }, [gameStarted, gameOver, tick]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for arrow keys & spacebar
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (!gameStartedRef.current || gameOverRef.current) {
        if (e.key === ' ' || e.key === 'Enter') startGame();
        return;
      }

      const currentDir = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (currentDir.y !== 1) nextDirectionRef.current = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (currentDir.y !== -1) nextDirectionRef.current = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (currentDir.x !== 1) nextDirectionRef.current = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (currentDir.x !== -1) nextDirectionRef.current = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans scanline relative overflow-hidden flex flex-col">
      {/* Background atmosphere elements */}
      <div className="static-noise z-0"></div>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[20%] opacity-20 bg-[#00ffff] blur-[80px] origin-center skew-y-12"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[30%] opacity-20 bg-[#ff00ff] blur-[100px] origin-center -skew-x-12"></div>
      </div>

      <div className="z-10 flex flex-col h-full w-full max-w-6xl mx-auto px-4 py-8 flex-1">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 glass-panel px-4 py-2 rounded-none glitch-border screen-tear">
          <div className="flex flex-col items-center md:items-start">
            <h1 className="text-3xl md:text-4xl tracking-wider glitch-text-magenta uppercase">
              SYSTEM_FAILURE: SNAKE_PROTOCOL.EXE
            </h1>
            <p className="text-sm font-mono text-gray-400 mt-1 uppercase tracking-widest text-center md:text-left glitch-text-cyan">
              // OVERRIDE DETECTED
            </p>
          </div>
          
          <div className="flex items-center gap-6 px-6 py-2 border-transparent">
             <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-widest text-gray-500 font-mono">DATA_RECOVERED</span>
                <span className="text-3xl font-mono font-bold glitch-text-cyan leading-none">
                  {score.toString().padStart(4, '0')} BYTE(S)
                </span>
             </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center">
          
          {/* Game Board Container */}
          <div className="w-full lg:w-auto flex flex-col items-center flex-shrink-0">
            <div className="glass-panel glitch-border p-2 shrink-0 screen-tear">
              <div 
                className="relative bg-[#000] border-[2px] border-[#ff00ff] overflow-hidden shrink-0"
                style={{
                  width: 'min(90vw, 500px)',
                  height: 'min(90vw, 500px)',
                  display: 'grid',
                  gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                  gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`
                }}
              >
                {!gameStarted && !gameOver && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20">
                    <h2 className="text-5xl glitch-text-cyan mb-4 uppercase">AWAITING_INPUT</h2>
                    <p className="text-sm font-mono text-gray-400 mb-6 text-center">[WASD/Arrows]: CALIBRATE_TRAJECTORY<br/>[SPACE]: EXECUTE</p>
                    <button 
                      onClick={startGame}
                      className="px-8 py-3 font-mono text-lg font-bold text-black glitch-bg-cyan hover:bg-[#fff] transition-opacity uppercase tracking-widest"
                    >
                      INITIALIZE
                    </button>
                  </div>
                )}
                
                {gameOver && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-20">
                    <h2 className="text-6xl glitch-text-magenta mb-2 uppercase">CRITICAL_ERROR</h2>
                    <p className="text-xl font-mono text-white mb-6">DATA_CORRUPTED: {score} BYTE(S)</p>
                    <button 
                      onClick={startGame}
                      className="px-8 py-3 flex items-center gap-3 font-mono text-lg font-bold text-black glitch-bg-cyan hover:bg-[#fff] transition-opacity uppercase tracking-widest"
                    >
                      <RefreshCcw size={20} />
                      REBOOT_SEQUENCE
                    </button>
                  </div>
                )}

                {/* Draw Board Entities */}
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
                  const x = index % GRID_SIZE;
                  const y = Math.floor(index / GRID_SIZE);
                  
                  const isHead = snake[0].x === x && snake[0].y === y;
                  const isBody = snake.some((segment, idx) => idx !== 0 && segment.x === x && segment.y === y);
                  const isFood = food.x === x && food.y === y;

                  return (
                    <div 
                      key={index} 
                      className={`cell ${isHead || isBody ? 'snake-body z-10' : ''} ${isFood ? 'food animate-pulse z-10' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
            
            <div className="mt-4 flex gap-4 text-xs font-mono text-gray-500 uppercase tracking-wider">
               <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#00ffff] shadow-[2px_2px_0_#ff00ff]"></div> ENTITY</div>
               <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#ff00ff] shadow-[-2px_-2px_0_#00ffff]"></div> PACKET</div>
            </div>
          </div>

          {/* Player & Controls Sidebar */}
          <div className="w-full max-w-[500px] lg:w-80 flex flex-col gap-6 flex-shrink-0">
            {/* Music Player */}
            <div className="glass-panel glitch-border p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none text-[#00ffff]">
                 <Play size={100} />
              </div>
              
              <h3 className="text-xs font-mono text-[#00ffff] uppercase tracking-widest mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00ffff] animate-pulse glitch-bg-cyan"></span>
                AUDIO_OVERRIDE_ACTIVE
              </h3>
              
              <div className="mb-6 relative z-10">
                <div className="text-xs font-mono text-gray-500 mb-1">STREAM.LOG</div>
                <div className="text-lg font-bold line-clamp-2 glitch-text-magenta uppercase" title={TRACKS[currentTrackIdx].title}>
                  {"> "}{TRACKS[currentTrackIdx].title}
                </div>
                <div className="h-1 w-full bg-white/10 mt-4 overflow-hidden flex glitch-border-alt border-[1px] p-0.5">
                  {isPlaying && (
                     <div className="h-full bg-[#00ffff] w-full animate-[pulse_0.5s_ease-in-out_infinite]"></div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-8 relative z-10">
                <button 
                  onClick={handleSkipBack}
                  className="p-3 bg-gray-900 text-gray-400 hover:text-[#00ffff] border border-transparent transition-all hover:bg-gray-800"
                >
                  <SkipBack size={20} />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  className="w-16 h-16 border-2 border-[#00ffff] flex items-center justify-center text-[#00ffff] hover:bg-[#00ffff] hover:text-black transition-all bg-black/40"
                >
                  {isPlaying ? <Pause size={30} className="fill-current" /> : <Play size={30} className="fill-current ml-1" />}
                </button>
                
                <button 
                  onClick={handleSkipForward}
                  className="p-3 bg-gray-900 text-gray-400 hover:text-[#00ffff] border border-transparent transition-all hover:bg-gray-800"
                >
                  <SkipForward size={20} />
                </button>
              </div>

              <div className="flex items-center gap-3 relative z-10">
                <button onClick={() => setIsMuted(!isMuted)} className="text-gray-400 hover:text-[#ff00ff] transition-colors">
                  {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#111] appearance-none cursor-pointer border border-[#333] focus:outline-none"
                  style={{
                     background: `linear-gradient(to right, #ff00ff ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`
                  }}
                />
              </div>
            </div>

            {/* Visualizer Block (Decorative) */}
            <div className="glass-panel glitch-border p-6 hidden lg:flex flex-col flex-1 min-h-[160px]">
              <h3 className="text-xs font-mono text-[#00ffff] uppercase tracking-widest mb-4 border-b border-[#00ffff]/30 pb-2">HZ_ANALYSIS</h3>
              <div className="flex-1 flex items-end gap-[2px]">
                {visLevels.map((height, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-[#ff00ff] transition-all duration-75 relative"
                    style={{ height: `${height}%`, opacity: Math.random() * 0.5 + 0.5 }}
                  >
                    <div className="absolute top-0 w-full h-[2px] bg-[#00ffff]"></div>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </main>
      </div>
    </div>
  );
}
