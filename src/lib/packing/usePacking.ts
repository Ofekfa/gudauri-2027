import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { trip } from '../../data/trip';
import { appStore } from '../storage/safeStorage';
import { createEmptyState } from './model';
import { packingReducer } from './reducer';
import { createLocalPackingRepository, type PackingRepository } from './repository';

const TRAVELER_IDS = trip.travelers.map((t) => t.id);

export const defaultPackingRepository = createLocalPackingRepository(appStore, TRAVELER_IDS);

/** Packing state backed by a repository: loads once, then saves after every change. */
export function usePacking(repository: PackingRepository = defaultPackingRepository) {
  const [state, dispatch] = useReducer(packingReducer, undefined, () =>
    createEmptyState(TRAVELER_IDS),
  );
  const [loaded, setLoaded] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((stored) => {
      if (cancelled) return;
      dispatch({ type: 'replaceAll', state: stored });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (!loaded) return;
    // The first change after loading is the loaded state itself.
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    void repository.save(state);
  }, [state, loaded, repository]);

  return { state, dispatch, loaded };
}
