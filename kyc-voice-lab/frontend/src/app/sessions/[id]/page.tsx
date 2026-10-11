"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Check,
  Ban,
  User,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  AnswerAttempt,
  Customer,
  Question,
  SessionWithCustomer,
  VerificationOutcome,
} from "@/types";
import { formatSeconds } from "@/lib/utils";

export default function CallSimulatorPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<SessionWithCustomer | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio recording state
  const [micPermission, setMicPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");

  // Last answer attempt for the current question
  const [latestAnswer, setLatestAnswer] = useState<AnswerAttempt | null>(null);
  const [attemptCount, setAttemptCount] = useState<number>(0);

  // Audio references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone permissions on mount
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          setMicPermission(permissionStatus.state as any);
          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state as any);
          };
        })
        .catch(() => {});
    }
  }, []);

  // Fetch session and question data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sData, qData] = await Promise.all([
        api.getSession(sessionId),
        api.getSessionQuestions(sessionId),
      ]);
      setSessionData(sData);
      setQuestions(qData);
      setCurrentQIndex(sData.current_question_index || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load session details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const currentQuestion = questions[currentQIndex];
  const isLastQuestion = currentQIndex === questions.length - 1;

  // Speak prompt text via Web Speech API or audio playback
  const playPromptAudio = () => {
    if (!currentQuestion) return;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt_text);
      utterance.lang = "en-IN"; // English with natural cadence
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Start recording answer
  const startRecording = async () => {
    setError(null);
    setLatestAnswer(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      setMicPermission("granted");

      // Pick supported mime type
      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      let selectedMime = "";
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: selectedMime || "audio/webm",
        });

        if (audioBlob.size === 0) {
          setError("Empty audio recording detected. Please speak into the microphone.");
          setIsProcessing(false);
          return;
        }

        await handleAudioSubmission(audioBlob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // Collect slice every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setMicPermission("denied");
        setError("Microphone permission was denied. Please allow microphone access in your browser.");
      } else {
        setError(`Microphone error: ${e.message}`);
      }
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      setIsRecording(false);
      setIsProcessing(true);
      setProcessingStep("Uploading audio recording...");
      mediaRecorderRef.current.stop();
    }
  };

  // Upload and Transcribe audio
  const handleAudioSubmission = async (audioBlob: Blob) => {
    if (!currentQuestion) return;

    try {
      setIsProcessing(true);
      setProcessingStep("Uploading audio recording to local server...");

      // 1. Submit answer recording
      const answerAttempt = await api.submitAnswer(
        sessionId,
        currentQuestion.index,
        currentQuestion.field,
        currentQuestion.type,
        audioBlob
      );

      // 2. Transcribe locally via faster-whisper
      setProcessingStep("Transcribing speech locally (faster-whisper CPU)...");
      const transcribedAnswer = await api.transcribeAnswer(sessionId, answerAttempt.id);

      setLatestAnswer(transcribedAnswer);
      setAttemptCount((prev) => prev + 1);
      setProcessingStep("");
    } catch (e: any) {
      setError(e.message || "Failed to process audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Move to next question
  const handleNextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
      setLatestAnswer(null);
      setAttemptCount(0);
      setError(null);
    }
  };

  // Complete entire session
  const handleCompleteSession = async () => {
    try {
      setIsProcessing(true);
      setProcessingStep("Evaluating final KYC verification outcome...");
      await api.completeSession(sessionId);
      router.push(`/results/${sessionId}`);
    } catch (e: any) {
      setError(e.message || "Failed to complete verification session.");
      setIsProcessing(false);
    }
  };

  // Cancel session
  const handleCancelSession = async () => {
    if (!confirm("Are you sure you want to cancel this verification session? It will be marked INCOMPLETE."))
      return;
    try {
      await api.cancelSession(sessionId);
      router.push(`/results/${sessionId}`);
    } catch (e: any) {
      alert(`Cancellation failed: ${e.message}`);
    }
  };

  const getOutcomeBadge = (outcome?: VerificationOutcome | null) => {
    if (!outcome) return null;
    switch (outcome) {
      case "MATCH":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> MATCH
          </span>
        );
      case "MISMATCH":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-400 border border-rose-800">
            <XCircle className="w-3.5 h-3.5" /> MISMATCH
          </span>
        );
      case "NEEDS_CLARIFICATION":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-400 border border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" /> NEEDS CLARIFICATION
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5" /> {outcome}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Initializing simulated call session...</p>
      </div>
    );
  }

  if (error && !sessionData) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-rose-950/40 border border-rose-800 rounded-2xl text-center space-y-4">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Session Unavailable</h2>
        <p className="text-sm text-rose-300">{error}</p>
        <button
          onClick={() => router.push("/sessions/new")}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
        >
          Return to Launcher
        </button>
      </div>
    );
  }

  const customer = sessionData?.customer;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Session Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <User className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-400">Customer Under Verification:</span>{" "}
            <strong className="text-white text-sm">{customer?.full_name}</strong>{" "}
            <span className="font-mono text-slate-500">({customer?.id})</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono">
            Session: <code className="text-slate-300">{sessionId.slice(0, 8)}...</code>
          </span>
          <button
            onClick={handleCancelSession}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700 transition"
          >
            <Ban className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Question <strong>{currentQIndex + 1}</strong> of <strong>{questions.length}</strong>
          </span>
          <span>{Math.round(((currentQIndex + 1) / questions.length) * 100)}% Complete</span>
        </div>
        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          {error}
        </div>
      )}

      {/* Main Call Simulator Stage */}
      <div className="p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 space-y-8 relative overflow-hidden">
        {/* Background glow when recording */}
        {isRecording && (
          <div className="absolute inset-0 bg-rose-500/5 animate-pulse pointer-events-none" />
        )}

        {/* Question Header & Prompt Box */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-blue-950 border border-blue-800 text-blue-400 uppercase">
              Field: {currentQuestion?.field}
            </span>
            <button
              onClick={playPromptAudio}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              title="Play question audio aloud"
            >
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              Listen Prompt
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
            <p className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
              &ldquo;{currentQuestion?.prompt_text}&rdquo;
            </p>
          </div>
        </div>

        {/* Microphone Recording Controls */}
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          {isRecording ? (
            <div className="space-y-4 text-center">
              <button
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-600/40 animate-pulse transition mx-auto"
                title="Stop recording"
              >
                <Square className="w-8 h-8 fill-current" />
              </button>
              <div className="flex items-center justify-center gap-2 text-rose-400 font-mono text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                Recording Answer... 00:0{recordingSeconds}s
              </div>
            </div>
          ) : isProcessing ? (
            <div className="space-y-3 text-center py-4">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-300 font-mono">{processingStep}</p>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <button
                onClick={startRecording}
                disabled={isProcessing}
                className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center text-white shadow-xl shadow-blue-600/40 hover:scale-105 transition mx-auto"
                title="Start speaking answer"
              >
                <Mic className="w-8 h-8" />
              </button>
              <p className="text-xs text-slate-400">
                Click microphone to record your spoken answer
              </p>
            </div>
          )}

          {micPermission === "denied" && (
            <p className="text-xs text-rose-400 font-mono">
              ⚠️ Microphone blocked. Please permit mic access in your browser address bar.
            </p>
          )}
        </div>

        {/* Real-time Transcription & Verification Outcome Display */}
        {latestAnswer && (
          <div className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Recognised Speech (Attempt #{latestAnswer.attempt_number})
                </span>
              </div>
              {getOutcomeBadge(latestAnswer.outcome)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-mono">Raw Transcript:</span>
                <p className="text-sm font-mono text-slate-200 p-3 rounded-lg bg-slate-900 border border-slate-800">
                  {latestAnswer.transcript || "(No speech detected)"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-mono">Normalised Answer:</span>
                <p className="text-sm font-mono text-slate-200 p-3 rounded-lg bg-slate-900 border border-slate-800">
                  {latestAnswer.normalised_answer || "—"}
                </p>
              </div>
            </div>

            {/* Verification Reason & Durations */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-slate-300">
                <strong>Verdict Rationale:</strong> {latestAnswer.outcome_reason}
              </span>
              <span className="text-slate-500 font-mono shrink-0">
                STT: {formatSeconds(latestAnswer.transcription_duration_seconds)} | Total: {formatSeconds(latestAnswer.total_processing_seconds)}
              </span>
            </div>
          </div>
        )}

        {/* Footer Actions: Next Question / Retry / Complete */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={startRecording}
              disabled={isRecording || isProcessing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Answer
            </button>
            <button
              onClick={playPromptAudio}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Repeat Question
            </button>
          </div>

          <div>
            {isLastQuestion ? (
              <button
                onClick={handleCompleteSession}
                disabled={isRecording || isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition"
              >
                <Check className="w-4 h-4" />
                Finish Call & Generate Audit
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={isRecording || isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition"
              >
                Next Question
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
