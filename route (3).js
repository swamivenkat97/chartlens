import { analyzeHierarchy, hierarchyWait, FRAME_MS } from "@/lib/hierarchy-analysis.mjs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const symbols={XAUUSD:{td:"XAU/USD"},BTCUSD:{td:"BTC/USD"}};
const intervals={"4H":{td:"4h",binance:"4h"},"1H":{td:"1h",binance:"1h"},"15m":{td:"15min",binance:"15m"},"5m":{td:"5min",binance:"5m"}};
const cache=new Map(),pending=new Map();
const reply=data=>Response.json(data,{headers:{"Cache-Control":"no-store"}});
async function frame(instrument,tf){
  if(instrument.td){
    const query=new URLSearchParams({symbol:instrument.td,interval:intervals[tf].td,outputsize:"300",timezone:"UTC",order:"asc",apikey:process.env.TWELVE_DATA_API_KEY});
    const response=await fetch(`https://api.twelvedata.com/time_series?${query}`,{cache:"no-store",signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error("feed");const data=await response.json();
    if(!Array.isArray(data.values)||data.status==="error"||data.meta?.symbol!==instrument.td||data.meta?.interval!==intervals[tf].td)throw new Error("feed");
    return data.values.map(v=>({t:Date.parse(v.datetime.replace(" ","T")+"Z"),o:Number(v.open),h:Number(v.high),l:Number(v.low),c:Number(v.close),v:v.volume!=null&&v.volume!==""?Number(v.volume):null}));
  }
  const response=await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${instrument.binance}&interval=${intervals[tf].binance}&limit=300`,{cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error("feed");const data=await response.json();if(!Array.isArray(data))throw new Error("feed");
  return data.map(k=>({t:Number(k[0]),o:Number(k[1]),h:Number(k[2]),l:Number(k[3]),c:Number(k[4]),v:Number(k[5])}));
}
export async function GET(req){
  const symbol=new URL(req.url).searchParams.get("symbol")||"XAUUSD",instrument=symbols[symbol];
  if(!instrument)return Response.json({error:"Unsupported instrument."},{status:400});
  if(instrument.td&&!process.env.TWELVE_DATA_API_KEY)return reply({...hierarchyWait("Market feed not connected. Add TWELVE_DATA_API_KEY in Vercel and redeploy. No AI key is needed.","not_connected"),symbol});
  let task=pending.get(symbol);const stored=cache.get(symbol);
  if(!task&&(!stored||Date.now()-stored.at>=60000)){
    task=(async()=>{
      const timeframes=Object.keys(FRAME_MS),results=await Promise.allSettled(timeframes.map(tf=>frame(instrument,tf)));
      const failed=timeframes.filter((_,i)=>results[i].status==="rejected");
      if(failed.length)return {failure:`Unable to load ${failed.join(", ")} candles. Check feed coverage, API quota and access. No trade.`,at:Date.now()};
      return {frames:Object.fromEntries(timeframes.map((tf,i)=>[tf,results[i].value])),at:Date.now()};
    })();pending.set(symbol,task);
  }
  try{
    const data=task?await task:stored;if(task)cache.set(symbol,data);
    if(data.failure)return reply({...hierarchyWait(data.failure),symbol});
    return reply({...analyzeHierarchy(data.frames,{symbol,source:instrument.td?"twelvedata":"binance"}),fetchedAt:new Date(data.at).toISOString()});
  }catch{return reply({...hierarchyWait("Market feed unavailable. Previous signals are invalid; NO TRADE."),symbol});}
  finally{if(task&&pending.get(symbol)===task)pending.delete(symbol);}
}
