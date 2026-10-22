import { useState } from 'preact/hooks';
import { addPhotos } from '../../lib/album/service';

const TOUCH_QUERY = '(pointer: coarse)';
const isTouch = () => typeof matchMedia === 'function' && matchMedia(TOUCH_QUERY).matches;

/**
 * "Take photo" (rear camera on phones) and "From gallery" (several at once).
 * Picking is the whole flow: no preview, no caption, no confirm.
 */
export function AddPhotoButtons({ frameId, frameTitle }: { frameId: string; frameTitle: string }) {
  const [touch] = useState(isTouch);
  const onPick = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    void addPhotos(frameId, files);
  };

  return (
    <div class="album-add">
      <label class="button button--primary album-add__button">
        <span aria-hidden="true">📷</span> {touch ? 'Take photo' : 'Choose photo'}
        <input
          class="visually-hidden"
          type="file"
          accept="image/jpeg,image/*"
          capture="environment"
          aria-label={`${touch ? 'Take a photo' : 'Choose a photo'} for ${frameTitle}`}
          onChange={onPick}
        />
      </label>
      <label class="button album-add__button">
        <span aria-hidden="true">🖼️</span> From gallery
        <input
          class="visually-hidden"
          type="file"
          accept="image/jpeg,image/*"
          multiple
          aria-label={`Add photos from your gallery to ${frameTitle}`}
          onChange={onPick}
        />
      </label>
    </div>
  );
}
