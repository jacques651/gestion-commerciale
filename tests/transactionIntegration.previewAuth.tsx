import type { ReactNode } from 'react';
import { previewUser } from './transactionIntegration.previewData';
export const useAuth=()=>({user:previewUser,loading:false,isAuthenticated:true,hasRole:(roles:readonly string[])=>roles.includes('admin'),logout:()=>{},login:async()=>true,register:async()=>{}});
export function AuthProvider({children}:{children:ReactNode}){return <>{children}</>;}
