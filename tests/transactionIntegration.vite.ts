import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const local=(file:string)=>decodeURIComponent(new URL(file,import.meta.url).pathname).replace(/^\/([A-Za-z]:)/,'$1');
export default defineConfig({plugins:[{
  name:'integration-isolated-read-fixtures',enforce:'pre',
  resolveId(id){
    if(/(?:^|\/)transactionFacade(?:\.ts)?$/.test(id))return local('./transactionIntegration.previewFacade.ts');
    if(/(?:^|\/)contexts\/AuthContext(?:\.tsx)?$/.test(id))return local('./transactionIntegration.previewAuth.tsx');
    if(/(?:^|\/)database\/db(?:\.ts)?$/.test(id)||id==='../db')return local('./transactionIntegration.previewDb.ts');
  },
},react()],server:{host:'127.0.0.1',port:1423,strictPort:true},clearScreen:false});
