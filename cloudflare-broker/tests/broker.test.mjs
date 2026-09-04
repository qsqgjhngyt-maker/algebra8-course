import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const origin="https://owner.github.io";
const encoder=new TextEncoder();

class Limiter {
  constructor(limit=100){this.limitValue=limit;this.counts=new Map()}
  async limit({key}){
    const count=(this.counts.get(key)||0)+1;this.counts.set(key,count);
    return {success:count<=this.limitValue};
  }
}

function env(overrides={}){
  return {
    ALLOWED_ORIGIN:origin,
    GOOGLE_CLIENT_ID:"client.apps.googleusercontent.com",
    QWEN_TEMP_TOKEN_URL:"https://workspace.example/api/v1/tokens?expire_in_seconds=60",
    QWEN_REGION:"test-region",
    DEVICE_CERT_TTL_SECONDS:"43200",
    CHALLENGE_TTL_SECONDS:"120",
    DASHSCOPE_API_KEY:"test-only-permanent-key",
    GRANT_SIGNING_SECRET:"test-only-signing-secret-with-more-than-32-bytes",
    PARENT_GOOGLE_SUB:"parent-subject-123",
    AUTH_RATE_LIMITER:new Limiter(),
    TOKEN_RATE_LIMITER:new Limiter(),
    REPLAY_RATE_LIMITER:new Limiter(1),
    ...overrides
  };
}
function request(path,{method="GET",body,requestOrigin=origin}={}){
  return new Request(`https://broker.example${path}`,{
    method,
    headers:{Origin:requestOrigin,...(body?{"Content-Type":"application/json"}:{})},
    body:body?JSON.stringify(body):undefined
  });
}
function decodePayload(token){
  const part=token.split(".")[0].replace(/-/g,"+").replace(/_/g,"/");
  return JSON.parse(Buffer.from(part,"base64").toString("utf8"));
}
function b64(value){return Buffer.from(value).toString("base64url")}
async function deviceProof(privateKey,message){
  return b64(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},privateKey,encoder.encode(message)));
}
async function thumbprint(jwk){
  const canonical=JSON.stringify({crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y});
  return b64(await crypto.subtle.digest("SHA-256",encoder.encode(canonical)));
}
async function googleToken(privateKey,kid,nonce){
  const now=Math.floor(Date.now()/1000);
  const header=b64(JSON.stringify({alg:"RS256",typ:"JWT",kid}));
  const payload=b64(JSON.stringify({
    iss:"https://accounts.google.com",
    aud:"client.apps.googleusercontent.com",
    sub:"parent-subject-123",
    nonce,iat:now,exp:now+300
  }));
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",privateKey,encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64(signature)}`;
}

test("health is no-store and reveals no secret",async()=>{
  const response=await worker.fetch(request("/v1/health"),env());
  assert.equal(response.status,200);
  assert.match(response.headers.get("Cache-Control"),/no-store/);
  const text=await response.text();
  assert.equal(text.includes("test-only-permanent-key"),false);
  assert.equal(JSON.parse(text).ready,true);
});

test("wrong origin is rejected",async()=>{
  const response=await worker.fetch(request("/v1/health",{requestOrigin:"https://evil.example"}),env());
  assert.equal(response.status,403);
});

test("parent enrollment, replay rejection and temporary credential",async()=>{
  const rsa=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
  const googleJwk=await crypto.subtle.exportKey("jwk",rsa.publicKey);
  googleJwk.kid="google-test-key";
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    const text=String(url);
    if(text.includes("googleapis.com/oauth2/v3/certs"))return Response.json({keys:[googleJwk]});
    if(text.startsWith("https://workspace.example/"))return Response.json({token:"st-test-temporary",expires_at:Math.floor(Date.now()/1000)+60});
    throw new Error(`Unexpected fetch: ${text}`);
  };
  try{
    const bindings=env();
    const challengeResponse=await worker.fetch(request("/v1/auth/challenge",{method:"POST",body:{purpose:"enroll",clientNonce:"test"}}),bindings);
    assert.equal(challengeResponse.status,200);
    const challenge=await challengeResponse.json();
    const deviceKeys=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
    const publicJwk=await crypto.subtle.exportKey("jwk",deviceKeys.publicKey);
    const jkt=await thumbprint(publicJwk);
    const credential=await googleToken(rsa.privateKey,googleJwk.kid,challenge.nonce);
    const proof=await deviceProof(deviceKeys.privateKey,`enroll\n${challenge.challengeToken}\n${jkt}`);
    const enrollBody={googleCredential:credential,challengeToken:challenge.challengeToken,publicJwk,proof};
    const enrollResponse=await worker.fetch(request("/v1/enroll",{method:"POST",body:enrollBody}),bindings);
    assert.equal(enrollResponse.status,200);
    const enrolled=await enrollResponse.json();
    assert.ok(enrolled.deviceCertificate);
    const replayResponse=await worker.fetch(request("/v1/enroll",{method:"POST",body:enrollBody}),bindings);
    assert.equal(replayResponse.status,429);

    const tokenChallengeResponse=await worker.fetch(request("/v1/auth/challenge",{method:"POST",body:{purpose:"temporary-credential",clientNonce:"test-2"}}),bindings);
    const tokenChallenge=await tokenChallengeResponse.json();
    const tokenProof=await deviceProof(deviceKeys.privateKey,`temporary-credential\n${tokenChallenge.challengeToken}\n${enrolled.deviceCertificate}`);
    const tokenResponse=await worker.fetch(request("/v1/temporary-credential",{method:"POST",body:{challengeToken:tokenChallenge.challengeToken,deviceCertificate:enrolled.deviceCertificate,proof:tokenProof}}),bindings);
    assert.equal(tokenResponse.status,200);
    assert.match(tokenResponse.headers.get("Cache-Control"),/no-store/);
    const issued=await tokenResponse.json();
    assert.equal(issued.token,"st-test-temporary");
    assert.equal(decodePayload(enrolled.deviceCertificate).typ,"device");
  }finally{globalThis.fetch=originalFetch}
});
