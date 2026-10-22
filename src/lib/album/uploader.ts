/**
 * One upload attempt for the queue: get a token, then send the photo. Token
 * problems that waiting can't fix (not set up, wrong code, not joined) fail
 * at once with a reason, so a photo never sits at "Uploading 0%" unexplained.
 */
import type { QueueItem } from './queue';
import { metaOf } from './queue';
import type { AlbumRepository, UploadOutcome } from './repository';
import type { TokenResult } from './token';

export interface UploaderDeps {
  getToken(): Promise<TokenResult>;
  clearToken(): void;
  repo: Pick<AlbumRepository, 'upload'>;
}

type TokenError = Extract<TokenResult, { error: string }>['error'];

export const TOKEN_FAILURE: Record<Exclude<TokenError, 'offline'>, string> = {
  'not-set-up': 'The album isn’t set up on the server yet.',
  'wrong-code': 'The group code didn’t work. Re-join with the right code.',
  'not-joined': 'Join the group to add photos.',
};
const NO_CONNECTION = 'Couldn’t reach the server.';
const STATUS_UNAUTHORISED = 401;

export function createUploader({ getToken, clearToken, repo }: UploaderDeps) {
  return async (
    item: QueueItem,
    onProgress: (fraction: number) => void,
  ): Promise<UploadOutcome> => {
    const auth = await getToken();
    if ('error' in auth) {
      return auth.error === 'offline'
        ? { kind: 'retry', status: 0, reason: NO_CONNECTION }
        : { kind: 'failed', status: 0, reason: TOKEN_FAILURE[auth.error] };
    }
    const outcome = await repo.upload(
      auth.token,
      item.frameId,
      metaOf(item),
      item.full,
      item.thumb,
      onProgress,
    );
    // A rejected token (e.g. the signing key was rotated): the next attempt
    // asks for a new one with the stored group code.
    if (outcome.kind === 'retry' && outcome.status === STATUS_UNAUTHORISED) clearToken();
    return outcome;
  };
}
