import { createContext, useContext, type ReactNode } from 'react';
import type { DirectoryUser } from '@/types';

export interface WorkspaceCtx {
  /** The user whose workspace is being shown. */
  owner: DirectoryUser;
  /** True when the viewer is not the owner — all edits hidden. */
  readOnly: boolean;
  /** Pass to [viewable] GET endpoints; undefined for one's own workspace. */
  viewUserId: string | undefined;
}

const Ctx = createContext<WorkspaceCtx | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return c;
}
