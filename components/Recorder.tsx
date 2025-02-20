'use client';

import { useEffect, useState, useRef } from 'react';

declare global {
  interface Window {
    assemblyai: any;
  }
}

export default function Recorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [rt, setRt] = useState<any>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load saved transcripts when component mounts
  useEffect(() => {
    const savedTranscript = localStorage.getItem('transcript');
    const savedTranslation = localStorage.getItem('translation');
    if (savedTranscript) setTranscript(savedTranscript);
    if (savedTranslation) setTranslation(savedTranslation);
  }, []);

  // Save transcripts whenever they change
  useEffect(() => {
    if (transcript) localStorage.setItem('transcript', transcript);
  }, [transcript]);

  useEffect(() => {
    if (translation) localStorage.setItem('translation', translation);
  }, [translation]);

  useEffect(() => {
    // Load AssemblyAI script
    const script = document.createElement('script');
    script.src = 'https://www.unpkg.com/assemblyai@latest/dist/assemblyai.umd.min.js';
    script.async = true;
    
    // Add onload handler
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const clearTranscripts = () => {
    setTranscript('');
    setTranslation('');
    localStorage.removeItem('transcript');
    localStorage.removeItem('translation');
  };

  const handleRecord = async () => {
    if (!isScriptLoaded) {
      alert('Please wait for initialization to complete...');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      
      try {
        // Stop recording
        if (rt) {
          await rt.close(false);
          setRt(null);
        }

        if (workletNodeRef.current) {
          workletNodeRef.current.disconnect();
          workletNodeRef.current = null;
        }

        if (sourceNodeRef.current) {
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    } else {
      setIsInitializing(true);
      try {
        // Get token
        const response = await fetch('/api/token', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Token error:', errorData);
          alert('Failed to initialize recording: ' + (errorData.error || 'Unknown error'));
          return;
        }

        const data = await response.json();

        if (!data.token) {
          console.error('No token received from API');
          alert('Failed to initialize recording: No token received');
          return;
        }

        // Initialize AssemblyAI real-time service
        const rtService = new window.assemblyai.RealtimeService({ token: data.token });
        
        const texts: Record<string, string> = {};
        let currentTranscript = transcript;

        rtService.on('transcript', async (message: any) => {
          if (message.message_type === 'PartialTranscript') {
            // For partial transcripts, only show the current segment
            setTranscript(currentTranscript + ' ' + message.text);
          } else if (message.message_type === 'FinalTranscript') {
            // For final transcripts, append and save
            currentTranscript += ' ' + message.text;
            setTranscript(currentTranscript);

            // Handle translation
            try {
              const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: message.text,
                  target_lang: (document.getElementById('translation-language') as HTMLSelectElement).value,
                }),
              });
              const data = await response.json();
              setTranslation(prev => prev + ' ' + data.translation.text);
            } catch (error) {
              console.error('Translation error:', error);
            }
          }
        });

        rtService.on('error', (error: any) => {
          console.error('AssemblyAI error:', error);
        });

        await rtService.connect();
        setRt(rtService);

        // Set up audio context and nodes
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        streamRef.current = stream;

        const audioContext = new AudioContext({
          sampleRate: 16000,
          latencyHint: 'interactive'
        });
        audioContextRef.current = audioContext;

        // Load and register the audio worklet
        await audioContext.audioWorklet.addModule('/audioProcessor.js');

        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNodeRef.current = sourceNode;

        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
        workletNodeRef.current = workletNode;

        // Handle processed audio data
        workletNode.port.onmessage = (event) => {
          if (rtService) {
            rtService.sendAudio(event.data);
          }
        };

        // Connect the nodes
        sourceNode.connect(workletNode);
        workletNode.connect(audioContext.destination);
        
        setIsRecording(true);
      } catch (error) {
        console.error('Recording initialization error:', error);
        alert('Failed to initialize recording. Please try again.');
      } finally {
        setIsInitializing(false);
      }
    }
  };

  return (
    <>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="transcript" className="block text-sm font-medium text-gray-900">
            Transcript
          </label>
          <button
            onClick={clearTranscripts}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Clear All
          </button>
        </div>
        <textarea
          id="transcript"
          value={transcript}
          readOnly
          rows={20}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 bg-white"
        />
      </div>
      <div className="flex-1">
        <label htmlFor="translation" className="block text-sm font-medium text-gray-900">
          Translation
        </label>
        <select
          id="translation-language"
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 bg-white"
        >
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh">Chinese</option>
        </select>
        <textarea
          id="translation"
          value={translation}
          readOnly
          rows={18}
          className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 bg-white"
        />
      </div>
      <button
        onClick={handleRecord}
        disabled={isInitializing || !isScriptLoaded}
        className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-2 rounded-md shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
          ${(isInitializing || !isScriptLoaded)
            ? 'bg-blue-400 cursor-wait' 
            : 'bg-blue-500 hover:bg-blue-600'} 
          text-white`}
      >
        {!isScriptLoaded ? (
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        ) : isInitializing ? (
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Initializing...</span>
          </div>
        ) : isRecording ? (
          'Stop Recording'
        ) : (
          'Record'
        )}
      </button>
    </>
  );
} 