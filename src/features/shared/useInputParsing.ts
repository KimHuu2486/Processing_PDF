import { useCallback, useEffect, useRef, useState } from "react";

type ParsingResult<T> =
  | { current: true; value: T }
  | { current: false };

export function useInputParsing() {
  const [isParsing, setIsParsing] = useState(false);
  const generationRef = useRef(0);

  useEffect(
    () => () => {
      generationRef.current += 1;
    },
    [],
  );

  const runInputParsing = useCallback(
    async <T>(operation: () => Promise<T>): Promise<ParsingResult<T>> => {
      const generation = ++generationRef.current;
      setIsParsing(true);
      try {
        const value = await operation();
        return generationRef.current === generation
          ? { current: true, value }
          : { current: false };
      } catch (error) {
        if (generationRef.current === generation) throw error;
        return { current: false };
      } finally {
        if (generationRef.current === generation) {
          setIsParsing(false);
        }
      }
    },
    [],
  );

  const cancelInputParsing = useCallback(() => {
    generationRef.current += 1;
    setIsParsing(false);
  }, []);

  return {
    isParsing,
    runInputParsing,
    cancelInputParsing,
  };
}
