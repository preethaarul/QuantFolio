import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, SendHorizonal, X } from 'lucide-react';
import { sendAIChat } from '../services/api';

interface AIChatDrawerProps {
  portfolioId: number;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ portfolioId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    { sender: 'bot', text: 'Hi! Ask me anything about your portfolio performance, risk, or holdings.' }
  ]);
  const [loading, setLoading] = useState(false);

  // Ref for auto-scrolling message container
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendAIChat(portfolioId, userMsg);
      setMessages((prev) => [...prev, { sender: 'bot', text: res.data.response }]);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Sorry, I could not process that query. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center rounded-full bg-blue-600 p-4 text-white shadow-2xl transition-all hover:scale-105 hover:bg-blue-500"
        >
          <Bot className="h-5 w-5" />
          <span className="ml-2 text-sm font-semibold">Ask QuantAI</span>
        </button>
      )}

      {/* Drawer / Window */}
      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 w-80 sm:w-96 h-[450px] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">QuantFolio AI Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="font-bold text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] p-3 rounded-xl text-xs sm:text-sm ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white ml-auto rounded-br-none'
                    : 'bg-slate-800 text-slate-200 border border-slate-700 mr-auto rounded-bl-none'
                }`}
              >
                {m.sender === 'bot' ? (
                  /* ✅ Render Markdown for Bot Messages */
                  <div className="prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed [&>h3]:text-sm [&>h3]:font-bold [&>h3]:mt-2 [&>h3]:mb-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-1.5">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  /* Plain text for User Messages */
                  <span>{m.text}</span>
                )}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-400 animate-pulse">QuantAI is thinking...</div>}

            {/* Scroll Target */}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about returns, risk, holdings..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};