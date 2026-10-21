import { useEffect, useRef, useState } from 'preact/hooks';
import { AvatarSkier } from '../avatars/Avatar';
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
import {
  insertHighScore,
  loadHighScores,
  saveHighScores,
  type HighScoreTable,
} from '../game/highScores';
import { appStore } from '../lib/storage/safeStorage';

const CHARACTER_KEY = 'game:character';

const nameOf = (id: TravelerId) => trip.travelers.find((t) => t.id === id)!.name;
const best = (table: HighScoreTable, id: TravelerId) => table[id]?.[0]?.score ?? 0;

function storedCharacter(): TravelerId | null {
  const stored = appStore.get(CHARACTER_KEY);
  return trip.travelers.find((t) => t.id === stored)?.id ?? null;
}

function CharacterPicker({
  scores,
  onPick,
  lastPicked,
}: {
  scores: HighScoreTable;
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
            <span class="skier-option__best">Best: {best(scores, id)}</span>
          </button>
        ))}
      </div>
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
  scores: HighScoreTable;
  onScores: (table: HighScoreTable) => void;
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
        if (next === 'over' && outcome) {
          const { list, rank } = insertHighScore(scoresRef.current[character] ?? [], {
            score: outcome.score,
            at: Date.now(),
          });
          const table = { ...scoresRef.current, [character]: list };
          saveHighScores(appStore, table);
          onScores(table);
          setResult({ ...outcome, rank });
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
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [character]);

  const controller = controllerRef.current;
  const name = nameOf(character);
  const personalBest = best(scores, character);

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
                        <li key={s.at} class={i === result.rank ? 'is-new' : undefined}>
                          {s.score}
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
  const [scores, setScores] = useState<HighScoreTable>(() => loadHighScores(appStore));
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
