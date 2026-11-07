'use client';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
export default function SignOut(){ useEffect(()=>{try{sessionStorage.removeItem('samiti-demo-active');}catch{}authClient.signOut().finally(()=>location.replace('/'));},[]);return <div className="loading-state">Signing out…</div>;}
