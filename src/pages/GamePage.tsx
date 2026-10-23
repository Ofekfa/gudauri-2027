import { useEffect, useRef, useState } from 'preact/hooks';
import { AvatarFace, AvatarSkier } from '../avatars/Avatar';
import { PageHeader } from '../components/PageHeader';
import { CHARACTERS } from '../data/characters';
import { trip, type TravelerId } from '../data/trip';
import { SCORE } from '../game/constants';
import {
  createGameController,
  type ControllerStatus,
  type GameController,
  type GameResult,
} from '../game/controller';
import type { SyncResult } from '../game/highScores';
import { gameScores, onScoreSync, startScoreSync } from '../game/scoreSync';
import { bestOf, MIN_DURATION_MS, type ScoreTable } from '../game/scores';
import { href } from '../lib/router/hashRouter';
import { appStore } from '../lib/storage/safeStorage';
import { syncSettings } from '../lib/sync/settings';

const CHARACTER_KEY = 'game:character';

const nameOf = (id: TravelerId) => trip.travelers.find((t) => t.id === id)!.name;
const MS_PER_S = 1_000;
type SyncSummary = Pick<SyncResult, 'state' | 'pending' | 'rejected'>;

/** Where the scores on screen come from; never blocks the game. */
function SyncLine({ sync }: { sync: SyncSummary }) {
  const extra = [
    sync.pending > 0 && `${sync.pending} waiting to send`,
    sync.rejected > 0 && `${sync.rejected} couldn’t be shared`,
  ].filter(Boolean);
  const tail = extra.length ? ` · ${extra.join(' · ')}` : '';
  return (
    <p class={`game-sync game-sync--${sync.state}`} role="status">
      {sync.state === 'syncing' && 'Syncing…'}
      {sync.state === 'synced' && `Synced${tail}`}
      {sync.state === 'offline' && `Offline — showing scores from this device${tail}`}
      {sync.state === 'local' && (
        <>
          Scores from this device. <a href={href('/album')}>Join the group</a> to share them.
        </>
      )}
    </p>
  );
}

/** Each skier's shared best, side by side. */
function CrewLeaderboard({ scores }: { scores: ScoreTable }) {
  const ranked = trip.travelers
    .map(({ id, name }) => ({ id, name, best: bestOf(scores, id) }))
    .sort((a, b) => b.best - a.best);
  const leader = ranked[0]!.best > 0 ? ranked[0]!.id : null;
  return (
    <section class="card crew-board" aria-labelledby="crew-board-title">
      <h2 id="crew-board-title">Crew leaderboard</h2>
      <ol class="crew-board__list">
        {ranked.map(({ id, name, best }) => (
          <li key={id} class="crew-board__item" style={{ '--member-color': CHARACTERS[id].jacket }}>
            <AvatarFace id={id} size={44} decorative />
            <span class="crew-board__name">
              {id === leader && (
                <span role="img" aria-label="Leader">
                  🥇{' '}
                </span>
              )}
              {name}
            </span>
            <span class="crew-board__best">{best || '–'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function storedCharacter(): TravelerId | null {
  const stored = appStore.get(CHARACTER_KEY);
  return trip.travelers.find((t) => t.id === stored)?.id ?? null;
}

function CharacterPicker({
  scores,
  onPick,
  lastPicked,
}: {
  scores: ScoreTable;
  onPick: (id: TravelerId) => void;
  lastPicked: TravelerId | null;
}) {
  return (
    <>
      <h2 class="section-title">Pick your skier</h2>
      <div class="skier-picker">
        {trip.travelers.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            class="skier-option"
            style={{ '--member-color': CHARACTERS[id].jacket }}
            onClick={() => onPick(id)}
            aria-current={id === lastPicked ? 'true' : undefined}
          >
            <AvatarSkier id={id} size={72} decorative />
            <span class="skier-option__name">{name}</span>
            <span class="skier-option__best">Best: {bestOf(scores, id)}</span>
          </button>
        ))}
      </div>
      <CrewLeaderboard scores={scores} />
      <section class="card how-to-play" aria-labelledby="how-to-play-title">
        <h2 id="how-to-play-title">How to play</h2>
        <ul>
          <li>
            <strong>Phone:</strong> hold the left or right side of the slope to steer.
          </li>
          <li>
            <strong>Keyboard:</strong> ← → (or A / D) to steer, Space to start, P or Esc to pause.
          </li>
          <li>Dodge trees, rocks and flags. You have three lives.</li>
          <li>
            Grab khachapuri (+{SCORE.khachapuri}) and snowflakes (+{SCORE.snowflake}). It gets
            faster the further you go!
          </li>
        </ul>
      </section>
    </>
  );
}

function Game({
  character,
  scores,
  onScores,
  onChangeSkier,
}: {
  character: TravelerId;
  scores: ScoreTable;
  onScores: (table: ScoreTable) => void;
  onChangeSkier: () => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const [status, setStatus] = useState<ControllerStatus | 'loading' | 'error'>('loading');
  const [result, setResult] = useState<(GameResult & { rank: number }) | null>(null);
  const scoresRef = useRef(scores);
  scoresRef.current = scores;
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Like a dialog: when an overlay appears, its main action takes focus.
  useEffect(() => {
    if (status !== 'playing') primaryRef.current?.focus();
  }, [status, result]);

  useEffect(() => {
    let disposed = false;
    createGameController({
      field: fieldRef.current!,
      canvas: canvasRef.current!,
      character,
      onStatus: (next, outcome) => {
        // No network during a run: syncing waits until it's over.
        if (next === 'playing') gameScores.hold(true);
        if (next === 'over' && outcome) {
          const me = syncSettings.get().me;
          const { table, rank } = gameScores.record(character, {
            score: outcome.score,
            runId: crypto.randomUUID(),
            achievedAt: new Date().toISOString(),
            durationMs: Math.max(MIN_DURATION_MS, Math.round(outcome.seconds * MS_PER_S)),
            ...(me ? { playedBy: me } : {}),
          });
          onScores(table);
          setResult({ ...outcome, rank });
          gameScores.hold(false);
          // In the background; a new shared record shows a toast when it's confirmed.
          void gameScores.sync();
        }
        if (next === 'playing') setResult(null);
        setStatus(next);
      },
    })
      .then((controller) => {
        if (disposed) controller.destroy();
        else {
          controllerRef.current = controller;
          setStatus('ready');
        }
      })
      .catch(() => setStatus('error'));
    return () => {
      disposed = true;
      gameScores.hold(false);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [character]);

  const controller = controllerRef.current;
  const name = nameOf(character);
  const personalBest = bestOf(scores, character);

  return (
    <div class="game">
      <div class="game__field" ref={fieldRef}>
        <canvas
          ref={canvasRef}
          class="game__canvas"
          role="img"
          aria-label={`Ski game: ${name} skiing downhill`}
        />

        {status === 'playing' && (
          <button
            type="button"
            class="game__pause"
            aria-label="Pause"
            onClick={() => controller?.pause()}
          >
            ❚❚
          </button>
        )}

        {status !== 'playing' && (
          <div class="game__overlay">
            <div class="game__panel card" role={status === 'over' ? 'alert' : undefined}>
              {status === 'loading' && <p>Waxing the skis…</p>}
              {status === 'error' && <p>The game couldn’t start on this device. Try reloading.</p>}
              {status === 'ready' && (
                <>
                  <AvatarSkier id={character} size={64} decorative />
                  <h2>Ready, {name}?</h2>
                  <p class="game__hint">Hold left/right on the slope (or use ← →) to steer.</p>
                  <button
                    type="button"
                    class="button button--primary"
                    ref={primaryRef}
                    onClick={() => controller?.start()}
                  >
                    Start skiing
                  </button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <h2>Paused</h2>
                  <div class="button-row">
                    <button
                      type="button"
                      class="button button--primary"
                      ref={primaryRef}
                      onClick={() => controller?.resume()}
                    >
                      Resume
                    </button>
                    <button type="button" class="button" onClick={() => controller?.restart()}>
                      Restart
                    </button>
                    <button type="button" class="button" onClick={onChangeSkier}>
                      Change skier
                    </button>
                  </div>
                </>
              )}
              {status === 'over' && result && (
                <>
                  <h2>{result.rank === 0 ? '🏆 New best!' : 'Wipeout!'}</h2>
                  <p class="game__score">{result.score}</p>
                  <p class="game__hint">
                    {result.meters} m skied · {result.khachapuri} khachapuri · {result.snowflakes}{' '}
                    snowflakes
                  </p>
                  <p class="game__hint">
                    {name}’s best: <strong>{Math.max(personalBest, result.score)}</strong>
                  </p>
                  <div class="button-row">
                    <button
                      type="button"
                      class="button button--primary"
                      ref={primaryRef}
                      onClick={() => controller?.restart()}
                    >
                      Play again
                    </button>
                    <button type="button" class="button" onClick={onChangeSkier}>
                      Change skier
                    </button>
                  </div>
                  {(scores[character]?.length ?? 0) > 0 && (
                    <ol class="game__scores" aria-label={`${name}’s top scores`}>
                      {scores[character]!.map((s, i) => (
                        <li key={s.runId} class={i === result.rank ? 'is-new' : undefined}>
                          {s.score}
                          {s.playedBy && s.playedBy !== character && (
                            <span class="game__scores-by"> · by {nameOf(s.playedBy)}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GamePage() {
  const [scores, setScores] = useState<ScoreTable>(() => gameScores.load());
  const [sync, setSync] = useState<SyncSummary>({ state: 'syncing', pending: 0, rejected: 0 });

  // Shared scores: fetched on opening the page and after every run (never mid-run).
  useEffect(() => {
    const off = onScoreSync((result) => {
      setScores(result.table);
      setSync(result);
    });
    void startScoreSync();
    return off;
  }, []);
  const [character, setCharacter] = useState<TravelerId | null>(null);
  const [lastPicked] = useState(storedCharacter);

  const pick = (id: TravelerId) => {
    appStore.set(CHARACTER_KEY, id);
    setCharacter(id);
  };

  return (
    <>
      <PageHeader
        title="Ski game"
        subtitle={
          character
            ? `Skiing as ${nameOf(character)}`
            : 'Race down Gudauri and beat each other’s scores.'
        }
      />
      <SyncLine sync={sync} />
      {character ? (
        <Game
          character={character}
          scores={scores}
          onScores={setScores}
          onChangeSkier={() => setCharacter(null)}
        />
      ) : (
        <CharacterPicker scores={scores} onPick={pick} lastPicked={lastPicked} />
      )}
    </>
  );
}
