import { useState, useEffect, useRef } from 'react';
import { Key, Trash2, Loader2, Send, ChevronDown, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useMapStore } from '@/stores/map-store';
import { Input } from '@/components/ui';
import { toast } from 'sonner';

export function AIChatbot() {
  const isChatOpen = useUIStore((s) => s.isChatOpen);
  const toggleChat = useUIStore((s) => s.toggleChat);
  const apiKey = useUIStore((s) => s.geminiApiKey);
  const setApiKey = useUIStore((s) => s.setGeminiApiKey);
  const model = useUIStore((s) => s.selectedChatModel);
  const setModel = useUIStore((s) => s.setSelectedChatModel);

  const chatHistory = useUIStore((s) => s.chatHistory);
  const addChatMessage = useUIStore((s) => s.addChatMessage);
  const clearChatHistory = useUIStore((s) => s.clearChatHistory);
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const setChatLoading = useUIStore((s) => s.setChatLoading);

  const datasets = useDataStore((s) => s.datasets);
  const mapState = useMapStore.getState();

  const [inputMsg, setInputMsg] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && !apiKey) {
      setApiKey(envKey);
    }
  }, [apiKey, setApiKey]);

  useEffect(() => {
    if (apiKey) {
      setShowConfig(false);
    }
  }, [apiKey]);

  const hasKeyConfigured = Boolean(apiKey);

  // Auto-scroll chat window to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    if (!apiKey) {
      toast.error('No API key is available. Enter your Gemini API key in the settings panel if you need to use the chat.');
      return;
    }

    const promptText = inputMsg;
    setInputMsg('');
    
    // Add user message to history
    addChatMessage('user', promptText);
    setChatLoading(true);

    try {
      // 1. Gather map & dataset context to inject
      const datasetContext = Object.values(datasets).map((d) => (
        `- Name: "${d.name}", format: "${d.format}", fields: [${d.fields.map(f => f.name).join(', ')}], rowCount: ${d.rowCount}`
      )).join('\n');

      const systemPrompt = `You are TerraFathom AI, a high-precision GIS assistant.
Current Workspace Context:
- Latitude: ${mapState.latitude.toFixed(6)}
- Longitude: ${mapState.longitude.toFixed(6)}
- Zoom level: ${mapState.zoom.toFixed(2)}
- 3D View mode: ${mapState.is3D ? 'Enabled' : 'Disabled'}
Active Datasets:
${datasetContext || 'No datasets loaded.'}

Answer user queries with extreme conciseness and geographic accuracy. Use bullet points or markdown tables when describing datasets. Avoid introductory filler words.`;

      // 2. Prepare request contents matching Gemini API format
      const formattedHistory = chatHistory.map((h) => ({
        role: h.role,
        parts: h.parts
      }));

      // Add current message to the payload history
      formattedHistory.push({
        role: 'user',
        parts: [{ text: promptText }]
      });

      const requestBody = {
        contents: formattedHistory,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.2, // Low temp for precise, factual responses
          maxOutputTokens: 800
        }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP ${response.status} Error`);
      }

      const responseData = await response.json();
      const modelResponseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!modelResponseText) {
        throw new Error('No text returned from model API.');
      }

      addChatMessage('model', modelResponseText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to query AI assistant';
      toast.error(msg);
      addChatMessage('model', `**Error**: ${msg}`);
    } finally {
      setChatLoading(false);
    }
  };

  // Basic markdown-like parser helper
  const renderMessageContent = (text: string) => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`(.*?)`/g, '<code class="bg-bg-tertiary px-1 py-0.5 rounded text-[#C8A46A] font-mono text-[10px]">$1</code>');
    html = html.replace(/^\s*-\s+(.*?)$/gm, '<li class="ml-4 list-disc text-text-secondary">$1</li>');

    return (
      <span 
        className="text-text-secondary leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br />') }}
      />
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 mt-2 select-none font-sans text-xs">
      
      {/* Section Header */}
      <div 
        onClick={toggleChat}
        className="flex items-center justify-between h-6 cursor-pointer mb-1 px-2 select-none"
      >
        <div className="flex items-center gap-1.5">
          {isChatOpen ? <ChevronDown size={12} className="text-text-tertiary" /> : <ChevronRight size={12} className="text-text-tertiary" />}
          <span className="text-[13px] font-semibold text-text-primary tracking-tight">
            TerraFathom AI
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isChatOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowConfig(!showConfig);
              }}
              title="Configure settings"
              className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            >
              <Key size={11} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Settings configuration panel */}
      {isChatOpen && showConfig && (
        <div className="mx-2 bg-[#171717]/80 p-2.5 border border-border-primary/50 rounded-control flex flex-col gap-2 shrink-0 animate-fade-in">
          <div>
            <label className="text-[9px] font-semibold text-text-tertiary block mb-1 uppercase tracking-wider">
              Gemini API Key
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste Key..."
              className="h-8 text-xs bg-[#111111]"
            />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-text-tertiary block mb-1 uppercase tracking-wider">
              Model Model Selection
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-8 px-2 bg-[#111111] border border-border-primary rounded-control text-xs text-text-primary outline-none cursor-pointer focus:border-border-focus"
            >
              <option value="gemini-2.5-flash">Gemma 4 31B (gemini-2.5-flash)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemma-2-27b-it">Gemma 2 27B</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              clearChatHistory();
              toast.success('Conversation history reset');
            }}
            className="h-7 border border-border-primary hover:bg-[#2B2B2B]/20 text-[10px] font-medium rounded-control flex items-center justify-center gap-1 cursor-pointer text-red-400/80 transition-colors"
          >
            <Trash2 size={11} />
            <span>Reset History</span>
          </button>
        </div>
      )}

      {/* Expanded Transcript Chatbox */}
      {isChatOpen && (
        <div className="flex-1 min-h-0 flex flex-col gap-2.5 animate-fade-in px-2">
          
          {/* Model Selector Bar */}
          <div className="flex items-center justify-between pb-1 px-1 select-none">
            <span className="text-[9px] text-text-tertiary font-bold uppercase tracking-wider">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-transparent border-0 text-[10px] font-semibold text-[#C8A46A] outline-none cursor-pointer hover:text-[#C8A46A]/80 transition-colors"
            >
              <option value="gemini-2.5-flash" className="bg-[#171717] text-text-primary">Gemma 4 31B</option>
              <option value="gemini-2.5-pro" className="bg-[#171717] text-text-primary">Gemini 2.5 Pro</option>
              <option value="gemini-1.5-flash" className="bg-[#171717] text-text-primary">Gemini 1.5 Flash</option>
              <option value="gemma-2-27b-it" className="bg-[#171717] text-text-primary">Gemma 2 27B</option>
            </select>
          </div>
          
          {/* Scroll Area containing log output */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 border border-border-primary bg-bg-tertiary/10 rounded-control space-y-3.5 flex flex-col scrollbar-thin">
            {/* Initial welcome message */}
            <div className="space-y-0.5 text-xs">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-[#C8A46A]">
                TerraFathom AI
              </div>
              <div className="text-text-secondary leading-relaxed pl-0 bg-transparent">
                {hasKeyConfigured
                  ? 'Hello! Ask me spatial queries about your loaded layers and coordinates.'
                  : 'Enter your Gemini API key in the settings panel if you want to use chat.'}
              </div>
            </div>

            {/* Conversational transcript elements */}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className="space-y-0.5 animate-fade-in text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] uppercase tracking-wider font-semibold ${
                    msg.role === 'model' ? 'text-[#C8A46A]' : 'text-text-tertiary'
                  }`}>
                    {msg.role === 'model' ? 'TerraFathom AI' : 'Consultant'}
                  </span>
                </div>
                <div className="text-text-secondary leading-relaxed">
                  {msg.role === 'model' ? renderMessageContent(msg.parts[0].text) : msg.parts[0].text}
                </div>
              </div>
            ))}

            {/* Think Loading placeholder */}
            {isChatLoading && (
              <div className="space-y-0.5 text-xs animate-pulse">
                <div className="text-[9px] uppercase tracking-wider font-semibold text-[#C8A46A]">
                  TerraFathom AI
                </div>
                <div className="flex items-center gap-1.5 text-text-tertiary">
                  <Loader2 size={10} className="animate-spin text-[#C8A46A]" />
                  <span className="italic font-light">Analyzing viewport parameters...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Inline Chat form */}
          <form onSubmit={handleSend} className="flex gap-2 shrink-0 items-center">
            <Input
              type="text"
              value={inputMsg}
              disabled={isChatLoading}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Query workspace..."
              className="flex-1 h-8 text-xs bg-bg-tertiary"
            />
            <button
              type="submit"
              disabled={isChatLoading || !inputMsg.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-control border border-border-primary hover:border-[#C8A46A]/50 bg-bg-tertiary/20 text-[#C8A46A] hover:bg-[#C8A46A]/5 transition-colors cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <Send size={11} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default AIChatbot;
