(function(w,d){
    var config={"facebookPixelId":"916933364742371","facebookPixelIds":["916933364742371","1704139624720433"],"tiktokPixelId":"CUD92NJC77U74NKABJI0","tiktokCode":""};
    var metaList=["916933364742371","1704139624720433"];
    var ttList=["CUD92NJC77U74NKABJI0"];
    w.__MISS_SITE_PIXEL_CONFIG=config;
    if(metaList.length){
      var metaIds=w.__missMetaIds || (w.__missMetaIds=new Set());
      var metaStatuses=w.__missMetaStatuses || (w.__missMetaStatuses={});
      var newMetaIds=[];
      metaList.forEach(function(metaId){
        if(!metaId || metaIds.has(metaId)) return;
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
            var err=message || "";
            w.__missMetaStatus={pixelId:metaId,stage:stage,src:metaScript.src,error:err};
            metaList.forEach(function(pid){
              metaStatuses[pid]={pixelId:pid,stage:stage,src:metaScript.src,error:err};
            });
            w.dispatchEvent(new Event("miss-pixel-status"));
          }
          metaScript.onload=function(){reportMeta("loaded");};
          metaScript.onerror=function(){reportMeta("error","Le script Meta a été bloqué ou n'est pas accessible.");};
          reportMeta("loading");
          d.head.appendChild(metaScript);
        }
        w.fbq("init",metaId);
        metaIds.add(metaId);
        newMetaIds.push(metaId);
      });
      if(newMetaIds.length){
        if(!w.__missMetaPageViewSent){
          w.fbq("track","PageView");
          w.__missMetaPageViewSent=true;
        }else{
          newMetaIds.forEach(function(id){w.fbq("trackSingle",id,"PageView");});
        }
      }
    }
    if(config.tiktokCode && !d.querySelector("script[data-miss-tiktok-custom]")){
      var customScript=d.createElement("script");
      customScript.textContent=String(config.tiktokCode).replace(/<\/?script[^>]*>/gi,"");
      customScript.dataset.missTiktokCustom="true";
      d.head.appendChild(customScript);
    }
    if(!ttList.length) return;
    var ids=w.__missTikTokIds || (w.__missTikTokIds=new Set());
    var ttStatuses=w.__missTikTokStatuses || (w.__missTikTokStatuses={});
    var newTtIds=[];
    ttList.forEach(function(id){
      if(!id || ids.has(id)) return;
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
          var payload={pixelId:pixelId,stage:stage,src:script.src,error:message || ""};
          w.__missTikTokStatus=payload;
          ttStatuses[pixelId]=payload;
          w.dispatchEvent(new Event("miss-pixel-status"));
        }
        script.onload=function(){report("loaded");};
        script.onerror=function(){report("error","Le script TikTok a été bloqué ou n'est pas accessible.");};
        report("loading");
        d.head.appendChild(script);
      };
      q.load(id);
      ids.add(id);
      newTtIds.push(id);
    });
    if(newTtIds.length && w.ttq){
      if(!w.__missTikTokPageSent){
        w.ttq.page();
        w.__missTikTokPageSent=true;
      }else if(typeof w.ttq.instance==="function"){
        newTtIds.forEach(function(id){
          var inst=w.ttq.instance(id);
          if(inst && typeof inst.page==="function") inst.page();
        });
      }
    }
  })(window,document);
