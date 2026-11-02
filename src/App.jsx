import { useEffect, useMemo, useRef, useState } from 'react';

const defaultPrompt = 'You are RAFI (রাফি), a futuristic JARVIS-like AI personal assistant. Respond politely in Bengali or English based on input. Keep answers concise, helpful, and highly intelligent.';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('rafi_api_key') || '');
  const [n8nUrl, setN8nUrl] = useState(localStorage.getItem('rafi_n8n_url') || '');
  const [chat, setChat] = useState([
    { sender: 'SYSTEM', text: 'RAFI is online. Ask anything.' }
  ]);
  const [input, setInput] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageResult, setImageResult] = useState('');
  const [taskList, setTaskList] = useState([
    { id: 1, text: 'Prepare meeting notes', date: 'Today' }
  ]);
  const [code, setCode] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [replyState, setReplyState] = useState('idle');
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (apiKey) localStorage.setItem('rafi_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (n8nUrl) localStorage.setItem('rafi_n8n_url', n8nUrl);
  }, [n8nUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  const updateReactor = (state) => setReplyState(state);

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;

    const cleanText = String(text || '').replace(/[*_#`]/g, '').trim();
    if (!cleanText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'bn-BD';
    utterance.onstart = () => updateReactor('speaking');
    utterance.onend = () => updateReactor('idle');
    utterance.onerror = () => updateReactor('idle');
    window.speechSynthesis.speak(utterance);
  };

  const addMessage = (sender, text, isLoading = false) => {
    setChat((prev) => [...prev, { sender, text, isLoading }]);
  };

  const removeLoading = () => setChat((prev) => prev.filter((msg) => !msg.isLoading));

  const sendMessage = async (overrideText = null) => {
    const query = String(overrideText ?? input).trim();
    if (!query) return;

    setInput('');
    addMessage('USER', query);

    if (n8nUrl) {
      addMessage('SYSTEM', 'Forwarding request to n8n workflow...');
      try {
        const response = await fetch(n8nUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: query, user: 'User' })
        });

        if (!response.ok) throw new Error(`n8n HTTP ${response.status}`);

        const data = await response.json();
        const reply = typeof data.output === 'string' ? data.output : data.message || JSON.stringify(data);
        addMessage('RAFI', reply);
        speakText(reply);
      } catch (e) {
        addMessage('RAFI', 'n8n সংযোগে সমস্যা হয়েছে: ' + e.message);
      }
      return;
    }

    setLoading(true);
    addMessage('RAFI', 'প্রসেস করা হচ্ছে...', true);

    try {
      if (!apiKey) throw new Error('API key missing');

      const payload = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: defaultPrompt }] }
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${text}`);
      }

      const data = await res.json();
      removeLoading();
      setLoading(false);

      const reply = data?.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || 'ক্ষমা করবেন, বুঝতে পারিনি। আবার বলুন।';
      addMessage('RAFI', reply);
      speakText(reply);

      if (query.toLowerCase().includes('code') || query.includes('কোড')) {
        setCode(reply);
      }
    } catch (error) {
      removeLoading();
      setLoading(false);
      const errText = 'সিস্টেমে সংযোগ সমস্যা ঘটেছে। আবার চেষ্টা করুন।';
      addMessage('RAFI', errText);
      speakText(errText);
    }
  };

  const generateAIImage = async () => {
    const prompt = imagePrompt.trim();
    if (!prompt) return;

    setImageResult('<span class="text-xs text-amber-400 font-mono animate-pulse">Generating Image Concept...</span>');

    try {
      if (!apiKey) throw new Error('API key missing');

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Image API error: ${response.status}`);
      }

      const result = await response.json();
      const base64Data = result?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;

      if (base64Data) {
        setImageResult(`<img src="data:image/png;base64,${base64Data}" class="max-h-full max-w-full rounded border border-amber-500/40 object-contain" />`);
      } else {
        setImageResult('<span class="text-xs text-red-400 font-mono">Image generation failed. Try again.</span>');
      }
    } catch (err) {
      setImageResult('<span class="text-xs text-red-400 font-mono">Error generating image.</span>');
    }
  };

  const addQuickTask = () => {
    const newTask = prompt('নতুন কাজের নাম লিখুন:');
    if (!newTask) return;

    setTaskList((prev) => [
      ...prev,
      { id: Date.now(), text: newTask, date: 'Today' }
    ]);
  };

  const removeTask = (id) => {
    setTaskList((prev) => prev.filter((task) => task.id !== id));
  };

  const copyCode = async () => {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      alert('Code copied to clipboard!');
    } catch {
      alert('Copy failed. Please copy manually.');
    }
  };

  const clearChat = () => setChat([{ sender: 'SYSTEM', text: 'RAFI is online. Ask anything.' }]);

  const calculatorValue = useMemo(() => ({
    get: () => document.getElementById('calc-display')?.value || '0',
    set: (value) => {
      const inputEl = document.getElementById('calc-display');
      if (inputEl) inputEl.value = value;
    }
  }), []);

  const calcInput = (val) => {
    const display = document.getElementById('calc-display');
    if (!display) return;
    display.value = display.value === '0' ? val : display.value + val;
  };

  const calcClear = () => {
    const display = document.getElementById('calc-display');
    if (display) display.value = '0';
  };

  const calcEqual = () => {
    const display = document.getElementById('calc-display');
    if (!display) return;

    try {
      const expr = display.value;
      const safeExpr = expr.replace(/[^0-9+\-*/().% ]/g, '');
      display.value = Function(`"use strict"; return (${safeExpr});`)();
    } catch {
      display.value = 'Error';
    }
  };

  return (
    <div className="app-shell grid-bg">
      <div className="mx-auto h-full max-w-[1600px]">
        <div className="flex h-full gap-4">
          <aside className="glass neon-border rounded-2xl p-4 hidden xl:block w-[260px]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.35em] text-cyan-300 uppercase">Core Systems</p>
                <h1 className="mt-1 text-xl font-bold text-cyan-200">RAFI AI</h1>
              </div>
              <div className="h-8 w-8 rounded-full border border-cyan-400/50 bg-cyan-500/10 flex items-center justify-center">
                <i className="fa-solid fa-robot text-cyan-300"></i>
              </div>
            </div>

            <div className="space-y-4">
              <button onClick={() => setIsConfigOpen(true)} className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-left hover:bg-cyan-500/20 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-cyan-300">CONFIG</span>
                  <i className="fa-solid fa-gear text-cyan-300"></i>
                </div>
              </button>

              <button onClick={() => sendMessage('What can you do?')} className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-left hover:border-cyan-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-300">PROMPT</span>
                  <i className="fa-solid fa-wand-sparkles text-violet-400"></i>
                </div>
              </button>

              <button onClick={clearChat} className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-left hover:border-rose-500/40 transition">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-300">CLEAR CHAT</span>
                  <i className="fa-solid fa-broom text-rose-400"></i>
                </div>
              </button>

              <div className="rounded-xl border border-cyan-500/30 bg-slate-950/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.22em] text-cyan-300 uppercase">Reactive Core</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]"></span>
                </div>

                <div className="flex items-center justify-center py-4">
                  <div
                    className={`reactor ${replyState === 'listening' ? 'reactor-listening' : ''} ${replyState === 'speaking' ? 'reactor-speaking' : ''}`}
                    onClick={() => speakText('আমি রাফি, আপনার AI সহকারী। কী করতে সাহায্য করতে পারি?')}
                  >
                    <div className="flex flex-col items-center">
                      <i className={`fa-solid ${replyState === 'speaking' ? 'fa-volume-high text-emerald-400' : replyState === 'listening' ? 'fa-microphone-lines text-rose-400' : 'fa-microphone text-cyan-400'} text-4xl filter drop-shadow-[0_0_10px_#00f0ff]`}></i>
                      <span className={`mt-3 text-[10px] font-mono font-semibold tracking-wider ${replyState === 'speaking' ? 'text-emerald-400' : replyState === 'listening' ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
                        {replyState === 'speaking' ? '[ RAFI SPEAKING... ]' : replyState === 'listening' ? '[ LISTENING... ]' : '[ TAP REACTOR TO SPEAK ]'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 glass neon-border rounded-2xl overflow-hidden flex flex-col">
            <header className="flex items-center justify-between border-b border-cyan-500/20 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg border border-cyan-400/50 bg-cyan-500/10 flex items-center justify-center">
                  <i className="fa-solid fa-satellite-dish text-cyan-300"></i>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.3em] text-cyan-300 uppercase">Live Interface</p>
                  <h2 className="text-lg font-semibold text-cyan-100">RAFI Command Console</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-mono text-emerald-300">ONLINE</span>
                <button onClick={() => setIsConfigOpen(true)} className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 hover:border-cyan-500/40">
                  <i className="fa-solid fa-sliders mr-1"></i> Settings
                </button>
              </div>
            </header>

            <section className="flex-1 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4 p-4">
              <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/40">
                <div className="flex items-center justify-between border-b border-cyan-500/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]"></span>
                    <span className="text-xs font-mono tracking-[0.25em] text-cyan-300 uppercase">Session</span>
                  </div>
                  <button onClick={clearChat} className="text-xs text-slate-400 hover:text-rose-300">
                    <i className="fa-solid fa-trash-can mr-1"></i> clear
                  </button>
                </div>

                <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4">
                  {chat.map((msg, idx) => {
                    const isUser = msg.sender === 'USER';
                    const isSystem = msg.sender === 'SYSTEM';
                    const color = isUser ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-cyan-950/60 border-cyan-800/60 text-cyan-100';
                    const tagColor = isUser ? 'text-purple-400' : 'text-cyan-400';
                    const tagText = msg.sender === 'USER' ? 'YOU //' : msg.sender === 'RAFI' ? 'RAFI AI //' : 'SYSTEM //';

                    return (
                      <div key={idx} className="flex flex-col items-start space-y-1">
                        <span className={`text-[10px] font-mono ${tagColor}`}>{tagText}</span>
                        <div className={`${color} border rounded-r-lg rounded-bl-lg p-3 max-w-[92%] leading-relaxed`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef}></div>
                </div>

                <div className="border-t border-cyan-500/20 p-3">
                  <div className="flex flex-col gap-3 md:flex-row">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Ask RAFI anything..."
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                    />
                    <button onClick={() => sendMessage()} className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:brightness-110 transition">
                      <i className="fa-solid fa-paper-plane mr-2"></i>Send
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/20 bg-slate-950/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-image text-amber-400"></i>
                      <span className="text-[10px] tracking-[0.25em] text-amber-300 uppercase">Image Generation</span>
                    </div>
                  </div>

                  <input
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="Describe your concept..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 outline-none"
                  />
                  <button onClick={generateAIImage} className="mt-3 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20">
                    <i className="fa-solid fa-wand-sparkles mr-2"></i>Generate Visual
                  </button>
                  <div
                    className="mt-4 flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-amber-500/30 bg-slate-900/50 text-center p-3 text-xs text-slate-400"
                    dangerouslySetInnerHTML={{ __html: imageResult || 'No image yet.' }}
                  />
                </div>

                <div className="rounded-2xl border border-violet-500/20 bg-slate-950/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-calculator text-violet-400"></i>
                      <span className="text-[10px] tracking-[0.25em] text-violet-300 uppercase">Calculator</span>
                    </div>
                  </div>

                  <input id="calc-display" type="text" defaultValue="0" className="mb-3 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-right text-lg text-slate-100 outline-none" />
                  <div className="grid grid-cols-4 gap-2">
                    {['7','8','9','C','4','5','6','/','1','2','3','*','0','.','+','='].map((value) => {
                      const isAction = value === 'C' || value === '=';
                      const buttonClass = isAction ? 'rounded-lg p-2 text-sm ' + (value === 'C' ? 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/30' : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30') : 'calc-btn rounded-lg bg-slate-800 p-2 text-sm hover:bg-slate-700';

                      return (
                        <button
                          key={value}
                          onClick={() => {
                            if (value === 'C') calcClear();
                            else if (value === '=') calcEqual();
                            else calcInput(value);
                          }}
                          className={buttonClass}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-list-check text-cyan-400"></i>
                      <span className="text-[10px] tracking-[0.25em] text-cyan-300 uppercase">Quick Tasks</span>
                    </div>
                    <button onClick={addQuickTask} className="text-xs text-cyan-300 hover:text-cyan-200">
                      <i className="fa-solid fa-plus mr-1"></i> add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {taskList.map((task) => (
                      <div key={task.id} className="p-2 rounded bg-slate-950/80 border-l-2 border-cyan-400 flex justify-between items-center">
                        <div>
                          <p className="text-slate-200 text-sm">{task.text}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{task.date}</span>
                        </div>
                        <i className="fa-regular fa-circle-check text-slate-600 cursor-pointer hover:text-emerald-400" onClick={() => removeTask(task.id)}></i>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-slate-950/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-code text-emerald-400"></i>
                      <span className="text-[10px] tracking-[0.25em] text-emerald-300 uppercase">Code Studio</span>
                    </div>
                    <button onClick={copyCode} className="text-xs text-emerald-300 hover:text-emerald-200">
                      <i className="fa-regular fa-copy mr-1"></i> Copy
                    </button>
                  </div>

                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    rows={8}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-100 outline-none focus:border-emerald-500"
                    placeholder="// code output will appear here"
                  />
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {isConfigOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-6 shadow-2xl shadow-cyan-500/10">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-cyan-200">System Configuration</h3>
                <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-200">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-cyan-300">Gemini API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter Gemini API key"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-mono uppercase tracking-[0.22em] text-cyan-300">n8n Webhook URL</label>
                  <input
                    type="text"
                    value={n8nUrl}
                    onChange={(e) => setN8nUrl(e.target.value)}
                    placeholder="https://example.com/webhook/..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setIsConfigOpen(false)} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-3 text-sm font-semibold text-slate-950 hover:brightness-110">
                    Save Settings
                  </button>
                  <button onClick={() => setIsConfigOpen(false)} className="flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm text-slate-200 hover:border-slate-500">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
