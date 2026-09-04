/* =====================================================================
   Kitsune v2.3.0-alpha · public Hybrid Intelligence configuration

   This file is safe to publish. Never put API keys, Google ID tokens,
   device private keys or Cloudflare signing secrets here.
   ===================================================================== */
(() => {
  "use strict";

  window.KITSUNE_HYBRID_CONFIG=Object.freeze({
    enabled:true,
    brokerOrigin:"https://kitsune-hybrid-broker.akronikl.workers.dev",
    googleClientId:"917733706537-8761p6aqah238r1g2anvlhupstu9s98t.apps.googleusercontent.com",
    qwenApiBase:"https://ws-xoczzsb7am4cyl8c.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/",
    qwenModel:"qwen3.7-plus",
    privacyMode:"direct-temporary-credential",
    temporaryCredentialTtlSeconds:60
  });
})();
