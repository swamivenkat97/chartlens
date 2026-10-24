import { automaticTechnical, unavailable } from "@/lib/automatic-technical.mjs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const symbols={XAUUSD:{td:"XAU/USD"},BTCUSDT:{binance:"BTCUSDT"},ETHUSDT:{binance:"ETHUSDT"}};
const cache=new Map(),pending=new Map();
const reply=report=>Response.json(report,{headers:{"Cache-Control":"no-store"}});
export async function GET(req){
  const symbol=new URL(req.url).searchParams.get("symbol")||"XAUUSD",instrument=symbols[symbol];
  if(!instrument)return Response.json({error:"Unsupported instrument."},{status:400});
  if(instrument.td&&!process.env.TWELVE_DATA_API_KEY)return reply({...unavailable("XAUUSD feed not connected. Add TWELVE_DATA_API_KEY in Vercel settings and redeploy. No AI key is needed.","not_connected"),symbol});
  let task=pending.get(symbol);
  const existing=cache.get(symbol);
  if(!task&&(!existing||Date.now()-existing.at>=60000)){
    task=(async()=>{
      let rows,source;
      if(instrument.td){
        const query=new URLSearchParams({symbol:instrument.td,interval:"1min",outputsize:"2000",timezone:"UTC",order:"asc",apikey:process.env.TWELVE_DATA_API_KEY});
        const response=await fetch(`https://api.twelvedata.com/time_series?${query}`,{cache:"no-store",signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error("feed");
        const data=await response.json();
        if(!Array.isArray(data.values)||data.status==="error")throw new Error("feed");
        if(data.meta?.symbol!==instrument.td)throw new Error("symbol");
        rows=data.values.map(v=>({t:Date.parse(v.datetime.replace(" ","T")+"Z"),o:Number(v.open),h:Number(v.high),l:Number(v.low),c:Number(v.close),v:v.volume!=null&&v.volume!==""?Number(v.volume):null}));
        source="twelvedata";
      }else{
        const response=await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${instrument.binance}&interval=1m&limit=1000`,{cache:"no-store",signal:AbortSignal.timeout(20000)});
        if(!response.ok)throw new Error("feed");
        const data=await response.json();if(!Array.isArray(data))throw new Error("feed");
        rows=data.map(k=>({t:Number(k[0]),o:Number(k[1]),h:Number(k[2]),l:Number(k[3]),c:Number(k[4]),v:Number(k[5])}));source="binance";
      }
      const value={rows,source,at:Date.now()};cache.set(symbol,value);return value;
    })();
    pending.set(symbol,task);
  }
  try{
    const data=task?await task:existing;
    // Re-evaluate freshness even when serving cached candles.
    return reply({...automaticTechnical(data.rows,{source:data.source,symbol}),fetchedAt:new Date(data.at).toISOString()});
  }catch{
    return reply({...unavailable("Market feed unavailable or access/quota rejected. Check your data subscription and retry. No demo prices are used."),symbol});
  }finally{if(task&&pending.get(symbol)===task)pending.delete(symbol);}
}
