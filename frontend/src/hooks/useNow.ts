import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `intervalMs`, so relative labels ("5 min ago") and time-based alarms stay current. */
export const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};
