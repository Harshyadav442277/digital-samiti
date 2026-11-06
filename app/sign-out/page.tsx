'use client';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
export default function SignOut(){ useEffect(()=>{authClient.signOut().finally(()=>location.replace('/'));},[]);return <div className="loading-state">Signing out…</div>;}
