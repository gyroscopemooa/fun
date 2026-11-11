// Read-only preflight. Never print the connection URI, passwords, or row data.
import pg from 'pg';
import dotenv from 'dotenv';
import {paymentDatabaseConfig,assertPaymentTls,PAYMENT_DATABASE_PROJECT} from '../src/payments/database-config.js';
dotenv.config({path:new URL('../.env.nicepay-migration',import.meta.url)});
const project=PAYMENT_DATABASE_PROJECT;
let client;
try {
 client=new pg.Client(paymentDatabaseConfig(process.env.MANYTOOL_DATABASE_URL));
 await client.connect();
 assertPaymentTls(client);
 await client.query('BEGIN READ ONLY');
 const result=await client.query("SELECT schemaname,tablename FROM pg_catalog.pg_tables WHERE schemaname IN ('public','manytool_payments') ORDER BY schemaname,tablename");
 await client.query('ROLLBACK');
 console.log(JSON.stringify({connected:true,project,tls:true,readOnly:true,tables:result.rows}));
} catch(error) {
 // PostgreSQL errors can contain user-supplied connection details: print only codes.
 console.error(JSON.stringify({connected:false,code:/^[A-Z0-9_]{2,40}$/.test(error.code??'')?error.code:'PREFLIGHT_FAILED',hint:'Check the intended project URL, database password and trusted TLS connection. No data was changed.'}));
 process.exitCode=1;
} finally {await client?.end().catch(()=>{});}
