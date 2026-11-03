import { sitePixelConfig, type PublicPixelConfig } from "../../shared/site-pixels";

/** Code de base navigateur : aucune donnée cliente n'est incluse ici. */
export function publicTrackingScript(config: PublicPixelConfig = sitePixelConfig): string {
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `(function(w,d){
    var config=${json};
    w.__MISS_SITE_PIXEL_CONFIG=config;
    var metaId=config.facebookPixelId;
    if(metaId){
      var metaIds=w.__missMetaIds || (w.__missMetaIds=new Set());
      if(!metaIds.has(metaId)){
        if(!w.fbq){
          var fbq=w.fbq=function(){
            if(fbq.callMethod) fbq.callMethod.apply(fbq,arguments);
            else fbq.queue.push(Array.prototype.slice.call(arguments));
          };
          if(!w._fbq) w._fbq=fbq;
          fbq.push=fbq;fbq.loaded=true;fbq.version="2.0";fbq.queue=[];
        }
        if(!d.querySelector("script[data-miss-facebook-pixel]")){
          var metaScript=d.createElement("script");
          metaScript.async=true;
          metaScript.src="https://connect.facebook.net/en_US/fbevents.js";
          metaScript.dataset.missFacebookPixel=metaId;
          function reportMeta(stage,message){
            w.__missMetaStatus={pixelId:metaId,stage:stage,src:metaScript.src,error:message || ""};
            w.dispatchEvent(new Event("miss-pixel-status"));
          }
          metaScript.onload=function(){reportMeta("loaded");};
          metaScript.onerror=function(){reportMeta("error","Le script Meta a été bloqué ou n'est pas accessible.");};
          reportMeta("loading");
          d.head.appendChild(metaScript);
        }
        w.fbq("init",metaId);
        w.fbq("track","PageView");
        metaIds.add(metaId);
      }
    }
    var id=config.tiktokPixelId;
    if(!id) return;
    var ids=w.__missTikTokIds || (w.__missTikTokIds=new Set());
    if(ids.has(id)) return;
    w.TiktokAnalyticsObject="ttq";
    var q=w.ttq=w.ttq || [];
    q.methods=q.methods || ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    q.setAndDefer=q.setAndDefer || function(target,name){
      if(typeof target[name]!=="function") target[name]=function(){target.push([name].concat(Array.prototype.slice.call(arguments)));};
    };
    q.methods.forEach(function(name){q.setAndDefer(q,name);});
    q.instance=q.instance || function(pixelId){
      q._i=q._i || {};
      var instance=q._i[pixelId] || (q._i[pixelId]=[]);
      q.methods.forEach(function(name){q.setAndDefer(instance,name);});
      return instance;
    };
    q.load=q.load || function(pixelId,options){
      var sdk="https://analytics.tiktok.com/i18n/pixel/events.js";
      q._i=q._i || {};q._t=q._t || {};q._o=q._o || {};
      var instance=q._i[pixelId] || (q._i[pixelId]=[]);
      instance._u=sdk;q._t[pixelId]=Date.now();q._o[pixelId]=options || {};
      var script=d.createElement("script");
      script.type="text/javascript";script.async=true;
      script.src=sdk+"?sdkid="+encodeURIComponent(pixelId)+"&lib=ttq";
      script.dataset.missTiktokPixel=pixelId;
      function report(stage,message){
        w.__missTikTokStatus={pixelId:pixelId,stage:stage,src:script.src,error:message || ""};
        w.dispatchEvent(new Event("miss-pixel-status"));
      }
      script.onload=function(){report("loaded");};
      script.onerror=function(){report("error","Le script TikTok a été bloqué ou n'est pas accessible.");};
      report("loading");
      d.head.appendChild(script);
    };
    q.load(id);q.page();ids.add(id);
  })(window,document);
`;
}
