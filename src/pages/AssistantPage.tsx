import { useEffect, useRef, useState } from 'preact/hooks';
import {
  askAssistant,
  ASSISTANT_ERROR_TEXT,
  ASSISTANT_URL,
  AssistantError,
  MAX_QUESTION_CHARS,
  type ChatMessage,
} from '../assistant/client';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import {
  createRecognizer,
  isRecognitionSupported,
  type RecognitionError,
} from '../lib/speech/recognition';
import { isSynthesisSupported, speak, stopSpeaking } from '../lib/speech/synthesis';
import { appStore } from '../lib/storage/safeStorage';

const SPEAK_KEY = 'assistant:speak';
/** Show the character counter once the question gets this long. */
const COUNTER_THRESHOLD = 400;

const GREETING =
  'Gamarjoba! 👋 I’m your Gudauri trip assistant. Ask me about our flights and hotel, skiing tips, what to pack, or Georgian food.';

const SUGGESTIONS = [
  'When do we land back home?',
  'How do I stop on skis?',
  'What should I pack for the slopes?',
  'What Georgian food should we try?',
];

const MIC_ERROR_TEXT: Record<RecognitionError, string> = {
  'not-allowed':
    'Microphone access was blocked. Allow it in your browser settings, or type instead.',
  'no-speech': 'I didn’t catch that. Tap the mic and try again.',
  network: 'Voice input needs an internet connection. You can type instead.',
  other: 'Voice input stopped unexpectedly. You can type instead.',
};

interface Bubble {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

export default function AssistantPage() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [speakReplies, setSpeakReplies] = useState(() => appStore.get(SPEAK_KEY) === 'true');
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const nextId = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognizer = useRef<ReturnType<typeof createRecognizer>>(null);

  const canSpeak = isSynthesisSupported();
  const canListen = isRecognitionSupported();
  const connected = ASSISTANT_URL !== null;

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [bubbles, busy]);

  // Stop talking/listening when leaving the page.
  useEffect(
    () => () => {
      stopSpeaking();
      recognizer.current?.abort();
    },
    [],
  );

  const add = (bubble: Omit<Bubble, 'id'>) =>
    setBubbles((list) => [...list, { ...bubble, id: nextId.current++ }]);

  const send = async (question: string, viaVoice = false) => {
    const text = question.trim().slice(0, MAX_QUESTION_CHARS);
    if (!text || busy) return;
    setDraft('');
    setLastFailed(null);
    add({ role: 'user', text });
    setBusy(true);
    // Only real exchanges go to the model; the greeting and error bubbles stay local.
    const history: ChatMessage[] = [
      ...bubbles.filter((b) => !b.error).map((b) => ({ role: b.role, content: b.text })),
      { role: 'user', content: text },
    ];
    try {
      const reply = await askAssistant(history);
      add({ role: 'assistant', text: reply });
      if (canSpeak && (speakReplies || viaVoice)) speak(reply);
    } catch (err) {
      const kind = err instanceof AssistantError ? err.kind : 'server';
      add({ role: 'assistant', text: ASSISTANT_ERROR_TEXT[kind], error: true });
      if (kind !== 'not-configured' && kind !== 'too-long') setLastFailed(text);
    } finally {
      setBusy(false);
    }
  };

  const toggleListening = () => {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    stopSpeaking();
    setMicNote(null);
    recognizer.current = createRecognizer({
      onInterim: (text) => setDraft(text),
      onFinal: (text) => {
        setDraft(text);
        void send(text, true);
      },
      onError: (error) => setMicNote(MIC_ERROR_TEXT[error]),
      onEnd: () => setListening(false),
    });
    try {
      recognizer.current?.start();
      setListening(true);
    } catch {
      setMicNote(MIC_ERROR_TEXT.other);
    }
  };

  const toggleSpeak = () => {
    const next = !speakReplies;
    setSpeakReplies(next);
    appStore.set(SPEAK_KEY, String(next));
    if (!next) stopSpeaking();
  };

  const clear = () => {
    stopSpeaking();
    setBubbles([]);
    setLastFailed(null);
    inputRef.current?.focus();
  };

  return (
    <>
      <PageHeader
        title="Trip assistant"
        subtitle="Ask about our trip, skiing, packing or Georgia, by voice or text."
      />

      {!connected && (
        <p class="note note--warning" role="status">
          The assistant isn’t connected yet, so questions can’t be answered. (Setup steps are in
          worker/README.md.)
        </p>
      )}

      <section class="card chat" aria-label="Conversation">
        <div class="chat__log" ref={logRef} role="log" aria-live="polite" aria-busy={busy}>
          <div class="bubble bubble--assistant">
            <span class="bubble__avatar" aria-hidden="true">
              <Icon name="snowflake" size={18} />
            </span>
            <p>{GREETING}</p>
          </div>
          {bubbles.map((b) => (
            <div key={b.id} class={`bubble bubble--${b.role}${b.error ? ' bubble--error' : ''}`}>
              {b.role === 'assistant' && (
                <span class="bubble__avatar" aria-hidden="true">
                  <Icon name="snowflake" size={18} />
                </span>
              )}
              <p>
                <span class="visually-hidden">{b.role === 'user' ? 'You: ' : 'Assistant: '}</span>
                {b.text}
              </p>
            </div>
          ))}
          {busy && (
            <div class="bubble bubble--assistant bubble--typing">
              <span class="bubble__avatar" aria-hidden="true">
                <Icon name="snowflake" size={18} />
              </span>
              <p>
                <span class="visually-hidden">The assistant is thinking…</span>
                <span class="typing-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </p>
            </div>
          )}
        </div>

        {bubbles.length === 0 && (
          <div class="chat__suggestions" role="group" aria-label="Example questions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                class="chip-button chip-button--small"
                disabled={!connected || busy}
                onClick={() => void send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {lastFailed && !busy && (
          <p class="chat__retry">
            <button type="button" class="link-button" onClick={() => void send(lastFailed)}>
              Try that question again
            </button>
          </p>
        )}

        <form
          class="chat__composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <label htmlFor="chat-input" class="visually-hidden">
            Your question
          </label>
          <input
            id="chat-input"
            ref={inputRef}
            type="text"
            autocomplete="off"
            enterKeyHint="send"
            maxLength={MAX_QUESTION_CHARS}
            placeholder={listening ? 'Listening…' : 'Type a question…'}
            value={draft}
            disabled={!connected}
            onInput={(e) => setDraft(e.currentTarget.value)}
          />
          {canListen && (
            <button
              type="button"
              class={`icon-button mic-button${listening ? ' is-listening' : ''}`}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Ask by voice'}
              disabled={!connected || busy}
              onClick={toggleListening}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path
                  d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          )}
          <button
            type="submit"
            class="button button--primary"
            disabled={!connected || busy || !draft.trim()}
          >
            Send
          </button>
        </form>
        {draft.length >= COUNTER_THRESHOLD && (
          <p class="chat__counter" aria-live="polite">
            {draft.length}/{MAX_QUESTION_CHARS}
          </p>
        )}
        {micNote && (
          <p class="chat__note" role="alert">
            {micNote}
          </p>
        )}
        {!canListen && (
          <p class="chat__note">
            Voice input isn’t available in this browser (try Chrome, Edge or Safari). Typing works
            everywhere.
          </p>
        )}

        <div class="chat__footer">
          {canSpeak && (
            <label class="chat__speak">
              <input type="checkbox" checked={speakReplies} onChange={toggleSpeak} />
              Read answers aloud
            </label>
          )}
          {bubbles.length > 0 && (
            <button type="button" class="link-button" onClick={clear}>
              Clear chat
            </button>
          )}
        </div>
      </section>

      <p class="chat__disclaimer">
        Answers come from a free AI model and can be wrong. It has no live weather, snow or lift
        info. Questions are sent to our Cloudflare Worker and not stored.
      </p>
    </>
  );
}
