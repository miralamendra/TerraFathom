import { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Key, Trash2, Loader2 } from 'lucide-react';
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
  const bottomOpen = useUIStore((s) => s.bottomDrawerOpen);
  const bottomHeight = useUIStore((s) => s.bottomDrawerHeight);

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
        className="space-y-1.5 text-xs text-text-secondary leading-relaxed break-words"
        dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br />') }}
      />
    );
  };

  const bottomOffset = bottomOpen ? bottomHeight + 16 : 16;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={toggleChat}
        style={{ bottom: bottomOffset }}
        className={`absolute right-4 z-30 w-8 h-8 rounded-full shadow-floating flex items-center justify-center cursor-pointer transition-all active:scale-95 border border-border-primary bg-bg-elevated text-[#C8A46A] hover:bg-bg-hover hover:text-text-primary ${
          isChatOpen ? 'bg-bg-active border-[#C8A46A]/50' : ''
        }`}
        title="TerraFathom AI Assistant"
      >
        <Bot size={16} />
      </button>

      {/* Floating Chat Dialog */}
      {isChatOpen && (
        <div 
          style={{ bottom: bottomOffset + 40 }}
          className="absolute right-4 w-80 md:w-96 h-[460px] bg-bg-secondary border border-border-primary rounded-control shadow-floating flex flex-col z-35 backdrop-blur-md select-none overflow-hidden"
        >
          {/* Dialog Header */}
          <div className="h-12 border-b border-border-primary px-4 flex items-center justify-between shrink-0 bg-bg-secondary">
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-[#C8A46A]" />
              <span className="font-semibold text-[10px] tracking-wider text-text-primary uppercase">
                TerraFathom AI Assistant
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                title="Configure API key / Model"
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <Key size={13} />
              </button>
              <button
                type="button"
                onClick={toggleChat}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Configurations panel */}
          {showConfig && (
            <div className="bg-[#171717]/95 p-3 border-b border-border-primary flex flex-col gap-3 shrink-0">
              <div>
                <label className="text-[9px] font-medium text-text-tertiary block mb-1 uppercase">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste AI API Key..."
                  className="w-full h-8 px-2 bg-[#111111] border border-border-primary rounded-control text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#C8A46A]/50"
                />
              </div>
              <div>
                <label className="text-[9px] font-medium text-text-tertiary block mb-1 uppercase">
                  Model Selection
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full h-8 px-2 bg-[#111111] border border-[#2B2B2B] rounded-control text-xs text-text-primary outline-none cursor-pointer"
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
                className="h-7 border border-[#2B2B2B] hover:bg-[#2B2B2B]/20 text-[10px] font-medium rounded-control flex items-center justify-center gap-1.5 cursor-pointer text-red-400"
              >
                <Trash2 size={12} />
                <span>Reset History</span>
              </button>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-secondary">
            {/* Initial message */}
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#C8A46A]/10 border border-[#C8A46A]/20 flex items-center justify-center shrink-0">
                <Bot size={12} className="text-[#C8A46A]" />
              </div>
              <div className="flex-1">
                <div className="text-[9px] text-text-tertiary font-mono mb-0.5">TerraFathom AI</div>
                <div className="text-xs text-text-secondary leading-relaxed bg-[#171717] border border-[#2B2B2B]/50 p-2.5 rounded-control shadow-tight">
                  Hello! I am TerraFathom AI. I have access to your active map viewport coordinates and all loaded datasets. Ask me details about this workspace!
                </div>
              </div>
            </div>

            {/* History Messages */}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className="flex gap-2">
                {msg.role === 'model' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-[#C8A46A]/10 border border-[#C8A46A]/20 flex items-center justify-center shrink-0">
                      <Bot size={12} className="text-[#C8A46A]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[9px] text-text-tertiary font-mono mb-0.5">TerraFathom AI</div>
                      <div className="bg-[#171717] border border-[#2B2B2B]/50 p-2.5 rounded-control shadow-tight">
                        {renderMessageContent(msg.parts[0].text)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-end pl-8">
                    <div className="text-[9px] text-text-tertiary font-mono mb-0.5">User</div>
                    <div className="bg-[#ECE8E1] text-[#111111] p-2.5 rounded-control shadow-tight text-xs font-normal">
                      {msg.parts[0].text}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading placeholder */}
            {isChatLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-[#C8A46A]/10 border border-[#C8A46A]/20 flex items-center justify-center shrink-0">
                  <Bot size={12} className="text-[#C8A46A]" />
                </div>
                <div className="flex-1">
                  <div className="text-[9px] text-text-tertiary font-mono mb-0.5">TerraFathom AI</div>
                  <div className="bg-[#171717] border border-[#2B2B2B]/50 p-2.5 rounded-control shadow-tight flex items-center gap-2 text-xs text-text-tertiary">
                    <Loader2 size={11} className="animate-spin text-[#C8A46A]" />
                    <span>Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form 
            onSubmit={handleSend}
            className="h-14 border-t border-border-primary px-3 flex items-center gap-2 shrink-0 bg-bg-secondary"
          >
            <input
              type="text"
              value={inputMsg}
              disabled={isChatLoading}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask AI details about this map..."
              className="flex-1 h-9 px-3 bg-[#111111] border border-border-primary rounded-control text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-[#C8A46A]/50"
            />
            <button
              type="submit"
              disabled={isChatLoading || !inputMsg.trim()}
              className="w-9 h-9 bg-[#ECE8E1] text-[#111111] disabled:opacity-30 disabled:cursor-not-allowed rounded-control flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default AIChatbot;
