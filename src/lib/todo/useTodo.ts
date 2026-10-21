import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { createEmptyTodoState } from './model';
import { todoReducer } from './reducer';
import { defaultTodoRepository, type TodoRepository } from './repository';

/** To-do state backed by a repository: loads once, then saves after every change. */
export function useTodo(repository: TodoRepository = defaultTodoRepository) {
  const [state, dispatch] = useReducer(todoReducer, undefined, () => createEmptyTodoState());
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
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    void repository.save(state);
  }, [state, loaded, repository]);

  return { state, dispatch, loaded };
}
