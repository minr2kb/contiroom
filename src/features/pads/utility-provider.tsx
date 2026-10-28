'use client';

import { createContext, useContext, useState } from 'react';

export type PadContext = {
  key: string | null;
  itemId?: string;
  neededKeys?: string[];
};

type UtilityState = {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  context: PadContext | null;
  setContext: (context: PadContext | null) => void;
};

const UtilityContext = createContext<UtilityState | null>(null);

export const UtilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setOpen] = useState(false);
  const [context, setContext] = useState<PadContext | null>(null);

  return (
    <UtilityContext value={{ isOpen, setOpen, context, setContext }}>
      {children}
    </UtilityContext>
  );
};

export const useUtility = () => {
  const value = useContext(UtilityContext);
  if (!value) throw new Error('UtilityProvider is missing');
  return value;
};
