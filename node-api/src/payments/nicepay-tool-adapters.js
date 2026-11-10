// Actual Manytool implementation, opt-in only in the unmounted staging router.
// No production catalog registration or price changes are made here.
export function createNicepayToolAdapters({enabled=false,analyzeSaju}={}){
 if(!enabled)return {};
 return {ai_manseryeok:{
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
}
