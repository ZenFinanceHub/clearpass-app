import React, { createContext, useContext, useState } from 'react';

type PipVisibilityContextValue = { hidden: boolean; setHidden: (hidden: boolean) => void };

const PipVisibilityContext = createContext<PipVisibilityContextValue>({ hidden: false, setHidden: () => {} });

export function PipVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <PipVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </PipVisibilityContext.Provider>
  );
}

export function usePipVisibility(): PipVisibilityContextValue {
  return useContext(PipVisibilityContext);
}