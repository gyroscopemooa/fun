import {createNicepayRefundConsole} from './nicepay-refund-console.js';
import express from 'express';
import {isPostgresPaymentStore,assertSharedPaymentStorage} from './payment-storage.js';
import {createNicepayCreditCustomer} from './nicepay-credit-customer.js';
import {createNicepayPhotoCustomer} from './nicepay-photo-customer.js';
import {createNicepayBundleCustomer} from './nicepay-bundle-customer.js';
import {createNicepayVideoCustomer} from './nicepay-video-customer.js';
import {createNicepayCustomerStaging} from './nicepay-customer-staging.js';
import {createNicepayStagingUi,createNicepayCheckoutPreview} from './nicepay-staging-ui.js';
import {createNicepayImageStaging} from './nicepay-image-staging.js';
import {createNicepayToolAdapters} from './nicepay-tool-adapters.js';
import {createNicepayStagingRouter} from './nicepay-callback.js';
import {createNicepayPhotoStaging} from './nicepay-photo-staging.js';
import {createNicepayBundleRouter} from './nicepay-bundle-router.js';
import {createNicepayVideoRouter} from './nicepay-video-router.js';

// Reuse existing email-link wallet sessions, never body/email headers or guessed Supabase IDs.
export function createNicepayWalletAuthenticator(creditStore) {
  if (typeof creditStore?.authenticate !== 'function') throw Error('Wallet session store required');
  return req => {
    const header=req.headers.cookie;
    if (typeof header!=='string' || header.length>8192) throw Error('Session required');
    const values=header.split(';').map(v=>v.trim()).filter(v=>v.startsWith('manytool_credit_session='));
    if(values.length!==1)throw Error('One wallet session required');
    const token=values[0].slice('manytool_credit_session='.length);
    if(!/^[a-f0-9]{64}$/.test(token))throw Error('Invalid wallet session');
    return creditStore.authenticate(token,'session',false);
  };
}

/** Explicit unmounted assembly; no environment activation, listener, login email, or provider client.
 * Payment configuration/catalog/clients must be supplied by the staging operator.
 */
export async function createNicepayServerStaging({enabled=false,store,creditStore,origin,
  payment,photo,image,bundles,video,tools,allowPaidTools=false,operators=[],customerEnabled=false,customerPhotoChoices=[],refundOperations}={}) {
  const router=express.Router();
  if(!enabled){
    router.use((_req,res)=>res.status(503).set('Cache-Control','no-store').json({error:'NICE staging disabled'}));
    return {router};
  }
  if(new URL(origin).origin!==origin||new URL(origin).protocol!=='https:')throw Error('Exact HTTPS origin required');
  if(isPostgresPaymentStore(store)||isPostgresPaymentStore(creditStore)){
    assertSharedPaymentStorage(store,creditStore);
    if(photo||image||bundles||video||tools||allowPaidTools||Object.values(payment?.catalog??{}).some(p=>p.category!=='credit_topup'))throw Error('PostgreSQL staging is limited to credit topups until tool storage is migrated');
    const authenticate=createNicepayWalletAuthenticator(creditStore);
    const common={enabled:true,store,creditStore,origin,authenticate};
    router.use('/payment',createNicepayStagingRouter({...payment,...common}));
    router.use('/customer-credits',createNicepayCreditCustomer({...common,enabled:customerEnabled,payment}));
    router.use('/refunds',createNicepayRefundConsole({...common,enabled:customerEnabled,operators,refundOperations}));
    return {router};
  }
  // Photo checkout must always use the private snapshot-binding route, never a second generic path.
  const photoProducts=new Set(['base','add2','add3','add7','passport_addon','headshot_addon']);
  if(Object.keys(payment?.catalog??{}).some(id=>photoProducts.has(id)))throw Error('Photo products require the dedicated photo checkout');
  const toolAdapters={...(payment?.toolAdapters??{})};
  if(tools){
    const built=createNicepayToolAdapters({enabled:true,...tools});
    const providerFor=id=>id==='ai_manseryeok'?'analyzeSaju':id==='calorie'?'analyzeMealCalories':id==='ai_personal_color'?'analyzePersonalColor':'generateCommerceDetailPage';
    for(const [id,adapter] of Object.entries(built)){
      if(allowPaidTools||typeof tools[providerFor(id)]==='function')toolAdapters[id]=adapter;
    }
  }
  // Reject unconnected direct products before exposing a payable form.
  for(const [id,product] of Object.entries(payment?.catalog??{})){
    if(product.category!=='direct')continue;
    const oneShot=toolAdapters[id];
    const connected=oneShot&&typeof oneShot.validate==='function'&&typeof oneShot.execute==='function';
    const bundle=bundles&&['ai_pet_translator','ai_name_premium'].includes(id);
    const conversion=video&&id==='video_mkv_mp4';
    if(!connected&&!bundle&&!conversion)throw Error('Direct product has no execution route: '+id);
  }
  const authenticate=createNicepayWalletAuthenticator(creditStore);
  const common={enabled:true,store,creditStore,origin,authenticate};
  // Also validates shared persistent database and explicit confirmed payment configuration.
  router.use('/payment',createNicepayStagingRouter({...payment,...common,toolAdapters}));
  router.get('/session',(req,res)=>{
    res.set('Cache-Control','no-store');
    if(req.headers.origin!==origin)return res.status(403).json({error:'Origin rejected'});
    try {res.json({authenticated:true,owner:authenticate(req)});}
    catch {res.status(401).json({error:'Authentication required'});}
  });
  let photoRuntime;
  if(photo){
    photoRuntime=await createNicepayPhotoStaging({...photo,...common});
    router.use('/photo',photoRuntime.router);
  }
  let imageRuntime;
  if(image){
    imageRuntime=await createNicepayImageStaging({...image,...common});
    router.use('/image',imageRuntime.router);
  }
  if(bundles){
    // No accidental lazy default paid pet provider when assembling tests/staging.
    if(typeof bundles.analyzePetAudio!=='function')throw Error('Explicit pet provider required');
    router.use('/bundles',createNicepayBundleRouter({...bundles,...common}));
  }
  if(video)router.use('/video',await createNicepayVideoRouter({...video,...common,wallet:creditStore}));
  router.use('/customer',createNicepayCustomerStaging({...common,enabled:customerEnabled,payment,toolAdapters}));
  router.use('/customer-video',createNicepayVideoCustomer({...common,enabled:customerEnabled&&Boolean(video),payment}));
  router.use('/customer-bundles',createNicepayBundleCustomer({...common,enabled:customerEnabled&&Boolean(bundles),payment}));
  const customerSurfaces={};
  if(photoRuntime)customerSurfaces.photo={...photo,...photoRuntime};
  if(imageRuntime)customerSurfaces.image={...image,...imageRuntime};
  router.use('/customer-photo',createNicepayPhotoCustomer({...common,enabled:customerEnabled,surfaces:customerSurfaces,choices:customerPhotoChoices}));
  router.use('/refunds',createNicepayRefundConsole({...common,enabled:customerEnabled,operators,refundOperations}));
  router.use('/customer-credits',createNicepayCreditCustomer({...common,enabled:customerEnabled,payment}));
  const uiOptions={store,authenticate,origin,payment,photo,image,operators};
  router.use('/checkout-preview',createNicepayCheckoutPreview(uiOptions));
  router.use('/ui',createNicepayStagingUi(uiOptions));
  return {router,photo:photoRuntime,image:imageRuntime};
}
