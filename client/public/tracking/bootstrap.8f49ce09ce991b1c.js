(function(w,d){
    var config={"facebookPixelId":"","tiktokPixelId":"CUD92NJC77U74NKABJI0","tiktokCode":""};
    w.__MISS_SITE_PIXEL_CONFIG=config;
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