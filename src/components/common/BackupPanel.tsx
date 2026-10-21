import { useRef, useState } from 'preact/hooks';
import { trip } from '../../data/trip';
import { parseImport, serializeExport } from '../../lib/packing/importExport';
import type { PackingState } from '../../lib/packing/model';
import { Icon } from '../Icon';

const TRAVELER_IDS = trip.travelers.map((t) => t.id);
const MAX_IMPORT_BYTES = 1_000_000;

interface BackupPanelProps {
  state: PackingState;
  onImport: (state: PackingState) => void;
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function BackupPanel({ state, onImport }: BackupPanelProps) {
  const [pending, setPending] = useState<{ fileName: string; state: PackingState } | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportLists = () => {
    const now = new Date();
    download(`gudauri-packing-${now.toISOString().slice(0, 10)}.json`, serializeExport(state, now));
    setMessage({ kind: 'ok', text: 'Exported all four lists.' });
  };

  const readFile = async (file: File | undefined) => {
    setPending(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ kind: 'error', text: 'That file is too large to be a packing list.' });
      return;
    }
    const result = parseImport(await file.text(), TRAVELER_IDS);
    if (result.ok) {
      setMessage(null);
      setPending({ fileName: file.name, state: result.state });
    } else {
      setMessage({ kind: 'error', text: result.error });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <section class="card backup" aria-labelledby="backup-title">
      <h2 id="backup-title">Backup &amp; move</h2>
      <p class="backup__note">
        Lists are saved on this device only. Export a file to back them up or move them to another
        phone, then import it there.
      </p>
      <div class="button-row">
        <button type="button" class="button" onClick={exportLists}>
          <Icon name="download" size={18} />
          Export lists
        </button>
        <label class="button">
          <Icon name="upload" size={18} />
          Import lists
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            class="visually-hidden"
            onChange={(e) => void readFile(e.currentTarget.files?.[0])}
          />
        </label>
      </div>

      {pending && (
        <div class="confirm" role="alert">
          <p>
            Replace <strong>all four lists</strong> on this device with “{pending.fileName}”? This
            can’t be undone.
          </p>
          <div class="button-row">
            <button
              type="button"
              class="button button--danger"
              onClick={() => {
                onImport(pending.state);
                setPending(null);
                setMessage({ kind: 'ok', text: 'Lists imported.' });
              }}
            >
              Replace lists
            </button>
            <button type="button" class="button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p
          class={`backup__message backup__message--${message.kind}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
