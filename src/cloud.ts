import {createClient} from '@supabase/supabase-js';
import {type Data,validate,initialData} from './data';
const url=(import.meta.env.VITE_SUPABASE_URL||'').trim();
const key=(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY||'').trim();
const privileged=(()=>{if(key.startsWith('sb_secret_'))return true;try{return JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role'}catch{return false}})();
export const configured=!privileged&&!!url&&!!key&&/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)&&!key.startsWith('sb_secret_');
const timedFetch:typeof fetch=async(input,init)=>{const controller=new AbortController();const source=init?.signal||(input instanceof Request?input.signal:null);const abort=()=>controller.abort();if(source?.aborted)abort();else source?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,20000);try{return await fetch(input,{...init,signal:controller.signal})}finally{clearTimeout(timer);source?.removeEventListener('abort',abort)}};
export const cloud=configured?createClient(url,key,{global:{fetch:timedFetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}}):null;
export const redirectUrl=(recovery=false)=>window.location.origin+window.location.pathname+(recovery?'?mode=recovery':'');
export const cacheKey=(id:string)=>'dailypad-account-'+id;
export type Cache={data:Data;revision:number;dirty:boolean};
export function cacheRead(id:string):Cache|null {try{const s=localStorage.getItem(cacheKey(id));if(!s)return null;const c=JSON.parse(s);if(!Number.isSafeInteger(c.revision)||c.revision<0||typeof c.dirty!=='boolean')return null;return {...c,data:validate(c.data)}}catch{return null}}
export function cacheWrite(id:string,c:Cache){localStorage.setItem(cacheKey(id),JSON.stringify(c))}
export async function fetchWorkspace(id:string){if(!cloud)throw Error('NOT_CONFIGURED');const {data,error}=await cloud.from('workspaces').select('data,revision').eq('user_id',id).maybeSingle();if(error)throw error;return {data:data?validate(data.data):null,revision:data?Number(data.revision):0}}
export async function saveWorkspace(data:Data,revision:number){if(!cloud)throw Error('NOT_CONFIGURED');const {data:result,error}=await cloud.rpc('save_workspace',{p_data:data,p_expected_revision:revision});if(error)throw error;const rev=Number(result);if(!Number.isSafeInteger(rev)||rev<1)throw Error('INVALID_REVISION');return rev}
export function freshWorkspace(name:string){const d=initialData();d.settings.name=name;return d}
export function authError(error:unknown,fa=true){const e=error as {message?:string;code?:string};const m=e?.message?.toLowerCase()||'';const code=e?.code||'';const t=(f:string,en:string)=>fa?f:en;
 if(code==='23514')return t('ساختار یا حجم داده برای ذخیرهٔ ابری مجاز نیست؛ سقف فضای هر حساب در این نسخه ۸ مگابایت است. ابتدا پشتیبان بگیر.','Workspace payload is invalid or exceeds this version’s 8 MiB limit. Export a backup first.');
 if(m.includes('abort')||m.includes('timeout'))return t('پاسخ سرور طول کشید. اتصال را بررسی کن و دوباره تلاش کن.','The server request timed out. Check your connection and retry.');
 if(m.includes('email address not authorized')||code==='email_address_not_authorized')return t('ارسال ایمیل برای این آدرس مجاز نیست. SMTP اختصاصی Supabase را تنظیم کن یا برای تست از ایمیل عضو تیم پروژه استفاده کن.','Email delivery is not authorized for this address. Configure custom SMTP or test with a project team member’s email.');
 if(code==='invalid_credentials'||m.includes('invalid login'))return t('ایمیل یا رمز عبور درست نیست.','Incorrect email or password.');
 if(m.includes('email not confirmed'))return t('ابتدا لینک تأیید ارسال‌شده به ایمیلت را باز کن.','Please confirm your email first.');
 if(m.includes('already registered')||m.includes('already been registered'))return t('این ایمیل قبلاً ثبت شده؛ وارد شو یا رمزت را بازیابی کن.','This email is already registered. Sign in or reset your password.');
 if(m.includes('rate limit')||m.includes('too many')||code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return t('تعداد درخواست‌ها زیاد است. چند دقیقه بعد دوباره تلاش کن.','Too many requests. Please try again in a few minutes.');
 if(m.includes('password')&&m.includes('weak'))return t('رمز قوی‌تری انتخاب کن؛ دست‌کم ۱۰ نویسه شامل حرف و عدد.','Use a stronger password: at least 10 characters with letters and numbers.');
 if(m.includes('same password'))return t('رمز جدید باید با رمز قبلی متفاوت باشد.','Choose a different password.');
 if(m.includes('expired')||m.includes('invalid token')||m.includes('session missing'))return t('لینک یا نشست منقضی شده؛ دوباره وارد شو یا لینک تازه بگیر.','Your link or session expired. Sign in or request a fresh link.');
 if(code==='PGRST205'||code==='42P01'||code==='PGRST202'||m.includes('schema cache'))return t('دیتابیس آماده نیست. فایل supabase/schema.sql را در SQL Editor پروژه اجرا کن.','Database setup is missing. Run supabase/schema.sql in the project SQL Editor.');
 if(code==='40001'||m.includes('workspace_conflict'))return t('نسخهٔ ابری در دستگاه دیگری تغییر کرده است.','The cloud copy was changed on another device.');
 if(m.includes('fetch')||m.includes('network'))return t('ارتباط برقرار نشد. اینترنت و تنظیمات Supabase را بررسی کن.','Connection failed. Check your internet and Supabase configuration.');
 return t('درخواست انجام نشد. تنظیمات سرویس و اتصال اینترنت را بررسی کن و دوباره تلاش کن.','Request failed. Check service configuration and your connection, then retry.');
}
