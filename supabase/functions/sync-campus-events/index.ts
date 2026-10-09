import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser, XMLValidator } from 'npm:fast-xml-parser@4.5.3';
import { array, modernCampusItem, liveWhaleItem, uniqueRows, type EventRow, type SourceConfig, type UniversityConfig } from './adapters.ts';

const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
function feedURL(value:string,source:SourceConfig):string {
  const u=new URL(value);
  if(u.protocol!=='https:' || u.username || u.password || (u.port && u.port!=='443')
    || !source.allowed_feed_hosts.includes(u.hostname.toLowerCase())) throw new Error('Unapproved feed URL');
  return u.href;
}
async function fetchText(value:string,source:SourceConfig):Promise<string> {
  let url=feedURL(value,source);
  for(let redirects=0;redirects<4;redirects++) {
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20_000)});
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get('location');if(!location)throw new Error('Missing redirect');
      url=feedURL(new URL(location,url).href,source);continue;
    }
    if(!response.ok)throw new Error(`Feed HTTP ${response.status}`);
    if(!response.body)throw new Error('Empty body');
    const reader=response.body.getReader();const decoder=new TextDecoder();let text='',size=0;
    try {
      while(true) {const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;
        if(size>5_000_000)throw new Error('Feed exceeds size limit');text+=decoder.decode(chunk.value,{stream:true});}
      return text+decoder.decode();
    } finally {await reader.cancel();}
  }
  throw new Error('Too many feed redirects');
}
async function importSource(source:SourceConfig,campus:UniversityConfig):Promise<{rows:EventRow[];duplicates:number;skipped:number}> {
  let raw:any[]=[];
  if(source.provider==='moderncampus_rss') {
    const xml=await fetchText(source.feed_url,source);
    if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw new Error('Invalid RSS XML');
    const document=new XMLParser({parseTagValue:false,trimValues:true}).parse(xml);
    const channel=document?.rss?.channel;
    if(!channel || (source.expected_feed_title && channel.title!==source.expected_feed_title))throw new Error('Unexpected feed');
    raw=array(channel.item);
  } else if(source.provider==='livewhale_json') {
    let url:string|null=source.feed_url;const seen=new Set<string>();let pages=0;
    while(url) {
      if(seen.has(url)||++pages>20)throw new Error('Invalid/excessive feed pagination');seen.add(url);
      const payload=JSON.parse(await fetchText(url,source));
      const items=Array.isArray(payload)?payload:payload.data ?? payload.results;
      if(!Array.isArray(items))throw new Error('Unexpected LiveWhale response');
      // v1's unpaginated limit is 1000; refuse a potentially truncated import.
      if(Array.isArray(payload)&&items.length>=1000)throw new Error('LiveWhale feed reached 1000; configure pagination/date windows');
      raw.push(...items);
      url=Array.isArray(payload)?null:payload.links?.next ?? null;
      if(raw.length>10_000)throw new Error('Too many events');
    }
  } else throw new Error('Unsupported provider');
  if(!raw.length)throw new Error('Empty feed; existing records retained');
  const rows:EventRow[]=[];let skipped=0;
  for(const item of raw) {
    try {rows.push(source.provider==='moderncampus_rss'?modernCampusItem(item,source,campus):liveWhaleItem(item,source,campus));}
    catch(error) {skipped++;console.warn(`Source ${source.id} skipped an invalid event:`,error instanceof Error?error.message:'Invalid event');}
  }
  if(!rows.length)throw new Error('No valid events; existing records retained');
  return {...uniqueRows(rows),skipped};
}
Deno.serve(async(req)=>{
  if(req.method!=='POST')return respond({error:'POST required'},405);
  const secret=Deno.env.get('CAMPUS_SYNC_SECRET');
  if(!secret)return respond({error:'Sync secret is not configured'},500);
  if(req.headers.get('x-campus-sync-secret')!==secret)return respond({error:'Unauthorized'},401);
  try {
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)throw new Error('Missing backend configuration');
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const [sourceResult,campusResult]=await Promise.all([
      db.from('university_event_sources').select('*').eq('enabled',true),
      db.from('universities').select('id,time_zone,official_hosts').eq('enabled',true),
    ]);
    if(sourceResult.error)throw sourceResult.error;if(campusResult.error)throw campusResult.error;
    const results:any[]=[];
    for(const source of (sourceResult.data??[]) as SourceConfig[]) {
      const campus=(campusResult.data as UniversityConfig[]).find(u=>u.id===source.university_id);if(!campus)continue;
      try {
        const result=await importSource(source,campus);
        const {error}=await db.from('campus_events').upsert(result.rows,{onConflict:'campus,source_id'});
        if(error)throw error;
        const health=await db.from('university_event_sources').update({last_synced_at:new Date().toISOString(),last_error:null}).eq('id',source.id);
        if(health.error)throw health.error;
        results.push({source:source.id,campus:campus.id,success:true,imported:result.rows.length,duplicates:result.duplicates,skipped:result.skipped});
      } catch(error) {
        const message=error instanceof Error?error.message:String((error as any)?.message??'Sync failed');
        console.error(`Source ${source.id} failed:`,message);
        await db.from('university_event_sources').update({last_error:message}).eq('id',source.id);
        results.push({source:source.id,campus:campus.id,success:false,error:message});
      }
    }
    if(!results.length)throw new Error('No enabled sources');
    return respond({success:results.every(r=>r.success),results},results.every(r=>r.success)?200:207);
  } catch(error) {
    console.error('Campus sync failed:',error);
    return respond({error:'Sync failed; inspect function logs. Existing events retained.'},500);
  }
});
