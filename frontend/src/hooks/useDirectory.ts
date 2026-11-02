import { createContext, useContext } from 'react';
import type { DirectoryUser } from '@/types';

export const DirectoryContext = createContext<{ users: DirectoryUser[]; loading: boolean; reload: () => void }>({
  users: [], loading: false, reload: () => {},
});

export const useDirectory = () => useContext(DirectoryContext);
