import { useRef, useState } from 'preact/hooks';
import { backupFileName, MAX_IMPORT_BYTES, type ParseResult } from '../../lib/list/backup';
import { Icon } from '../Icon';

interface BackupPanelProps<T> {
  /** File name stem, e.g. "gudauri-packing". */
  fileStem: string;
  /** What gets exported/replaced, e.g. "all four lists". */
  scope: string;
  /** What a valid file is, e.g. "a packing list". */
  fileKind: string;
  serialize: (now: Date) => string;
  parse: (text: string) => ParseResult<T>;
  onImport: (value: T) => void;
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Export/import a whole store as JSON, with an inline (non-dialog) replace confirmation. */
export function BackupPanel<T>({
  fileStem,
  scope,
  fileKind,
  serialize,
  parse,
  onImport,
}: BackupPanelProps<T>) {
  const [pending, setPending] = useState<{ fileName: string; value: T } | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportLists = () => {
    const now = new Date();
    download(backupFileName(fileStem, now), serialize(now));
    setMessage({ kind: 'ok', text: `Exported ${scope}.` });
  };

  const readFile = async (file: File | undefined) => {
    setPending(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ kind: 'error', text: `That file is too large to be ${fileKind}.` });
      return;
    }
    const result = parse(await file.text());
    if (result.ok) {
      setMessage(null);
      setPending({ fileName: file.name, value: result.value });
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
            Replace <strong>{scope}</strong> on this device with “{pending.fileName}”? This can’t be
            undone.
          </p>
          <div class="button-row">
            <button
              type="button"
              class="button button--danger"
              onClick={() => {
                onImport(pending.value);
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
