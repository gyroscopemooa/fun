// Build-time opt-in links only. Never intercept existing Polar/credits fetches.
const paths=Object.freeze({
 '/credits':'customer-credits',
 '/ai-manseryeok':'customer','/ai-calorie-calculator':'customer','/ai-personal-color':'customer',
 '/tools/product-detail-studio':'customer',
 '/ai-id-photo':'customer-photo','/ai-passport-photo':'customer-photo','/ai-headshot':'customer-photo','/ai-photoshop':'customer-photo',
 '/ai-image-generator':'customer-photo','/ai-model-cut':'customer-photo',
 '/ai-pet-translator':'customer-bundles','/name-premium':'customer-bundles',
 '/tools/video-to-mp4':'customer-video'
});
export function nicepayStagingEntry({enabled,basePath,pathname}={}){
 if(enabled!=='true'||typeof pathname!=='string')return null;
 // Only a same-origin path may receive the authenticated staging navigation.
 if(typeof basePath!=='string'||!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath))return null;
 const key=pathname.replace(/\/$/,''),target=paths[key];if(!target)return null;
 return Object.freeze({href:basePath+'/'+target+'/?source='+encodeURIComponent(key),loginHref:'/credits/',label:'새 결제·도구 흐름 테스트',description:'테스트 환경 전용입니다. 기존 결제는 그대로 유지됩니다. 크레딧 계정으로 로그인한 후 이 화면에서 입력·결제·실행하세요.'});
}
export const nicepayStagingPagePaths=Object.freeze(Object.keys(paths));
