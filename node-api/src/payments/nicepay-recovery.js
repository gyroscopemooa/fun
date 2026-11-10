import {recoverNicepayFulfillments} from './nicepay-fulfillment.js';
import {recoverNicepayRefunds} from './nicepay-refund.js';
import {staleNicepayExecutions} from './nicepay-execution.js';
// Explicit local maintenance entry point. No network transport/charge/refund is invoked.
// Scheduler authorization and persistent paths are supplied by deployment, not this module.
export function runNicepayLocalRecovery({wallet,store,video,now=Date.now()}){
 const walletFile=wallet.db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file;
 const orderFile=store.db.prepare('PRAGMA database_list').all().find(r=>r.name==='main')?.file;
 if(!walletFile||walletFile!==orderFile)throw Error('Shared persistent NICE wallet required');
 return {staleApprovals:store.recoverStale(now),fulfillments:recoverNicepayFulfillments(wallet),
   refunds:recoverNicepayRefunds(wallet,now),tools:staleNicepayExecutions(wallet,now),
   ...(video?{videos:video.recover(now)}:{})};
}
