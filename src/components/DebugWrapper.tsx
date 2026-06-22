// src/components/DebugWrapper.tsx

import React, { useEffect } from 'react';
import { useDebug } from '../hooks/useDebug';

interface DebugWrapperProps {
  name: string;
  children: React.ReactNode;
  logProps?: boolean;
  logRender?: boolean;
}

export const DebugWrapper: React.FC<DebugWrapperProps> = ({
  name,
  children,
  logRender = false,
}) => {
  const { logMount, logUnmount, logRender: logRenderDebug } = useDebug(`Wrapper.${name}`);

  useEffect(() => {
    logMount();
    return () => logUnmount();
  }, []);

  if (logRender) {
    logRenderDebug();
  }

  return <>{children}</>;
};

export default DebugWrapper;