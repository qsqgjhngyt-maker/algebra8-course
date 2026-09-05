const encoder=new TextEncoder();
const MAX_BODY_BYTES=24*1024;
const GOOGLE_ISSUERS=new Set(["accounts.google.com","https://accounts.google.com"]);

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const origin=request.headers.get("Origin")||"";
    if(request.method==="OPTIONS")return preflight(origin,env);
    if(origin!==env.ALLOWED_ORIGIN)return json({error:"origin_not_allowed"},403,origin,env);

    try{
      if(request.method==="GET"&&url.pathname==="/v1/health"){
        return json({
          ok:true,
          ready:requiredConfig(env),
          version:"2.3.0-alpha",
          storage:"none",
          conversationLogging:false,
          region:env.QWEN_REGION||"unset"
        },200,origin,env);
      }
      if(request.method==="POST"&&url.pathname==="/v1/auth/challenge"){
        await enforceRate(env.AUTH_RATE_LIMITER,rateKey(request,"challenge"));
        const body=await readJson(request);
        const purpose=String(body.purpose||"");
        if(!["enroll","temporary-credential","qwen-test"].includes(purpose))throw httpError(400,"invalid_purpose");
        const now=Math.floor(Date.now()/1000);
        const nonce=randomId(18);
        const payload={
          typ:"challenge",purpose,nonce,jti:randomId(18),
          clientNonce:String(body.clientNonce||"").slice(0,128),
          aud:env.ALLOWED_ORIGIN,iat:now,
          exp:now+boundedInt(env.CHALLENGE_TTL_SECONDS,120,30,300)
        };
        return json({nonce,challengeToken:await signObject(payload,env.GRANT_SIGNING_SECRET),expiresAt:payload.exp},200,origin,env);
      }
      if(request.method==="POST"&&url.pathname==="/v1/enroll"){
        await enforceRate(env.AUTH_RATE_LIMITER,rateKey(request,"enroll"));
        const body=await readJson(request);
        const challenge=await verifyObject(body.challengeToken,env.GRANT_SIGNING_SECRET);
        validateChallenge(challenge,"enroll",env);
        await rejectReplay(env,challenge.jti);
        const google=await verifyGoogleIdToken(body.googleCredential,env.GOOGLE_CLIENT_ID,challenge.nonce);
        if(!safeEqual(String(google.sub||""),String(env.PARENT_GOOGLE_SUB||"")))throw httpError(403,"parent_not_allowed");
        const publicJwk=validatePublicJwk(body.publicJwk);
        const thumbprint=await jwkThumbprint(publicJwk);
        await verifyDeviceProof(publicJwk,body.proof,`enroll\n${body.challengeToken}\n${thumbprint}`);
        const now=Math.floor(Date.now()/1000);
        const certificate={
          typ:"device",cnf:{jkt:thumbprint,jwk:publicJwk},
          parentSubHash:await sha256Text(String(google.sub)),
          aud:env.ALLOWED_ORIGIN,iat:now,
          exp:now+boundedInt(env.DEVICE_CERT_TTL_SECONDS,43200,300,86400)
        };
        return json({deviceCertificate:await signObject(certificate,env.GRANT_SIGNING_SECRET),expiresAt:certificate.exp},200,origin,env);
      }
      if(request.method==="POST"&&url.pathname==="/v1/temporary-credential"){
        const body=await readJson(request);
        const challenge=await verifyObject(body.challengeToken,env.GRANT_SIGNING_SECRET);
        validateChallenge(challenge,"temporary-credential",env);
        const certificate=await verifyObject(body.deviceCertificate,env.GRANT_SIGNING_SECRET);
        validateCertificate(certificate,env);
        await enforceRate(env.TOKEN_RATE_LIMITER,certificate.cnf.jkt);
        await rejectReplay(env,challenge.jti);
        await verifyDeviceProof(certificate.cnf.jwk,body.proof,`temporary-credential\n${body.challengeToken}\n${body.deviceCertificate}`);
        const upstream=await fetch(env.QWEN_TEMP_TOKEN_URL,{
          method:"POST",
          headers:{"Authorization":`Bearer ${env.DASHSCOPE_API_KEY}`},
          cf:{cacheTtl:0,cacheEverything:false}
        });
        const text=await upstream.text();
        let result={};try{result=JSON.parse(text)}catch(e){}
        if(!upstream.ok||!result.token)throw httpError(502,"temporary_credential_failed");
        return json({token:result.token,expiresAt:result.expires_at,tokenType:"Bearer"},200,origin,env);
      }
      if(request.method==="POST"&&url.pathname==="/v1/qwen/test"){
        const body=await readJson(request);
        if(Object.keys(body).some(key=>!["challengeToken","deviceCertificate","proof"].includes(key)))throw httpError(400,"unexpected_field");
        const challenge=await verifyObject(body.challengeToken,env.GRANT_SIGNING_SECRET);
        validateChallenge(challenge,"qwen-test",env);
        const certificate=await verifyObject(body.deviceCertificate,env.GRANT_SIGNING_SECRET);
        validateCertificate(certificate,env);
        await enforceRate(env.TOKEN_RATE_LIMITER,`qwen-test:${certificate.cnf.jkt}`);
        await rejectReplay(env,challenge.jti);
        await verifyDeviceProof(certificate.cnf.jwk,body.proof,`qwen-test\n${body.challengeToken}\n${body.deviceCertificate}`);

        const issued=await mintTemporaryCredential(env);
        const upstream=await fetch(new URL("chat/completions",env.QWEN_API_BASE.replace(/\/?$/,"/")).toString(),{
          method:"POST",
          headers:{"Authorization":`Bearer ${issued.token}`,"Content-Type":"application/json"},
          body:JSON.stringify({
            model:env.QWEN_MODEL,
            messages:[
              {role:"system",content:"Ответь безопасно и очень кратко. Это техническая проверка соединения."},
              {role:"user",content:"Ответь одним словом: готово"}
            ],
            stream:false,max_tokens:12,temperature:0
          }),
          cf:{cacheTtl:0,cacheEverything:false}
        });
        const text=await upstream.text();
        let result={};try{result=JSON.parse(text)}catch(e){}
        const answer=String(result?.choices?.[0]?.message?.content||"").trim().slice(0,160);
        if(!upstream.ok||!answer)throw httpError(502,"qwen_test_failed");
        return json({answer},200,origin,env);
      }
      return json({error:"not_found"},404,origin,env);
    }catch(error){
      const status=Number(error?.status)||500;
      const message=status>=500?"broker_error":String(error?.message||"invalid_request");
      return json({error:message},status,origin,env);
    }
  }
};

function requiredConfig(env){
  return !!(env.ALLOWED_ORIGIN&&env.GOOGLE_CLIENT_ID&&env.QWEN_TEMP_TOKEN_URL&&env.QWEN_API_BASE&&env.QWEN_MODEL&&
    env.DASHSCOPE_API_KEY&&env.GRANT_SIGNING_SECRET&&env.PARENT_GOOGLE_SUB&&
    env.PARENT_GOOGLE_SUB!=="PENDING_REPLACE_AFTER_FIRST_GOOGLE_SIGNIN");
}
async function mintTemporaryCredential(env){
  const upstream=await fetch(env.QWEN_TEMP_TOKEN_URL,{
    method:"POST",headers:{"Authorization":`Bearer ${env.DASHSCOPE_API_KEY}`},
    cf:{cacheTtl:0,cacheEverything:false}
  });
  const text=await upstream.text();
  let result={};try{result=JSON.parse(text)}catch(e){}
  if(!upstream.ok||!result.token)throw httpError(502,"temporary_credential_failed");
  return result;
}
function httpError(status,message){const error=new Error(message);error.status=status;return error}
function boundedInt(value,fallback,min,max){
  const number=Number.parseInt(value,10);
  return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback;
}
function cors(origin,env){
  return {
    "Access-Control-Allow-Origin":origin===env.ALLOWED_ORIGIN?origin:env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type",
    "Access-Control-Max-Age":"600",
    "Vary":"Origin"
  };
}
function noStoreHeaders(origin,env){
  return {
    ...cors(origin,env),
    "Cache-Control":"no-store, private, max-age=0",
    "Pragma":"no-cache",
    "Content-Type":"application/json; charset=utf-8",
    "X-Content-Type-Options":"nosniff",
    "Referrer-Policy":"no-referrer"
  };
}
function preflight(origin,env){
  if(origin!==env.ALLOWED_ORIGIN)return new Response(null,{status:403,headers:{"Cache-Control":"no-store"}});
  return new Response(null,{status:204,headers:{...cors(origin,env),"Cache-Control":"no-store"}});
}
function json(body,status,origin,env){
  return new Response(JSON.stringify(body),{status,headers:noStoreHeaders(origin,env)});
}
async function readJson(request){
  const declared=Number(request.headers.get("Content-Length")||0);
  if(declared>MAX_BODY_BYTES)throw httpError(413,"body_too_large");
  const text=await request.text();
  if(encoder.encode(text).byteLength>MAX_BODY_BYTES)throw httpError(413,"body_too_large");
  try{return JSON.parse(text||"{}")}catch(e){throw httpError(400,"invalid_json")}
}
async function enforceRate(binding,key){
  if(!binding?.limit)return;
  const result=await binding.limit({key:String(key).slice(0,180)});
  if(!result.success)throw httpError(429,"rate_limited");
}
async function rejectReplay(env,jti){
  if(!jti)throw httpError(401,"missing_jti");
  await enforceRate(env.REPLAY_RATE_LIMITER,`jti:${jti}`);
}
function rateKey(request,purpose){
  return `${purpose}:${request.headers.get("CF-Connecting-IP")||"unknown"}`;
}
function validateChallenge(payload,purpose,env){
  const now=Math.floor(Date.now()/1000);
  if(payload.typ!=="challenge"||payload.purpose!==purpose||payload.aud!==env.ALLOWED_ORIGIN)throw httpError(401,"invalid_challenge");
  if(!payload.exp||payload.exp<now||payload.iat>now+30)throw httpError(401,"expired_challenge");
}
function validateCertificate(payload,env){
  const now=Math.floor(Date.now()/1000);
  if(payload.typ!=="device"||payload.aud!==env.ALLOWED_ORIGIN||!payload.cnf?.jwk||!payload.cnf?.jkt)throw httpError(401,"invalid_device_certificate");
  if(!payload.exp||payload.exp<now||payload.iat>now+30)throw httpError(401,"expired_device_certificate");
}
function validatePublicJwk(jwk){
  if(!jwk||jwk.kty!=="EC"||jwk.crv!=="P-256"||!jwk.x||!jwk.y)throw httpError(400,"invalid_device_key");
  return {kty:"EC",crv:"P-256",x:String(jwk.x),y:String(jwk.y),ext:true,key_ops:["verify"]};
}
async function verifyDeviceProof(jwk,signature,message){
  try{
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,decode64url(signature),encoder.encode(message));
    if(!valid)throw new Error("invalid");
  }catch(error){throw httpError(401,"invalid_device_proof")}
}
async function jwkThumbprint(jwk){
  return encode64url(await crypto.subtle.digest("SHA-256",encoder.encode(JSON.stringify({crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y}))));
}
async function sha256Text(text){
  return encode64url(await crypto.subtle.digest("SHA-256",encoder.encode(text)));
}
async function hmacKey(secret){
  return crypto.subtle.importKey("raw",encoder.encode(String(secret)),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function signObject(payload,secret){
  const encoded=encode64url(encoder.encode(JSON.stringify(payload)));
  const signature=await crypto.subtle.sign("HMAC",await hmacKey(secret),encoder.encode(encoded));
  return `${encoded}.${encode64url(signature)}`;
}
async function verifyObject(token,secret){
  const [encoded,signature,...extra]=String(token||"").split(".");
  if(!encoded||!signature||extra.length)throw httpError(401,"invalid_signed_object");
  const valid=await crypto.subtle.verify("HMAC",await hmacKey(secret),decode64url(signature),encoder.encode(encoded));
  if(!valid)throw httpError(401,"invalid_signed_object");
  try{return JSON.parse(new TextDecoder().decode(decode64url(encoded)))}catch(e){throw httpError(401,"invalid_signed_object")}
}
async function verifyGoogleIdToken(token,clientId,expectedNonce){
  const parts=String(token||"").split(".");
  if(parts.length!==3)throw httpError(401,"invalid_google_token");
  let header,payload;
  try{
    header=JSON.parse(new TextDecoder().decode(decode64url(parts[0])));
    payload=JSON.parse(new TextDecoder().decode(decode64url(parts[1])));
  }catch(e){throw httpError(401,"invalid_google_token")}
  if(header.alg!=="RS256"||!header.kid)throw httpError(401,"invalid_google_algorithm");
  const response=await fetch("https://www.googleapis.com/oauth2/v3/certs",{cf:{cacheTtl:3600,cacheEverything:true}});
  if(!response.ok)throw httpError(502,"google_keys_unavailable");
  const set=await response.json();
  const jwk=set.keys?.find(key=>key.kid===header.kid&&key.kty==="RSA");
  if(!jwk)throw httpError(401,"google_key_not_found");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode64url(parts[2]),encoder.encode(`${parts[0]}.${parts[1]}`));
  const now=Math.floor(Date.now()/1000);
  const audience=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(!valid||!GOOGLE_ISSUERS.has(payload.iss)||!audience.includes(clientId)||!payload.sub)throw httpError(401,"invalid_google_token");
  if(!payload.exp||payload.exp<now||payload.iat>now+60)throw httpError(401,"expired_google_token");
  if(String(payload.nonce||"")!==String(expectedNonce||""))throw httpError(401,"google_nonce_mismatch");
  return payload;
}
function safeEqual(a,b){
  if(!a||!b||a.length!==b.length)return false;
  let result=0;for(let index=0;index<a.length;index++)result|=a.charCodeAt(index)^b.charCodeAt(index);
  return result===0;
}
function randomId(length){return encode64url(crypto.getRandomValues(new Uint8Array(length)))}
function encode64url(value){
  const bytes=value instanceof Uint8Array?value:new Uint8Array(value);
  let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function decode64url(value){
  const normalized=String(value).replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));
  const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return bytes;
}
