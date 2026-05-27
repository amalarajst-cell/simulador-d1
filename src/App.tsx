import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trophy, 
  Play, 
  LogOut, 
  Timer, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  BookOpen, 
  Info
} from 'lucide-react';
import questionsData from './data/questions.json';
import { logoBase64 } from './data/logo';

interface Question {
  id: number;
  pregunta: string;
  opciones: string[];
  correcta: number;
  imagen: string | null;
}

const questions: Question[] = questionsData as Question[];

interface ExamStats {
  examsTaken: number;
  examsPassed: number;
  totalCorrect: number;
  totalAnswered: number;
}

export default function App() {
  // Navigation & Mode States
  const [view, setView] = useState<'dashboard' | 'exam' | 'results'>('dashboard');
  const [examMode, setExamMode] = useState<'simulator' | '30q' | '40q' | 'errors'>('simulator');
  const [learningMode, setLearningMode] = useState<boolean>(true); // true = Corrección Inmediata, false = Corrección al Final
  const [hasTimer, setHasTimer] = useState<boolean>(true);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
    const saved = localStorage.getItem('d1_auto_advance');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('d1_auto_advance', JSON.stringify(autoAdvance));
  }, [autoAdvance]);

  // Active Exam States
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // maps index in activeQuestions -> selected option index
  const [answeredState, setAnsweredState] = useState<Record<number, boolean>>({}); // maps index -> whether it was checked (for immediate feedback)
  const [timeLeft, setTimeLeft] = useState<number>(40); // 40 seconds per question in per-question timer
  const [showAbandonConfirm, setShowAbandonConfirm] = useState<boolean>(false);
  const [examTimeElapsed, setExamTimeElapsed] = useState<number>(0);

  // Global Statistics (persisted in localStorage)
  const [stats, setStats] = useState<ExamStats>(() => {
    const saved = localStorage.getItem('d1_stats');
    return saved ? JSON.parse(saved) : { examsTaken: 0, examsPassed: 0, totalCorrect: 0, totalAnswered: 0 };
  });

  const [failedQuestionIds, setFailedQuestionIds] = useState<number[]>(() => {
    const saved = localStorage.getItem('d1_failed_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const failedRef = useRef(failedQuestionIds);
  failedRef.current = failedQuestionIds;

  // Save Stats
  useEffect(() => {
    localStorage.setItem('d1_stats', JSON.stringify(stats));
  }, [stats]);

  // Save Failed IDs
  useEffect(() => {
    localStorage.setItem('d1_failed_ids', JSON.stringify(failedQuestionIds));
  }, [failedQuestionIds]);

  // Timer Effect for Active Exam
  useEffect(() => {
    let timer: any;
    if (view === 'exam' && hasTimer && !showAbandonConfirm) {
      if (timeLeft > 0) {
        timer = setTimeout(() => {
          setTimeLeft(prev => prev - 1);
          setExamTimeElapsed(prev => prev + 1);
        }, 1000);
      } else {
        // Auto submit current question on timeout
        handleTimeOut();
      }
    } else if (view === 'exam' && !showAbandonConfirm) {
      timer = setTimeout(() => {
        setExamTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [view, timeLeft, hasTimer, showAbandonConfirm]);

  // Reset scroll on question change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentIdx, view]);

  // Helper: Start Exam
  const startExam = (mode: 'simulator' | '30q' | '40q' | 'errors') => {
    setExamMode(mode);
    let selectedQs: Question[] = [];

    if (mode === 'simulator') {
      // All questions shuffled
      selectedQs = [...questions].sort(() => 0.5 - Math.random());
    } else if (mode === '30q') {
      selectedQs = [...questions].sort(() => 0.5 - Math.random()).slice(0, 30);
    } else if (mode === '40q') {
      selectedQs = [...questions].sort(() => 0.5 - Math.random()).slice(0, 40);
    } else if (mode === 'errors') {
      // Questions from failed list
      const errorQuestions = questions.filter(q => failedQuestionIds.includes(q.id));
      if (errorQuestions.length === 0) {
        alert("¡No tienes preguntas con errores guardadas!");
        return;
      }
      selectedQs = errorQuestions.sort(() => 0.5 - Math.random());
    }

    setActiveQuestions(selectedQs);
    setCurrentIdx(0);
    setAnswers({});
    setAnsweredState({});
    setTimeLeft(40);
    setExamTimeElapsed(0);
    setView('exam');
  };

  // Timeout handler
  const handleTimeOut = () => {
    // Treat as unanswered/incorrect
    if (learningMode) {
      // Mark as answered to show correct answer
      setAnsweredState(prev => ({ ...prev, [currentIdx]: true }));
      // Save to failed list
      const currentQ = activeQuestions[currentIdx];
      if (!failedQuestionIds.includes(currentQ.id)) {
        setFailedQuestionIds(prev => [...prev, currentQ.id]);
      }
    } else {
      // In simulator mode, just select nothing and auto advance or leave unanswered
      // Let's set answer to -1 (timed out)
      setAnswers(prev => ({ ...prev, [currentIdx]: -1 }));
      goToNextQuestion();
    }
  };

  // Select Option Handler
  const handleOptionSelect = (optionIdx: number) => {
    if (answeredState[currentIdx]) return; // already answered in learning mode

    const updatedAnswers = { ...answers, [currentIdx]: optionIdx };
    setAnswers(updatedAnswers);

    if (learningMode) {
      setAnsweredState(prev => ({ ...prev, [currentIdx]: true }));
      
      const currentQ = activeQuestions[currentIdx];
      const isCorrect = optionIdx === currentQ.correcta;

      if (!isCorrect) {
        // Add to failed list
        if (!failedQuestionIds.includes(currentQ.id)) {
          setFailedQuestionIds(prev => [...prev, currentQ.id]);
        }
      } else {
        // If correct and was in failed list, we can remove it (training success!)
        if (examMode === 'errors') {
          setFailedQuestionIds(prev => prev.filter(id => id !== currentQ.id));
        }
      }

      if (autoAdvance) {
        setTimeout(() => {
          setCurrentIdx(prevIdx => {
            if (prevIdx === currentIdx) {
              if (prevIdx < activeQuestions.length - 1) {
                setTimeLeft(40);
                return prevIdx + 1;
              } else {
                finishExam(updatedAnswers);
              }
            }
            return prevIdx;
          });
        }, 1500);
      }
    } else {
      if (autoAdvance) {
        setTimeout(() => {
          setCurrentIdx(prevIdx => {
            if (prevIdx === currentIdx) {
              if (prevIdx < activeQuestions.length - 1) {
                setTimeLeft(40);
                return prevIdx + 1;
              } else {
                finishExam(updatedAnswers);
              }
            }
            return prevIdx;
          });
        }, 300);
      }
    }
  };

  const goToNextQuestion = () => {
    if (currentIdx < activeQuestions.length - 1) {
      setCurrentIdx(prev => prev + 1);
      setTimeLeft(40);
    } else {
      finishExam();
    }
  };

  const goToPrevQuestion = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
      setTimeLeft(40); // Reset timer or keep? Let's reset for convenience
    }
  };

  // Finish Exam & Compile Results
  const finishExam = (currentAnswers = answers) => {
    let correctCount = 0;
    let answeredCount = 0;
    const newFailedIds = [...failedRef.current];

    activeQuestions.forEach((q, idx) => {
      const selected = currentAnswers[idx];
      if (selected !== undefined && selected !== null && selected !== -1) {
        answeredCount++;
        const isCorrect = selected === q.correcta;
        if (isCorrect) {
          correctCount++;
        } else {
          if (!newFailedIds.includes(q.id)) {
            newFailedIds.push(q.id);
          }
        }
      } else {
        // timed out or skipped, also count as failed
        if (!newFailedIds.includes(q.id)) {
          newFailedIds.push(q.id);
        }
      }
    });

    // Update failed IDs state
    setFailedQuestionIds(newFailedIds);

    // Calculate pass/fail (90% threshold)
    const ratio = correctCount / activeQuestions.length;
    const passed = ratio >= 0.90;

    // Update global stats
    setStats(prev => ({
      examsTaken: prev.examsTaken + 1,
      examsPassed: prev.examsPassed + (passed ? 1 : 0),
      totalCorrect: prev.totalCorrect + correctCount,
      totalAnswered: prev.totalAnswered + activeQuestions.length
    }));

    setView('results');
  };

  // Abandon Exam
  const confirmAbandon = () => {
    setShowAbandonConfirm(false);
    setView('dashboard');
  };

  // Reset all stats
  const resetStats = () => {
    if (window.confirm("¿Seguro que deseas reiniciar todas tus estadísticas e historial de errores?")) {
      setStats({ examsTaken: 0, examsPassed: 0, totalCorrect: 0, totalAnswered: 0 });
      setFailedQuestionIds([]);
      localStorage.removeItem('d1_stats');
      localStorage.removeItem('d1_failed_ids');
    }
  };

  // Compute stats details
  const scorePercent = activeQuestions.length > 0 
    ? Math.round((Object.keys(answers).filter((idx: any) => answers[idx] === activeQuestions[idx].correcta).length / activeQuestions.length) * 100) 
    : 0;

  const examCorrectAnswersCount = useMemo(() => {
    if (activeQuestions.length === 0) return 0;
    let count = 0;
    activeQuestions.forEach((q, idx) => {
      if (answers[idx] === q.correcta) count++;
    });
    return count;
  }, [activeQuestions, answers]);

  const examPassedResult = examCorrectAnswersCount / activeQuestions.length >= 0.90;

  const globalSuccessRate = stats.examsTaken > 0
    ? Math.round((stats.examsPassed / stats.examsTaken) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-brand-navy text-white flex flex-col font-brand-body relative overflow-x-hidden grid-bg-overlay">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ambient-glow-yellow pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] ambient-glow-red pointer-events-none z-0" />

      {/* Header */}
      <header className="border-b-2 border-black bg-brand-navy py-4 px-6 md:px-12 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-yellow flex items-center justify-center border-2 border-black shadow-[2px 2px 0px 0px #000000]">
            <span className="font-brand-heading font-black italic text-brand-navy text-xl">D1</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-brand-heading font-black italic tracking-tighter text-gradient-amber">
              ENTRENAMIENTO
            </h1>
            <p className="text-[10px] text-gray-400 tracking-widest uppercase">Licencia Profesional</p>
          </div>
        </div>

        {view === 'exam' && (
          <button 
            onClick={() => setShowAbandonConfirm(true)}
            className="flex items-center gap-2 border-2 border-red-500/50 hover:border-red-500 bg-red-950/20 text-red-400 hover:text-red-300 py-1.5 px-4 font-bold text-xs uppercase transition-all duration-300 shadow-[2px_2px_0px_0px_rgba(239,68,68,0.3)] active:translate-y-0.5 active:shadow-none"
          >
            <LogOut className="w-4.5 h-4.5" />
            <span>Abandonar</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col justify-start relative z-10 py-8 px-4 md:px-12 max-w-7xl mx-auto w-full">
        
        {/* VIEW 1: DASHBOARD */}
        {view === 'dashboard' && (
          <div className="flex flex-col gap-8 w-full animate-[fadeIn_0.5s_ease-out]">
            {/* Intro Alert */}
            <div className="glass-panel p-6 border-l-4 border-l-brand-yellow flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex gap-4 items-start">
                <div className="bg-brand-yellow/10 p-3 border border-brand-yellow/20 text-brand-yellow">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold uppercase tracking-tight text-white">Preparación de Alto Rendimiento</h3>
                  <p className="text-sm text-gray-400 max-w-2xl mt-1">
                    Este simulador contiene las <b>218 preguntas oficiales</b> para el examen de conducir categoría D1. Entrena de manera eficiente con estadísticas de fallos y modos configurables.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <span className="bg-brand-dark-grey text-brand-yellow text-xs font-black uppercase tracking-wider px-3 py-1.5 border border-gray-700">
                  Total Preguntas: 218
                </span>
                <span className="bg-brand-dark-grey text-green-400 text-xs font-black uppercase tracking-wider px-3 py-1.5 border border-gray-700">
                  Aprobación: 90%
                </span>
              </div>
            </div>

            {/* Config & Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Training Modes Column */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <h2 className="text-2xl md:text-3xl font-brand-heading font-black italic tracking-tighter text-white uppercase">
                  Modos de Entrenamiento
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mode 1: Simulator */}
                  <div className="card-extreme hover:border-brand-yellow transition-colors duration-300 flex flex-col justify-between group shadow-hard relative">
                    <div className="absolute top-2 right-2 bg-brand-yellow text-brand-navy font-black text-[9px] px-2 py-0.5 tracking-wider uppercase">
                      Recomendado
                    </div>
                    <div>
                      <h3 className="text-xl font-brand-heading text-white italic group-hover:text-brand-yellow transition-colors">
                        Simulador Completo
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Examen completo con las 218 preguntas ordenadas aleatoriamente. Ideal para una autoevaluación exhaustiva sin límites de tiempo.
                      </p>
                    </div>
                    <button 
                      onClick={() => startExam('simulator')}
                      className="btn-primary mt-6 w-full btn-extreme flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-brand-navy" />
                      <span>Iniciar (218 Q)</span>
                    </button>
                  </div>

                  {/* Mode 2: 30 Q */}
                  <div className="card-extreme hover:border-brand-yellow transition-colors duration-300 flex flex-col justify-between group shadow-hard">
                    <div>
                      <h3 className="text-xl font-brand-heading text-white italic group-hover:text-brand-yellow transition-colors">
                        Examen Rápido
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Simulación de 30 preguntas elegidas al azar. Requiere 27 correctas para aprobar. Perfecto para pruebas rápidas de rutina.
                      </p>
                    </div>
                    <button 
                      onClick={() => startExam('30q')}
                      className="btn-primary mt-6 w-full btn-extreme flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-brand-navy" />
                      <span>Iniciar (30 Q)</span>
                    </button>
                  </div>

                  {/* Mode 3: 40 Q */}
                  <div className="card-extreme hover:border-brand-yellow transition-colors duration-300 flex flex-col justify-between group shadow-hard">
                    <div>
                      <h3 className="text-xl font-brand-heading text-white italic group-hover:text-brand-yellow transition-colors">
                        Examen Estándar
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Simulación estructurada de 40 preguntas al azar. Requiere 36 correctas para aprobar. Simula las exigencias de exámenes oficiales amplios.
                      </p>
                    </div>
                    <button 
                      onClick={() => startExam('40q')}
                      className="btn-primary mt-6 w-full btn-extreme flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-brand-navy" />
                      <span>Iniciar (40 Q)</span>
                    </button>
                  </div>

                  {/* Mode 4: Review Errors */}
                  <div className="card-extreme hover:border-brand-yellow transition-colors duration-300 flex flex-col justify-between group shadow-hard relative">
                    <div className="absolute top-2 right-2 bg-red-600 text-white font-black text-[9px] px-2 py-0.5 tracking-wider uppercase">
                      Estudiar
                    </div>
                    <div>
                      <h3 className="text-xl font-brand-heading text-white italic group-hover:text-brand-yellow transition-colors">
                        Repasar Errores
                      </h3>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                        Práctica enfocada únicamente en las preguntas que has respondido incorrectamente en intentos anteriores. ¡Limpia tu lista!
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs bg-red-950/30 text-red-400 border border-red-900/50 px-2 py-1 uppercase font-bold tracking-wider">
                          Errores guardados: {failedQuestionIds.length}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => startExam('errors')}
                      disabled={failedQuestionIds.length === 0}
                      className="btn-primary mt-6 w-full btn-extreme flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Play className="w-4 h-4 fill-brand-navy" />
                      <span>Iniciar Práctica</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Configuration & Stats */}
              <div className="flex flex-col gap-6">
                <h2 className="text-2xl md:text-3xl font-brand-heading font-black italic tracking-tighter text-white uppercase">
                  Ajustes y Historial
                </h2>

                {/* Settings Card */}
                <div className="card-extreme shadow-hard flex flex-col gap-4 border border-gray-700">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-brand-yellow border-b border-gray-800 pb-2">
                    Configuración del Examen
                  </h3>

                  {/* Setting 1: Correction Mode */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Modo de Corrección</label>
                    <div className="grid grid-cols-2 gap-1 bg-black/40 p-1 border border-gray-800">
                      <button 
                        onClick={() => setLearningMode(true)}
                        className={`text-[10px] font-black uppercase py-2 px-1 text-center transition-all duration-300 ${learningMode ? 'bg-brand-yellow text-brand-navy' : 'text-gray-400 hover:text-white'}`}
                      >
                        Aprendizaje
                      </button>
                      <button 
                        onClick={() => setLearningMode(false)}
                        className={`text-[10px] font-black uppercase py-2 px-1 text-center transition-all duration-300 ${!learningMode ? 'bg-brand-yellow text-brand-navy' : 'text-gray-400 hover:text-white'}`}
                      >
                        Simulacro
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                      {learningMode 
                        ? "Te muestra si acertaste al instante con explicación visual rápida."
                        : "Selecciona las respuestas y ve la corrección detallada solo al finalizar."
                      }
                    </p>
                  </div>

                  {/* Setting 2: Timer Toggle */}
                  <div className="flex justify-between items-center bg-black/20 p-3 border border-gray-800 mt-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-bold uppercase text-white">Cronómetro Activo</label>
                      <span className="text-[9px] text-gray-500 uppercase">40 seg por pregunta</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={hasTimer}
                      onChange={(e) => setHasTimer(e.target.checked)}
                      className="w-5 h-5 accent-brand-yellow bg-black border border-gray-700 cursor-pointer"
                    />
                  </div>

                  {/* Setting 3: Auto Advance Toggle */}
                  <div className="flex justify-between items-center bg-black/20 p-3 border border-gray-800 mt-2">
                    <div className="flex flex-col">
                      <label className="text-xs font-bold uppercase text-white">Avance Automático</label>
                      <span className="text-[9px] text-gray-500 uppercase">Siguiente pregunta al responder</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                      className="w-5 h-5 accent-brand-yellow bg-black border border-gray-700 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Stats Card */}
                <div className="card-extreme shadow-hard flex flex-col gap-4 border border-gray-700">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-brand-yellow">
                      Estadísticas
                    </h3>
                    {stats.examsTaken > 0 && (
                      <button 
                        onClick={resetStats}
                        className="text-[9px] font-black uppercase text-red-400 hover:text-red-300 flex items-center gap-1 border border-red-500/20 px-2 py-0.5 bg-red-950/20"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Reiniciar</span>
                      </button>
                    )}
                  </div>

                  {stats.examsTaken === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-xs">
                      <Trophy className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                      Aún no has realizado simulacros. ¡Comienza hoy tu entrenamiento!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/30 p-3 border border-gray-800 text-center">
                          <span className="text-2xl font-brand-heading font-black text-white">{stats.examsTaken}</span>
                          <p className="text-[9px] text-gray-400 uppercase font-bold mt-1">Exámenes</p>
                        </div>
                        <div className="bg-black/30 p-3 border border-gray-800 text-center">
                          <span className="text-2xl font-brand-heading font-black text-brand-yellow">{stats.examsPassed}</span>
                          <p className="text-[9px] text-gray-400 uppercase font-bold mt-1">Aprobados</p>
                        </div>
                      </div>

                      <div className="bg-black/30 p-3 border border-gray-800 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Porcentaje de Éxito</span>
                        <span className={`text-sm font-black ${globalSuccessRate >= 90 ? 'text-green-400' : globalSuccessRate >= 60 ? 'text-brand-yellow' : 'text-red-400'}`}>
                          {globalSuccessRate}%
                        </span>
                      </div>

                      <div className="bg-black/30 p-3 border border-gray-800 flex justify-between items-center text-xs">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Aciertos Totales</span>
                        <span className="font-bold text-white">
                          {stats.totalCorrect} / {stats.totalAnswered}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: ACTIVE EXAM */}
        {view === 'exam' && activeQuestions.length > 0 && (
          <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto animate-[fadeIn_0.4s_ease-out]">
            
            {/* Header / Stats Panel */}
            <div className="grid grid-cols-3 items-center bg-brand-dark-grey border-2 border-black p-4 md:p-6 shadow-hard relative">
              
              {/* Question Index */}
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Progreso</span>
                <span className="text-lg md:text-2xl font-brand-heading font-black text-white leading-none mt-1">
                  Q {currentIdx + 1} / {activeQuestions.length}
                </span>
              </div>

              {/* Mode indicator */}
              <div className="text-center flex flex-col items-center">
                <span className="text-[9px] font-black uppercase text-brand-yellow tracking-widest border border-brand-yellow/30 px-2 py-0.5 bg-brand-yellow/5">
                  {examMode === 'simulator' ? 'Simulador' : examMode === '30q' ? 'Examen 30' : examMode === '40q' ? 'Examen 40' : 'Práctica'}
                </span>
                <span className="text-[9px] text-gray-500 uppercase mt-1">
                  {learningMode ? 'Aprendizaje' : 'Simulacro'}
                </span>
              </div>

              {/* Timer */}
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Cronómetro</span>
                <div className={`flex items-center gap-1.5 mt-1 transition-colors ${timeLeft < 10 && hasTimer ? 'text-red-500 font-bold' : 'text-white'}`}>
                  <Timer className={`w-4 h-4 ${timeLeft < 10 && hasTimer ? 'animate-pulse' : 'text-brand-yellow'}`} />
                  <span className="text-lg md:text-2xl font-mono font-black leading-none">
                    {hasTimer ? `${timeLeft}s` : `${Math.floor(examTimeElapsed / 60)}m ${examTimeElapsed % 60}s`}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-brand-dark-grey border border-gray-800 overflow-hidden">
              <div 
                className="h-full bg-brand-yellow transition-all duration-300 progress-glow"
                style={{ width: `${((currentIdx + 1) / activeQuestions.length) * 100}%` }}
              />
            </div>

            {/* Main Challenge Area */}
            <div className="bg-brand-dark-grey border-2 border-black p-6 md:p-8 shadow-hard flex flex-col gap-6 items-stretch">
              
              {/* Question Image (if exists) */}
              {activeQuestions[currentIdx].imagen && (
                <div className="w-full max-h-72 md:max-h-80 bg-white p-4 flex items-center justify-center border border-gray-700 relative overflow-hidden group">
                  <img 
                    src={activeQuestions[currentIdx].imagen.startsWith('data:') ? activeQuestions[currentIdx].imagen : `/imagenes/${activeQuestions[currentIdx].imagen}`}
                    alt="Imagen de Pregunta" 
                    className="max-h-64 md:max-h-72 object-contain transform transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              )}

              {/* Question Text */}
              <div>
                <span className="text-brand-yellow font-brand-heading font-black text-sm uppercase tracking-wide">
                  Pregunta {activeQuestions[currentIdx].id}
                </span>
                <h2 className="text-xl md:text-2xl font-brand-heading font-bold text-white mt-1 leading-snug">
                  {activeQuestions[currentIdx].pregunta}
                </h2>
              </div>

              {/* Options Grid */}
              <div className="flex flex-col gap-3">
                {activeQuestions[currentIdx].opciones.map((option, idx) => {
                  const isSelected = answers[currentIdx] === idx;
                  const isCorrect = idx === activeQuestions[currentIdx].correcta;
                  const isChecked = answeredState[currentIdx];

                  // Color styling based on state
                  let btnStyle = "border-gray-700 hover:border-brand-yellow text-gray-300 hover:text-white bg-black/20";
                  if (isChecked) {
                    if (isCorrect) {
                      btnStyle = "bg-green-950/30 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]";
                    } else if (isSelected) {
                      btnStyle = "bg-red-950/30 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]";
                    } else {
                      btnStyle = "opacity-40 border-gray-800 text-gray-600 scale-[0.99]";
                    }
                  } else if (isSelected) {
                    // Deferred mode: option selected but not corrected
                    btnStyle = "bg-brand-yellow/10 border-brand-yellow text-brand-yellow";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={isChecked}
                      className={`w-full text-left px-5 py-4 border-2 font-bold text-sm md:text-base transition-all duration-200 relative overflow-hidden flex items-center gap-4 ${btnStyle}`}
                    >
                      {/* Option Number Marker */}
                      <span className={`w-8 h-8 rounded-none flex items-center justify-center flex-shrink-0 text-xs font-black border transition-all duration-300 ${
                        isChecked && isCorrect 
                          ? "border-green-500 bg-green-500 text-black" 
                          : isChecked && isSelected && !isCorrect 
                            ? "border-red-500 bg-red-500 text-white" 
                            : isSelected 
                              ? "border-brand-yellow bg-brand-yellow text-brand-navy" 
                              : "border-gray-700 bg-black/40 text-gray-400"
                      }`}>
                        {idx === 0 ? 'A' : idx === 1 ? 'B' : idx === 2 ? 'C' : idx === 3 ? 'D' : idx + 1}
                      </span>
                      <span className="flex-grow">{option}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Correction explanation (Learning Mode only) */}
              {learningMode && answeredState[currentIdx] && (
                <div className="bg-black/40 p-4 border border-gray-800 text-xs text-gray-400 flex items-start gap-3 mt-2">
                  <Info className="w-5 h-5 text-brand-yellow flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider block mb-1">Nota del Simulador</span>
                    La respuesta correcta es la opción <b className="text-brand-yellow">{activeQuestions[currentIdx].opciones[activeQuestions[currentIdx].correcta].charAt(0)}</b>. 
                    Revisa detenidamente y comprende los factores reglamentarios y técnicos exigidos para el transporte de pasajeros (Categoría D1).
                  </div>
                </div>
              )}
            </div>

            {/* Navigation controls */}
            <div className="flex gap-4 items-center justify-between mt-2">
              
              {/* Back navigation (Only in simulator/deferred mode for flexibility, hidden in immediate mode) */}
              {!learningMode ? (
                <button
                  onClick={goToPrevQuestion}
                  disabled={currentIdx === 0}
                  className="border-2 border-black bg-brand-dark-grey text-white hover:bg-gray-800 font-bold px-6 py-3 uppercase tracking-wider text-xs shadow-hard active:translate-y-0.5 active:shadow-none disabled:opacity-30 disabled:pointer-events-none"
                >
                  Anterior
                </button>
              ) : (
                <div />
              )}

              {/* Next/Finish Button */}
              {(!learningMode || answeredState[currentIdx]) ? (
                <button
                  onClick={goToNextQuestion}
                  className="bg-brand-yellow text-brand-navy hover:bg-brand-yellow/90 font-black px-8 py-3.5 uppercase tracking-wider text-sm border-2 border-black shadow-hard active:translate-y-0.5 active:shadow-none flex items-center gap-2 group ml-auto"
                >
                  <span>
                    {currentIdx < activeQuestions.length - 1 ? 'Siguiente Pregunta' : 'Finalizar Examen'}
                  </span>
                  <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <span className="text-xs text-gray-500 uppercase tracking-widest italic animate-pulse ml-auto">
                  Selecciona una opción para avanzar
                </span>
              )}
            </div>

          </div>
        )}

        {/* VIEW 3: RESULTS SCREEN */}
        {view === 'results' && activeQuestions.length > 0 && (
          <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-[fadeIn_0.5s_ease-out]">
            
            {/* Header Performance Ring */}
            <div className={`border-2 border-black p-8 shadow-hard relative text-center overflow-hidden ${examPassedResult ? 'bg-green-950/20 border-green-600/30' : 'bg-red-950/20 border-red-600/30'}`}>
              
              {/* Background Glow */}
              <div className={`absolute inset-0 opacity-10 blur-3xl pointer-events-none rounded-full ${examPassedResult ? 'bg-green-500' : 'bg-red-500'}`} />

              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${examPassedResult ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {examPassedResult ? (
                    <Trophy className="w-10 h-10" />
                  ) : (
                    <AlertTriangle className="w-10 h-10" />
                  )}
                </div>

                <h1 className="text-4xl md:text-6xl font-brand-heading font-black italic tracking-tight uppercase leading-none">
                  {examPassedResult ? '¡EXAMEN APROBADO!' : 'EXAMEN REPROBADO'}
                </h1>
                
                <p className="text-sm text-gray-400 mt-2 max-w-md uppercase tracking-wider font-bold">
                  {examPassedResult 
                    ? "¡Excelente trabajo! Has demostrado los conocimientos técnicos exigidos para conducir vehículos de la categoría D1." 
                    : "No has alcanzado el 90% requerido para aprobar. Sigue estudiando los conceptos clave de seguridad y reglamentación."}
                </p>

                {/* Score Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mt-8 w-full max-w-lg">
                  <div className="bg-black/40 border border-gray-800 p-3 flex flex-col items-center">
                    <span className="text-3xl font-brand-heading font-black text-white">{scorePercent}%</span>
                    <span className="text-[9px] text-gray-500 uppercase font-black mt-1">Precisión</span>
                  </div>
                  <div className="bg-black/40 border border-gray-800 p-3 flex flex-col items-center">
                    <span className="text-3xl font-brand-heading font-black text-green-400">{examCorrectAnswersCount}</span>
                    <span className="text-[9px] text-gray-500 uppercase font-black mt-1">Correctas</span>
                  </div>
                  <div className="bg-black/40 border border-gray-800 p-3 flex flex-col items-center">
                    <span className="text-3xl font-brand-heading font-black text-red-500">{activeQuestions.length - examCorrectAnswersCount}</span>
                    <span className="text-[9px] text-gray-500 uppercase font-black mt-1">Incorrectas</span>
                  </div>
                </div>

                <div className="flex gap-4 justify-center w-full max-w-lg mt-6">
                  <button 
                    onClick={() => startExam(examMode)}
                    className="flex-1 bg-brand-yellow text-brand-navy hover:bg-brand-yellow/90 py-3.5 px-6 font-black uppercase text-sm border-2 border-black shadow-hard active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4 fill-brand-navy" />
                    <span>Reintentar Examen</span>
                  </button>
                  <button 
                    onClick={() => setView('dashboard')}
                    className="flex-1 bg-brand-dark-grey text-white hover:bg-gray-800 py-3.5 px-6 font-black uppercase text-sm border-2 border-black shadow-hard active:translate-y-0.5 active:shadow-none"
                  >
                    Volver al Panel
                  </button>
                </div>
              </div>
            </div>

            {/* Detailed Questions Review List */}
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-brand-heading font-black italic uppercase tracking-tighter text-white">
                Revisión Detallada del Examen
              </h2>

              <div className="flex flex-col gap-4">
                {activeQuestions.map((q, idx) => {
                  const selectedIdx = answers[idx];
                  const isCorrect = selectedIdx === q.correcta;

                  return (
                    <div 
                      key={idx}
                      className={`border-2 border-black p-5 bg-brand-dark-grey/40 backdrop-blur-sm relative overflow-hidden flex flex-col gap-4 ${isCorrect ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}
                    >
                      {/* Top Bar inside question review card */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] bg-black/40 border border-gray-800 text-gray-400 font-bold px-2 py-0.5 uppercase tracking-widest">
                          Pregunta {idx + 1} (Pregunta {q.id} Oficial)
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {isCorrect ? (
                            <span className="text-xs text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-4.5 h-4.5 text-green-400" /> Correcta
                            </span>
                          ) : (
                            <span className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              <XCircle className="w-4.5 h-4.5 text-red-400" /> Incorrecta
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question Content */}
                      <div className="flex flex-col md:flex-row gap-4 items-start">
                        {/* Image inside review if present */}
                        {q.imagen && (
                          <div className="w-24 h-24 md:w-32 md:h-32 bg-white p-2 border border-gray-700 flex-shrink-0 flex items-center justify-center">
                            <img 
                              src={q.imagen.startsWith('data:') ? q.imagen : `/imagenes/${q.imagen}`}
                              alt="Review Sign"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        )}

                        <div className="flex-grow">
                          <p className="text-sm font-bold text-white leading-relaxed">{q.pregunta}</p>
                          
                          {/* Options details */}
                          <div className="mt-3 flex flex-col gap-1.5 text-xs">
                            {q.opciones.map((option, optIdx) => {
                              const wasSelected = selectedIdx === optIdx;
                              const isCorrectOption = optIdx === q.correcta;

                              let labelStyle = "text-gray-400";
                              if (isCorrectOption) labelStyle = "text-green-400 font-bold";
                              else if (wasSelected && !isCorrectOption) labelStyle = "text-red-400 font-bold line-through";

                              return (
                                <div key={optIdx} className="flex gap-2 items-center">
                                  <span className={`w-5 h-5 flex items-center justify-center text-[9px] font-bold ${
                                    isCorrectOption 
                                      ? "bg-green-500 text-black font-black" 
                                      : wasSelected 
                                        ? "bg-red-500 text-white font-black" 
                                        : "bg-black/40 border border-gray-800 text-gray-500"
                                  }`}>
                                    {optIdx === 0 ? 'A' : optIdx === 1 ? 'B' : optIdx === 2 ? 'C' : optIdx === 3 ? 'D' : optIdx + 1}
                                  </span>
                                  <span className={labelStyle}>{option}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* CONFIRM ABANDON MODAL */}
      {showAbandonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-dark-grey border-2 border-black p-6 md:p-8 max-w-md w-full shadow-hard animate-[scaleIn_0.3s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 animate-bounce" />
              <h2 className="text-xl md:text-2xl font-brand-heading font-black italic uppercase tracking-tight text-white leading-none">
                ¿Abandonar Examen?
              </h2>
            </div>
            
            <p className="text-sm text-gray-400 mt-4 leading-relaxed">
              Perderás todo tu progreso en este intento y no se registrarán tus aciertos. Esta acción no se puede deshacer.
            </p>

            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={confirmAbandon}
                className="bg-red-600 text-white hover:bg-red-500 px-5 py-2.5 font-bold uppercase text-xs border-2 border-black shadow-hard active:translate-y-0.5 active:shadow-none"
              >
                Sí, Abandonar
              </button>
              <button 
                onClick={() => setShowAbandonConfirm(false)}
                className="bg-brand-dark-grey text-white border border-gray-700 hover:bg-gray-800 px-5 py-2.5 font-bold uppercase text-xs"
              >
                Cancelar y Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t-2 border-black bg-brand-navy py-8 px-6 text-center text-xs text-gray-500 mt-12 relative z-10 flex flex-col items-center justify-center">
        <img 
          src={logoBase64} 
          alt="Logo BA" 
          className="h-16 mx-auto mb-3 object-contain"
        />
        <p className="font-brand-heading font-black italic tracking-wide text-white text-sm uppercase">
          DIRECCIÓN GENERAL DE SEGURIDAD VIAL
        </p>
        <p className="font-brand-heading font-black italic tracking-wide text-brand-yellow text-xs uppercase mb-3">
          GERENCIA DE EDUCACIÓN Y CONVIVENCIA VIAL
        </p>
      </footer>
    </div>
  );
}
