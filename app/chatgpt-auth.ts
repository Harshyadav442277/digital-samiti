import { auth } from '@/lib/auth';
export async function getChatGPTUser() { const { data } = await auth.getSession(); const user = data?.user; return user ? {userId:user.id,fullName:user.name,displayName:user.name,email:user.email} : null; }
