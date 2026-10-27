import React from 'react';
import ReactDOM from 'react-dom/client';
import { Refine } from '@refinedev/core';
import { dataProvider } from './provider';
import {getSession,clearSession,consumeFromPipeline,LOGIN_PATH} from './auth/session';
import {LoginPage} from './auth/LoginPage';
const root=()=>ReactDOM.createRoot(document.getElementById('root')!);
// Arriving from a Pipeline switch: always a full sign-in here, whatever was stored before. Only that switch shows the login banner;
// the flag is consumed here, once (not in a StrictMode-doubled initializer), so a refresh shows none.
if(new URLSearchParams(location.search).get('from')==='pipeline')clearSession();
if(location.pathname===LOGIN_PATH){if(getSession())location.replace('/');else root().render(<React.StrictMode><LoginPage fromPipeline={consumeFromPipeline()}/></React.StrictMode>)}
else if(!getSession())location.replace(LOGIN_PATH+location.search);
// App and its global stylesheet load only once signed in, so style.css never touches /login.
else Promise.all([import('./App'),import('./style.css')]).then(([{default:App}])=>root().render(<React.StrictMode><Refine dataProvider={dataProvider} resources={['Organization','Rules','Agents','Skills','Tooling','Filetype'].map(name=>({name}))} options={{disableTelemetry:true}}><App/></Refine></React.StrictMode>));
