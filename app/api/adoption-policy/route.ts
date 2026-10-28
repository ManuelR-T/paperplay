import {readAdoptionPolicy} from '@/shared/adoption';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){return Response.json(readAdoptionPolicy(process.env),{headers:{'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'}});}
