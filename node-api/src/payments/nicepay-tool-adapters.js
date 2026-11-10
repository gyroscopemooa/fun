// Actual Manytool implementation, opt-in only in the unmounted staging router.
// No production catalog registration or price changes are made here.
export function createNicepayToolAdapters({enabled=false,analyzeSaju,analyzeMealCalories,analyzePersonalColor,generateCommerceDetailPage}={}){
 if(!enabled)return {};
 const adapters={ai_manseryeok:{
  async validate(input){
   if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid saju input');
   const {name='',birthDate,birthTime='12:00',calendarType='solar',isLeapMonth=false,timeUnknown=false,locale='ko'}=input;
   if(typeof name!=='string'||name.length>80||typeof birthDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!['solar','lunar'].includes(calendarType)
    ||typeof birthTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime)||typeof isLeapMonth!=='boolean'||typeof timeUnknown!=='boolean'||!['ko','en','ja','zh'].includes(locale))throw Error('Invalid saju input');
   const [year,month,day]=birthDate.split('-').map(Number);
   if(year<1900||year>2100||month<1||month>12||day<1||day>(calendarType==='lunar'?30:new Date(Date.UTC(year,month,0)).getUTCDate()))throw Error('Invalid birth date');
   return {name:name.trim(),birthDate,birthTime,calendarType,isLeapMonth,timeUnknown,locale};
  },
  async execute(input){
   const run=analyzeSaju??(await import('../commerce/sajuAnalyzer.js')).analyzeSaju;
   return run(input);
  }
 }};
 adapters.calorie={validate:async input=>{
   const imageDataUrl=await validateImage(input?.imageDataUrl),locale=validLocale(input?.locale);
   const goal=input?.goal??'maintain';if(!['lose','maintain','gain'].includes(goal))throw Error('Invalid calorie goal');
   return {imageDataUrl,locale,goal};
 },execute:async input=>(analyzeMealCalories??(await import('../commerce/calorieAnalyzer.js')).analyzeMealCalories)(input)};
 adapters.ai_personal_color={validate:async input=>{
   const imageDataUrl=await validateImage(input?.imageDataUrl),locale=validLocale(input?.locale),notes=bounded(input?.notes,1000);
   return {imageDataUrl,locale,notes};
 },execute:async input=>(analyzePersonalColor??(await import('../commerce/personalColorAnalyzer.js')).analyzePersonalColor)(input)};
 for(const pageCount of [5,7,10,15,20])adapters[`detail_page_${pageCount}`]={validate:async input=>{
   if(!Array.isArray(input?.images)||!input.images.length||input.images.length>30)throw Error('1-30 images required');
   if(input.pageCount!==undefined&&input.pageCount!==pageCount)throw Error('Purchased page count mismatch');
   const productName=bounded(input.productName,200);if(!productName)throw Error('Product name required');
   const images=[];for(const image of input.images)images.push(await validateImage(image));
   return {productName,price:bounded(input.price,200),audience:bounded(input.audience,1000),sellingPoints:bounded(input.sellingPoints,3000),prompt:bounded(input.prompt,3000),theme:bounded(input.theme,40)||'premium',pageCount,images};
 },execute:async input=>(generateCommerceDetailPage??(await import('../commerce/detailPage.js')).generateCommerceDetailPage)(input)};
 return adapters;
}
function bounded(value='',max){if(typeof value!=='string'||value.length>max)throw Error('Input too long');return value.trim();}
function validLocale(value='ko'){if(!['ko','en','ja','zh','es','de','fr','pt','vi','id'].includes(value))throw Error('Invalid locale');return value;}
async function validateImage(value){
 if(typeof value!=='string'||value.length>750000)throw Error('Image too large');
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);if(!match)throw Error('Inline PNG/JPEG/WebP required');
 const data=Buffer.from(match[2],'base64');if(data.length>550000||data.toString('base64')!==match[2])throw Error('Invalid image encoding');
 const sharp=(await import('sharp')).default;
 const meta=await sharp(data,{limitInputPixels:16000000,animated:false}).metadata();
 if(!['png','jpeg','webp'].includes(meta.format)||meta.format!==match[1]||!meta.width||!meta.height||(meta.pages??1)>1)throw Error('Invalid image');
 return value;
}
