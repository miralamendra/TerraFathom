import { useState, useEffect, useRef } from 'react';
import { Bot, Key, Trash2, Loader2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useMapStore } from '@/stores/map-store';
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

  // Auto-scroll chat window to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isChatLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    if (!apiKey) {
      toast.error('Please enter a valid Gemini API Key in the chat settings.');
      setShowConfig(true);
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
    html = html.replace(/`(.*?)`/g, '<code class="bg-[#2B2B2B] px-1 py-0.5 rounded text-[#C8A46A] font-mono text-[10px]">$1</code>');
    html = html.replace(/^\s*-\s+(.*?)$/gm, '<li class="ml-4 list-disc text-text-secondary">$1</li>');

    return (
      <div 
        className="space-y-1 text-xs text-text-secondary leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br />') }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2 mt-4 px-2 select-none">
      
      {/* Section Header */}
      <div className="flex items-center justify-between h-6 border-b border-border-primary/30 pb-2">
        <div className="flex items-center gap-1.5 cursor-pointer" onClick={toggleChat}>
          <Bot size={13} className="text-[#C8A46A]" />
          <span className="text-[13px] font-semibold text-text-primary tracking-tight">
            AI Assistant
          </span>
          {isChatOpen ? <ChevronUp size={12} className="text-text-tertiary" /> : <ChevronDown size={12} className="text-text-tertiary" />}
        </div>
        
        {isChatOpen && (
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            title="Configure settings"
            className="w-5 h-5 flex items-center justify-center rounded-[4px] hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          >
            <Key size={11} />
          </button>
        )}
      </div>

      {/* Configurations panel */}
      {isChatOpen && showConfig && (
        <div className="bg-[#171717] p-2.5 border border-border-primary/50 rounded-control flex flex-col gap-2 shrink-0">
          <div>
            <label className="text-[9px] font-semibold text-text-tertiary block mb-1 uppercase">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste API Key..."
              className="w-full h-7 px-2 bg-[#111111] border border-border-primary rounded-control text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#C8A46A]/50"
            />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-text-tertiary block mb-1 uppercase">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-7 px-2 bg-[#111111] border border-[#2B2B2B] rounded-control text-xs text-text-primary outline-none cursor-pointer"
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
            className="h-6 border border-[#2B2B2B] hover:bg-[#2B2B2B]/20 text-[10px] font-medium rounded-control flex items-center justify-center gap-1 cursor-pointer text-red-400"
          >
            <Trash2 size={11} />
            <span>Reset History</span>
          </button>
        </div>
      )}

      {/* Expanded Chat Drawer */}
      {isChatOpen && (
        <div className="flex flex-col gap-2">
          {/* Messages Scroll Area */}
          <div className="h-[250px] overflow-y-auto p-2 border border-border-primary/50 bg-[#171717]/40 rounded-control space-y-3 flex flex-col">
            {/* Initial welcome message */}
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-[#C8A46A]/10 border border-[#C8A46A]/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={11} className="text-[#C8A46A]" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-text-secondary leading-relaxed bg-[#171717]/80 p-2 rounded border border-[#2B2B2B]/40">
                  Hello! Ask me spatial queries about your loaded layers and coordinates.
                </div>
              </div>
            </div>

            {/* History Messages */}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className="flex gap-2">
                {msg.role === 'model' ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-[#C8A46A]/10 border border-[#C8A46A]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={11} className="text-[#C8A46A]" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-[#171717]/80 p-2 rounded border border-[#2B2B2B]/40">
                        {renderMessageContent(msg.parts[0].text)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-end pl-6">
                    <div className="bg-[#ECE8E1] text-[#111111] p-2 rounded text-xs font-normal">
                      {msg.parts[0].text}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading placeholder */}
            {isChatLoading && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-[#C8A46A]/10 border border-[#C8A46A]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={11} className="text-[#C8A46A]" />
                </div>
                <div className="flex-1">
                  <div className="bg-[#171717]/80 p-2 rounded border border-[#2B2B2B]/40 flex items-center gap-1.5 text-xs text-text-tertiary">
                    <Loader2 size={10} className="animate-spin text-[#C8A46A]" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Form */}
          <form onSubmit={handleSend} className="flex gap-1.5 shrink-0">
            <input
              type="text"
              value={inputMsg}
              disabled={isChatLoading}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask AI details..."
              className="flex-1 h-8 px-2 bg-[#111111] border border-border-primary rounded-control text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#C8A46A]/50"
            />
            <button
              type="submit"
              disabled={isChatLoading || !inputMsg.trim()}
              className="w-8 h-8 bg-[#ECE8E1] text-[#111111] disabled:opacity-30 disabled:cursor-not-allowed rounded-control flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
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
