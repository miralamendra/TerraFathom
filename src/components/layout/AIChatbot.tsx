import { useState, useEffect, useRef } from 'react';
import { Trash2, ArrowUp, Copy, Square, MousePointerClick, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useUIStore } from '@/stores/ui-store';
import { useDataStore } from '@/stores/data-store';
import { useMapStore } from '@/stores/map-store';
import { useLayerStore } from '@/stores/layer-store';
import { fetchAndParseOSMBuildings, fetchAndParseOSMAmenities } from '@/core/data/parsers/osm-parser';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';

interface AIChatbotProps {
  fullPanelMode?: boolean;
}

const MISTRAL_API_KEY = 'Cvl015afU0purMg6UPY9P7KKrHCppJnA';

const cleanMessageText = (text: string) => {
  return text
    .replace(/```action[\s\S]*?```/gi, '')
    .replace(/TerraFathom AI\s*[–\-—]?\s*Enterprise Spatial Intelligence Copilot/gi, '')
    .replace(/Powered by Mistral AI/gi, '')
    .replace(/Powered by Mistral/gi, '')
    .trim();
};

import { loadSampleDataset } from '@/core/data/sample-data';

interface MapAction {
  type: 'TOGGLE_3D' | 'SET_LAYER_CONFIG' | 'FLY_TO_VIEWPORT' | 'FETCH_OSM_BUILDINGS' | 'FETCH_OSM_AMENITIES' | 'LOAD_SAMPLE_DATASET';
  enable?: boolean;
  pitch?: number;
  zoom?: number;
  latitude?: number;
  longitude?: number;
  sampleId?: string;
  config?: Record<string, any>;
  layerId?: string;
}

const parseAndExecuteMapActions = (modelResponseText: string, activeBounds: [number, number, number, number]) => {
  const match = modelResponseText.match(/```action\s*([\s\S]*?)\s*```/i);
  if (!match) return;

  try {
    const actions: MapAction[] = JSON.parse(match[1]);
    if (!Array.isArray(actions)) return;

    for (const action of actions) {
      switch (action.type) {
        case 'LOAD_SAMPLE_DATASET': {
          if (action.sampleId) {
            loadSampleDataset(action.sampleId).catch(() => {});
          }
          break;
        }

        case 'TOGGLE_3D': {
          const isEnable = action.enable ?? true;
          useMapStore.setState({ is3D: isEnable });
          useMapStore.getState().animateViewport({
            pitch: isEnable ? (action.pitch || 55) : 0,
            zoom: Math.max(useMapStore.getState().zoom, 14.5)
          }, 1200);

          useLayerStore.getState().layers.forEach((l) => {
            if (l.type === 'geojson') {
              useLayerStore.getState().updateLayerConfig(l.id, {
                extruded: isEnable,
                elevationScale: action.config?.elevationScale || 1.0
              });
            }
          });
          toast.success(isEnable ? 'Enabled 3D viewport & extruded building polygons' : 'Switched to 2D flat viewport');
          break;
        }

        case 'SET_LAYER_CONFIG': {
          const layers = useLayerStore.getState().layers;
          const targetLayers = action.layerId
            ? layers.filter((l) => l.id === action.layerId)
            : layers;

          targetLayers.forEach((l) => {
            useLayerStore.getState().updateLayerConfig(l.id, action.config || {});
          });
          toast.success(`Updated layer attributes: ${Object.keys(action.config || {}).join(', ')}`);
          break;
        }

        case 'FLY_TO_VIEWPORT': {
          useMapStore.getState().animateViewport({
            latitude: action.latitude || useMapStore.getState().latitude,
            longitude: action.longitude || useMapStore.getState().longitude,
            zoom: action.zoom || useMapStore.getState().zoom,
            pitch: action.pitch !== undefined ? action.pitch : useMapStore.getState().pitch
          }, 1500);
          break;
        }

        case 'FETCH_OSM_BUILDINGS': {
          fetchAndParseOSMBuildings(activeBounds)
            .then((ds) => {
              useDataStore.getState().addDataset(ds);
              useLayerStore.getState().addLayer(ds.id, 'geojson', ds.name, {
                extruded: true,
                elevationScale: 1.0,
                fillColor: [200, 164, 106]
              });
              useMapStore.setState({ is3D: true });
              useMapStore.getState().animateViewport({ pitch: 55 }, 1200);
              toast.success(`Loaded 3D Buildings for selected area`);
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to fetch OSM buildings'));
          break;
        }

        case 'FETCH_OSM_AMENITIES': {
          fetchAndParseOSMAmenities(activeBounds)
            .then((ds) => {
              useDataStore.getState().addDataset(ds);
              useLayerStore.getState().addLayer(ds.id, 'scatterplot', ds.name);
              toast.success(`Loaded ${ds.name} for selected area`);
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : 'Failed to fetch OSM amenities'));
          break;
        }
      }
    }
  } catch {
    // ignore parse errors
  }
};

const extractSuggestedCommands = (text: string): string[] => {
  const commands: string[] = [];
  const lines = text.split('\n');
  let inTrySection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(###?\s*)?(Try|Suggested Commands|Next Steps|Try out|Example Queries):?/i.test(trimmed)) {
      inTrySection = true;
      continue;
    }

    if (inTrySection && (/^[-*]\s+/.test(trimmed) || /^`.*`$/.test(trimmed))) {
      const cleaned = trimmed
        .replace(/^[-*]\s+/, '')
        .replace(/^[`"']|[`"']$/g, '')
        .trim();
      if (cleaned && !commands.includes(cleaned) && cleaned.length < 90) {
        commands.push(cleaned);
      }
    }
  }

  if (commands.length === 0) {
    const matches = text.match(/`([^`]{8,80})`/g);
    if (matches) {
      for (const m of matches) {
        const cmd = m.slice(1, -1).trim();
        if (cmd && !cmd.includes('\n') && !commands.includes(cmd)) {
          commands.push(cmd);
          if (commands.length >= 3) break;
        }
      }
    }
  }

  return commands.slice(0, 3);
};

const AssistantMessage = ({ text, onSelectCommand }: { text: string; onSelectCommand: (cmd: string) => void }) => {
  const cleaned = cleanMessageText(text);
  const suggestedCmds = extractSuggestedCommands(cleaned);

  return (
    <div className="w-full text-[#ECE8E1] bg-transparent border-0 px-1 font-sans select-text group/msg relative">
      <div className="chat-prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {cleaned}
        </ReactMarkdown>
      </div>

      {suggestedCmds.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-wrap gap-2">
          {suggestedCmds.map((cmd, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectCommand(cmd)}
              className="px-3 py-1.5 rounded-lg bg-[#242424] hover:bg-[#2A2A2A] text-xs font-medium text-[#C8A46A] hover:text-[#D4B27B] border border-[#C8A46A]/25 hover:border-[#C8A46A]/50 transition-all cursor-pointer shadow-sm active:scale-95 text-left"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(cleaned);
            toast.success('Response copied to clipboard');
          }}
          title="Copy response"
          className="p-1 px-2 text-text-tertiary hover:text-text-primary rounded bg-[#222] hover:bg-[#2A2A2A] border border-white/[0.06] text-xs flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Copy size={12} />
          <span className="text-[10px] font-medium">Copy</span>
        </button>
      </div>
    </div>
  );
};

export function AIChatbot({ fullPanelMode = true }: AIChatbotProps) {
  const apiKey = MISTRAL_API_KEY;
  const model = useUIStore((s) => s.selectedChatModel);
  const setModel = useUIStore((s) => s.setSelectedChatModel);

  const chatHistory = useUIStore((s) => s.chatHistory);
  const addChatMessage = useUIStore((s) => s.addChatMessage);
  const clearChatHistory = useUIStore((s) => s.clearChatHistory);
  const isChatLoading = useUIStore((s) => s.isChatLoading);
  const setChatLoading = useUIStore((s) => s.setChatLoading);

  const selectionMode = useUIStore((s) => s.selectionMode);
  const setSelectionMode = useUIStore((s) => s.setSelectionMode);
  const selectionCoords = useUIStore((s) => s.selectionCoordinates);

  const datasets = useDataStore((s) => s.datasets);
  const mapState = useMapStore.getState();

  const [inputMsg, setInputMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Compute selected area bounding box
  let selectedBbox: [number, number, number, number] | null = null; // [south, west, north, east]
  if (selectionCoords.length > 0) {
    const lngs = selectionCoords.map((c) => c[0]);
    const lats = selectionCoords.map((c) => c[1]);
    selectedBbox = [
      Math.min(...lats),
      Math.min(...lngs),
      Math.max(...lats),
      Math.max(...lngs)
    ];
  }

  // Auto-scroll chat window to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory.length, isChatLoading]);

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const promptText = queryText;
    setInputMsg('');
    
    // Add user message to history
    addChatMessage('user', promptText);
    setChatLoading(true);

    try {
      const lowerQuery = promptText.toLowerCase();

      // Active bounds (Use drawn area box if available, otherwise calculate from map center)
      const activeBounds: [number, number, number, number] = selectedBbox
        ? selectedBbox
        : [
            mapState.latitude - 0.012,
            mapState.longitude - 0.012,
            mapState.latitude + 0.012,
            mapState.longitude + 0.012
          ];

      // --- NATURAL INTENT INTERPRETER (Client-side immediate map reaction) ---
      
      // Intent A: Make 3D / Extrude Buildings
      const is3DRequest = lowerQuery.includes('3d') || lowerQuery.includes('extrude') || lowerQuery.includes('make it 3d') || lowerQuery.includes('show 3d') || lowerQuery.includes('tilt');
      const is2DRequest = lowerQuery.includes('2d') || lowerQuery.includes('flat') || lowerQuery.includes('top down');

      if (is3DRequest && !is2DRequest) {
        useMapStore.setState({ is3D: true });
        useMapStore.getState().animateViewport({
          pitch: 55,
          zoom: Math.max(useMapStore.getState().zoom, 14.5)
        }, 1200);

        useLayerStore.getState().layers.forEach((l) => {
          if (l.type === 'geojson') {
            useLayerStore.getState().updateLayerConfig(l.id, {
              extruded: true,
              elevationScale: 1.0,
              visible: true
            });
          }
        });
        toast.success('Extruded 3D building layers & tilted viewport camera');
      } else if (is2DRequest) {
        useMapStore.setState({ is3D: false });
        useMapStore.getState().animateViewport({ pitch: 0 }, 1200);
        useLayerStore.getState().layers.forEach((l) => {
          if (l.type === 'geojson') {
            useLayerStore.getState().updateLayerConfig(l.id, { extruded: false });
          }
        });
        toast.info('Switched to 2D flat viewport');
      }

      // Intent B: Fetch 3D OSM Buildings via Overpass API
      if (lowerQuery.includes('building') || lowerQuery.includes('load buildings')) {
        fetchAndParseOSMBuildings(activeBounds)
          .then((ds) => {
            useDataStore.getState().addDataset(ds);
            useLayerStore.getState().addLayer(ds.id, 'geojson', ds.name, {
              extruded: true,
              elevationScale: 1.0,
              fillColor: [200, 164, 106]
            });
            useMapStore.setState({ is3D: true });
            useMapStore.getState().animateViewport({ pitch: 55 }, 1200);
            toast.success(`Loaded ${ds.name} for selected area`);
          })
          .catch((err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to fetch OSM buildings');
          });
      }

      // Intent C: Fetch OSM Amenities via Overpass API
      if (lowerQuery.includes('amenit') || lowerQuery.includes('load amenities')) {
        fetchAndParseOSMAmenities(activeBounds)
          .then((ds) => {
            useDataStore.getState().addDataset(ds);
            useLayerStore.getState().addLayer(ds.id, 'scatterplot', ds.name);
            toast.success(`Loaded ${ds.name} for selected area`);
          })
          .catch((err) => {
            toast.error(err instanceof Error ? err.message : 'Failed to fetch OSM amenities');
          });
      }

      // Intent D: Space Syntax 500m Local Accessibility
      if (
        lowerQuery.includes('500m') ||
        lowerQuery.includes('accessibility') ||
        lowerQuery.includes('local accessibility') ||
        lowerQuery.includes('space syntax local') ||
        lowerQuery.includes('space syntax') ||
        lowerQuery.includes('enable 500m') ||
        lowerQuery.includes('walkability')
      ) {
        loadSampleDataset('sample-space-syntax-500m').catch(() => {});
      }

      // Intent E: Space Syntax 10km Regional Accessibility
      if (
        lowerQuery.includes('10km') ||
        lowerQuery.includes('regional accessibility') ||
        lowerQuery.includes('regional corridor') ||
        lowerQuery.includes('corridor network') ||
        lowerQuery.includes('enable 10km')
      ) {
        loadSampleDataset('sample-space-syntax-10km').catch(() => {});
      }

      // Gather map & dataset context
      const datasetContext = Object.values(datasets).map((d) => (
        `- Dataset "${d.name}": format ${d.format}, ${d.rowCount} rows, columns: [${d.fields.map(f => f.name).join(', ')}]`
      )).join('\n');

      const activeLayers = useLayerStore.getState().layers.map(l => (
        `- Layer "${l.name}": type ${l.type}, visible: ${l.config.visible}, extruded: ${l.config.extruded || false}`
      )).join('\n');

      const selectionContext = selectedBbox
        ? `Spatial Area Selection Active (User drawn bounding box on map interface):
- South (Min Lat): ${selectedBbox[0].toFixed(6)}
- West (Min Lon): ${selectedBbox[1].toFixed(6)}
- North (Max Lat): ${selectedBbox[2].toFixed(6)}
- East (Max Lon): ${selectedBbox[3].toFixed(6)}
Target Analysis Instruction: Focus all building queries, amenity lookups, space syntax analysis, and spatial recommendations ONLY inside this drawn sector.`
        : `Spatial Area Selection: None active (Using current map viewport center [Lat: ${mapState.latitude.toFixed(6)}, Lon: ${mapState.longitude.toFixed(6)}]).`;

      const systemPrompt = `You are TerraFathom AI, an intelligent spatial copilot for Colombo and Western Province.

Workspace Context:
- Latitude: ${mapState.latitude.toFixed(6)}, Longitude: ${mapState.longitude.toFixed(6)}, Zoom: ${mapState.zoom.toFixed(2)}
- 3D Projection: ${mapState.is3D ? 'Enabled' : 'Disabled'}
- Active Panel Mode: ${fullPanelMode ? 'Full' : 'Compact'}
${selectionContext}

Active Datasets:
${datasetContext || 'None loaded'}

Active Map Layers:
${activeLayers || 'None active'}

MAP & UI CONTROLS:
You can directly control the map viewport, 3D projection, building extrusion, camera tilt, layer settings, and dataset loading.
When the user asks you to load accessibility, space syntax, toggle 3D, extrude buildings, or change views, output an \`\`\`action JSON block at the VERY END of your response.

Available Actions:
- Load 500m Local Accessibility Space Syntax:
  \`\`\`action
  [{"type": "LOAD_SAMPLE_DATASET", "sampleId": "sample-space-syntax-500m"}]
  \`\`\`
- Load 10km Regional Corridor Space Syntax:
  \`\`\`action
  [{"type": "LOAD_SAMPLE_DATASET", "sampleId": "sample-space-syntax-10km"}]
  \`\`\`
- Toggle 3D & Extrude Buildings:
  \`\`\`action
  [{"type": "TOGGLE_3D", "enable": true, "pitch": 55}]
  \`\`\`
- Update Layer Properties:
  \`\`\`action
  [{"type": "SET_LAYER_CONFIG", "config": {"extruded": true, "elevationScale": 1.0}}]
  \`\`\`

Tone & Formatting Rules:
- Friendly & Helpful: Be warm, clear, encouraging, and detailed.
- Direct Answer: Start with a clear 1-2 sentence overview.
- Space Syntax Focus: When asked about accessibility or local network analysis, explain Space Syntax Angular Choice (through-movement) and Integration (visual/topological accessibility).
- Suggested Commands: End your response with 3 clickable suggested commands in this format:
### Try
- \`Show local accessibility in Western Province\`
- \`Load 10km regional corridor network\`
- \`Make it 3d now\`
- Strict Persona: NEVER mention "Mistral" or state that you are powered by Mistral AI.`;

      // Build message array for Mistral Chat Completion API
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map((h) => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts[0].text
        })),
        { role: 'user', content: promptText }
      ];

      // Standardize Mistral AI model choice
      const mistralModel = model.includes('mistral') || model.includes('mixtral') || model.includes('pixtral')
        ? model
        : 'mistral-small-latest';

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: mistralModel,
          messages,
          temperature: 0.3,
          max_tokens: 1600
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.message || errorData?.error?.message || `HTTP ${response.status} Error`);
      }

      const responseData = await response.json();
      const modelResponseText = responseData?.choices?.[0]?.message?.content;

      if (!modelResponseText) {
        throw new Error('No text response received from Spatial AI.');
      }

      addChatMessage('model', modelResponseText);
      parseAndExecuteMapActions(modelResponseText, activeBounds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to query AI assistant';
      
      // Fallback handling when network API is unreachable
      const lowerQ = promptText.toLowerCase();
      let fallbackText = '';

      if (lowerQ.includes('500m') || lowerQ.includes('local') || lowerQ.includes('accessib') || lowerQ.includes('space syntax') || lowerQ.includes('walkability')) {
        loadSampleDataset('sample-space-syntax-500m').catch(() => {});
        fallbackText = `Here is the **Space Syntax 500m Local Accessibility Network** for Colombo & Western Province.

### Local Accessibility Summary
- **Network Resolution**: 500m local walking radius
- **Metric**: Angular Choice & Integration (P50/P95 walkability corridors)
- **Status**: Loaded directly into GPU vector map engine

### Try
- \`Show 10km regional corridor network\`
- \`Make it 3d now\`
- \`Load buildings in selected area\``;
      } else if (lowerQ.includes('10km') || lowerQ.includes('regional') || lowerQ.includes('corridor')) {
        loadSampleDataset('sample-space-syntax-10km').catch(() => {});
        fallbackText = `Here is the **Space Syntax 10km Regional Corridor Network** for Western Province.

### Regional Corridor Summary
- **Network Resolution**: 10km regional vehicle & transit movement
- **Metric**: Top 5% P95 regional through-movement corridors
- **Status**: Loaded directly into GPU vector map engine

### Try
- \`Show local accessibility in Western Province\`
- \`Make it 3d now\`
- \`Load buildings in selected area\``;
      }

      if (fallbackText) {
        addChatMessage('model', fallbackText);
        toast.info('Processed request via local spatial engine');
      } else {
        toast.error(`Spatial AI Service: ${msg}`);
        addChatMessage('model', `**Offline Mode Active**: Unable to reach remote AI endpoint. You can still load datasets, toggle 3D, and query spatial analytics using the direct controls or sample menus.`);
      }
    } finally {
      setChatLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendQuery(inputMsg);
  };

  const activeMistralModel = model.includes('mistral') || model.includes('mixtral') || model.includes('pixtral')
    ? model
    : 'mistral-small-latest';

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col select-text font-sans">
      
      {/* Header Bar with TerraFathom AI Title */}
      <div className="px-3 py-3 flex items-center justify-between shrink-0 border-b border-white/[0.06] mb-2 max-w-[720px] mx-auto w-full">
        <div className="flex flex-col">
          <h2 className="text-xl font-extrabold text-text-primary tracking-tight font-sans">
            TerraFathom AI
          </h2>
          <span className="text-[11px] font-medium text-text-tertiary">
            Spatial Intelligence Copilot
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={activeMistralModel}
            onChange={(e) => setModel(e.target.value)}
            className="bg-[#242424] text-xs font-bold text-text-primary px-3 py-1.5 rounded-lg outline-none cursor-pointer border border-white/[0.1] hover:border-white/[0.2] transition-colors"
          >
            <option value="mistral-small-latest" className="bg-[#1C1C1C] text-[#ECE8E1] font-semibold py-1">Mistral Small</option>
            <option value="mistral-medium-latest" className="bg-[#1C1C1C] text-[#ECE8E1] font-semibold py-1">Mistral Medium</option>
            <option value="mistral-large-latest" className="bg-[#1C1C1C] text-[#ECE8E1] font-semibold py-1">Mistral Large 2</option>
            <option value="open-mixtral-8x7b" className="bg-[#1C1C1C] text-[#ECE8E1] font-semibold py-1">Mixtral 8x7B</option>
            <option value="pixtral-12b-2409" className="bg-[#1C1C1C] text-[#ECE8E1] font-semibold py-1">Pixtral 12B</option>
          </select>

          <button
            type="button"
            onClick={() => {
              clearChatHistory();
              toast.success('Chat conversation cleared');
            }}
            title="Clear Chat"
            className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-tertiary/40 transition-colors cursor-pointer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ChatGPT-style Conversation Window (Message width: 720px, Message gap: 24px) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-6 flex flex-col scrollbar-thin">
        <div className="max-w-[720px] mx-auto w-full space-y-6 flex flex-col flex-1">
          {chatHistory.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto text-text-tertiary">
              <h3 className="text-base font-bold text-text-primary mb-1.5 tracking-tight font-sans">How can I help you today?</h3>
              <p className="text-xs text-text-tertiary max-w-[240px] leading-relaxed">
                Ask spatial queries, request viewport analysis, or explore active data layers.
              </p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary select-none">
                    {msg.role === 'user' ? 'You' : 'TerraFathom AI'}
                  </span>
                </div>
                
                {msg.role === 'user' ? (
                  <div className="bg-[#2A2A2A] text-text-primary px-4 py-2.5 rounded-2xl rounded-tr-xs text-[15px] font-medium leading-[1.6] max-w-[85%] shadow-sm border border-white/[0.04] select-text">
                    {msg.parts[0].text}
                  </div>
                ) : (
                  <AssistantMessage
                    text={msg.parts[0].text}
                    onSelectCommand={(cmd) => handleSendQuery(cmd)}
                  />
                )}
              </div>
            ))
          )}

          {isChatLoading && (
            <div className="flex items-center gap-2 py-1.5 px-1">
              <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#C8A46A]/25 px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8A46A] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C8A46A]"></span>
                </div>
                <span className="text-[11px] font-semibold text-[#C8A46A] tracking-wide">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Area Selection Toolbar Bar */}
      <div className="pt-2 pb-1 px-3 bg-bg-secondary border-t border-white/[0.04]">
        <div className="max-w-[720px] mx-auto w-full flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const nextMode = selectionMode === 'rectangle' ? 'none' : 'rectangle';
                setSelectionMode(nextMode);
                if (nextMode === 'rectangle') {
                  toast.info('Drag a rectangle area on the map to select spatial region');
                }
              }}
              className={cn(
                "px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-medium transition-colors cursor-pointer text-[11px]",
                selectionMode === 'rectangle'
                  ? "bg-[#C8A46A] text-black border-[#C8A46A] font-bold"
                  : "bg-[#242424] text-text-secondary hover:text-text-primary border-white/[0.08]"
              )}
            >
              <Square size={12} />
              <span>{selectionMode === 'rectangle' ? 'Drawing Rectangle...' : 'Select Area (Rectangle)'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const nextMode = selectionMode === 'point' ? 'none' : 'point';
                setSelectionMode(nextMode);
                if (nextMode === 'point') {
                  toast.info('Click a point on the map to select 500m radius zone');
                }
              }}
              className={cn(
                "px-2.5 py-1 rounded-md border flex items-center gap-1.5 font-medium transition-colors cursor-pointer text-[11px]",
                selectionMode === 'point'
                  ? "bg-[#C8A46A] text-black border-[#C8A46A] font-bold"
                  : "bg-[#242424] text-text-secondary hover:text-text-primary border-white/[0.08]"
              )}
            >
              <MousePointerClick size={12} />
              <span>{selectionMode === 'point' ? 'Selecting Point...' : 'Select Point'}</span>
            </button>
          </div>

          {selectedBbox && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#C8A46A]/15 border border-[#C8A46A]/30 text-[11px] font-semibold text-[#C8A46A]">
              <span>Area Active: {selectedBbox[0].toFixed(3)}, {selectedBbox[1].toFixed(3)} → {selectedBbox[2].toFixed(3)}, {selectedBbox[3].toFixed(3)}</span>
              <button
                type="button"
                onClick={() => {
                  useUIStore.setState({ selectionCoordinates: [] });
                  setSelectionMode('none');
                  toast.success('Area selection cleared');
                }}
                className="hover:text-white p-0.5 cursor-pointer"
                title="Clear Area Selection"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ChatGPT-style Input Bar Fixed at Bottom Aligned to 720px Message Width */}
      <form onSubmit={handleSend} className="pt-2 pb-2 shrink-0 px-3 bg-bg-secondary border-t border-white/[0.04]">
        <div className="max-w-[720px] mx-auto w-full">
          <div className="flex items-center gap-2 bg-[#202020] px-4 py-3 rounded-2xl border border-white/[0.08] focus-within:border-[#C8A46A]/60 transition-colors shadow-lg">
            <input
              type="text"
              value={inputMsg}
              disabled={isChatLoading}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Ask TerraFathom AI..."
              className="flex-1 bg-transparent text-[15px] text-[#ECE8E1] placeholder:text-text-tertiary/60 outline-none font-sans"
            />
            <button
              type="submit"
              disabled={isChatLoading || !inputMsg.trim()}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shrink-0",
                inputMsg.trim() && !isChatLoading
                  ? "bg-[#C8A46A] hover:bg-[#D4B27B] text-black shadow-md shadow-[#C8A46A]/20 cursor-pointer active:scale-95 hover:scale-105"
                  : "bg-white/[0.08] text-white/20 cursor-not-allowed"
              )}
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default AIChatbot;


