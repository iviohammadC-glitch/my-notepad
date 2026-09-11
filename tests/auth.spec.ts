import {test,expect,type Page} from '@playwright/test';
const base='http://localhost:5274';
const endpoint='https://dailypad-test.supabase.co';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
function mockServer(){
 const users=new Map<string,any>();const rows=new Map<string,{data:any;revision:number}>();const requests:string[]=[];let offline=false;
 const user=(id:string,email:string,name:string)=>({id,email,aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{display_name:name},identities:[]});
 users.set('a@example.com',{user:user(a,'a@example.com','امیر'),password:'Password12345'});users.set('b@example.com',{user:user(b,'b@example.com','سارا'),password:'Password12345'});
 const token=(u:any)=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';
 const session=(u:any)=>({access_token:token(u),refresh_token:'refresh-'+u.id,expires_in:3600,token_type:'bearer',user:u});
 const attach=async(page:Page)=>{await page.route(endpoint+'/**',async route=>{
  const req=route.request(),url=new URL(req.url());requests.push(url.pathname);const body=req.postDataJSON()||{};const send=(json:any,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)});
  if(url.pathname==='/auth/v1/token'){const record=users.get(body.email);if(!record||record.password!==body.password)return send({code:'invalid_credentials',msg:'Invalid login credentials'},400);return send(session(record.user))}
  if(url.pathname==='/auth/v1/signup'){users.set(body.email,{user:user('33333333-3333-4333-8333-333333333333',body.email,body.data?.display_name||''),password:body.password});return send(users.get(body.email).user)}
  if(url.pathname==='/auth/v1/recover'||url.pathname==='/auth/v1/resend')return send({});
  let id='';try{id=JSON.parse(Buffer.from((req.headers().authorization||'').split(' ')[1].split('.')[1],'base64url').toString()).sub}catch{}
  const record=[...users.values()].find(u=>u.user.id===id);
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  if(url.pathname==='/auth/v1/user'){if(!record)return send({message:'unauthorized'},401);if(req.method()==='PUT')record.password=body.password;return send(record.user)}
  if(!record)return send({message:'unauthorized'},401);
  if(url.pathname==='/rest/v1/workspaces'){const row=rows.get(id);return send(row?[row]:[])}
  if(url.pathname==='/rest/v1/rpc/save_workspace'){
   if(offline)return route.abort('failed');
   const row=rows.get(id);if((row?.revision||0)!==body.p_expected_revision)return send({code:'40001',message:'WORKSPACE_CONFLICT'},409);
   const rev=(row?.revision||0)+1;rows.set(id,{data:body.p_data,revision:rev});return send(rev);
  }
  return send({message:'unmocked '+url.pathname},500);
 })};
 return {attach,rows,requests,users,session,setOffline:(v:boolean)=>offline=v};
}
const login=async(page:Page,email='a@example.com',password='Password12345')=>{await page.getByLabel('ایمیل',{exact:true}).fill(email);await page.getByLabel('رمز عبور',{exact:true}).fill(password);await page.getByRole('button',{name:'ورود به دیلی‌پد',exact:true}).click();await expect(page.getByRole('heading',{name:/روزت بخیر|عصرت بخیر|صبح بخیر/})).toBeVisible();await expect(page.locator('.account-ribbon')).toContainText('ذخیره‌شده در ابر')};
const logout=async(page:Page)=>{await page.locator('.account-ribbon').getByRole('button',{name:'خروج',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'تأیید',exact:true}).click();await expect(page.getByRole('heading',{name:'خوش برگشتی'})).toBeVisible()};

test('account signup, errors, email recovery, sessions and data isolation (mock API)',async({page})=>{
 const mock=mockServer();await mock.attach(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
 await page.getByRole('button',{name:'ساخت حساب',exact:true}).click();await page.getByLabel('نام شما').fill('کاربر تازه');await page.getByLabel('ایمیل',{exact:true}).fill('new@example.com');await page.getByLabel('رمز عبور',{exact:true}).fill('Password12345');await page.getByLabel('تکرار رمز عبور',{exact:true}).fill('Doesnotmatch123');await page.getByRole('button',{name:'ساخت حساب کاربری',exact:true}).click();await expect(page.getByRole('alert')).toContainText('یکسان نیست');
 await page.getByLabel('تکرار رمز عبور',{exact:true}).fill('Password12345');await page.getByRole('button',{name:'ساخت حساب کاربری',exact:true}).click();await expect(page.getByRole('status')).toContainText('لینک تأیید');expect(mock.requests).toContain('/auth/v1/signup');
 await page.getByRole('button',{name:'ورود',exact:true}).click();await page.getByLabel('ایمیل',{exact:true}).fill('a@example.com');await page.getByLabel('رمز عبور',{exact:true}).fill('wrongpassword');await page.getByRole('button',{name:'ورود به دیلی‌پد'}).click();await expect(page.getByRole('alert')).toContainText('درست نیست');
 await page.reload();await page.getByLabel('ایمیل',{exact:true}).fill('a@example.com');await page.getByRole('button',{name:'رمزت را فراموش کردی؟',exact:true}).click();await page.getByRole('button',{name:'ارسال لینک بازیابی',exact:true}).click();await expect(page.getByRole('status')).toContainText('لینک بازیابی');expect(mock.requests).toContain('/auth/v1/recover');await page.getByRole('button',{name:'بازگشت به ورود',exact:true}).click();
 await login(page);await page.getByRole('button',{name:'کار جدید',exact:true}).click();await page.getByLabel('عنوان کار',{exact:true}).fill('کار خصوصی امیر');await page.getByRole('button',{name:'ذخیره کار',exact:true}).click();await expect(page.locator('.account-ribbon')).toContainText('ذخیره‌شده در ابر');await expect.poll(()=>mock.rows.get(a)?.data.tasks[0]?.title).toBe('کار خصوصی امیر');
 await page.reload();await expect(page.locator('.task-title').first()).toHaveText('کار خصوصی امیر');await logout(page);expect(await page.evaluate(id=>localStorage.getItem('dailypad-account-'+id),a)).toBeNull();
 await login(page,'b@example.com');await expect(page.locator('.task-row')).toHaveCount(0);await expect(page.getByText('کار خصوصی امیر')).toHaveCount(0);await logout(page);await login(page);await expect(page.locator('.task-title').first()).toHaveText('کار خصوصی امیر');
 await page.locator('.sidebar nav').getByRole('button',{name:'تنظیمات',exact:true}).click();await page.getByRole('button',{name:'تغییر رمز',exact:true}).click();await page.getByLabel('رمز عبور',{exact:true}).fill('NewPassword98765');await page.getByLabel('تکرار رمز عبور',{exact:true}).fill('NewPassword98765');await page.getByRole('button',{name:'ذخیره رمز جدید',exact:true}).click();await expect(page.locator('.account-ribbon')).toBeVisible();expect(mock.users.get('a@example.com').password).toBe('NewPassword98765');expect(errors).toEqual([]);
});

test('cloud retry, conflict protection, local migration and responsive login (mock API)',async({page})=>{
 const mock=mockServer();await mock.attach(page);await page.goto(base);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tests/account-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'tests/account-desktop.png',fullPage:true});await login(page);
 mock.setOffline(true);await page.getByRole('button',{name:'کار جدید',exact:true}).click();await page.getByLabel('عنوان کار',{exact:true}).fill('ذخیره پس از اتصال');await page.getByRole('button',{name:'ذخیره کار',exact:true}).click();await expect(page.locator('.account-ribbon')).toContainText('ذخیرهٔ ابری انجام نشد');await expect(page.locator('.task-title').first()).toHaveText('ذخیره پس از اتصال');mock.setOffline(false);await page.locator('.account-ribbon').getByRole('button',{name:'تلاش دوباره',exact:true}).click();await expect(page.locator('.account-ribbon')).toContainText('ذخیره‌شده در ابر');
 const row=mock.rows.get(a)!;mock.rows.set(a,{data:row.data,revision:row.revision+1});await page.getByRole('button',{name:'کار جدید',exact:true}).click();await page.getByLabel('عنوان کار',{exact:true}).fill('نسخه محلی متعارض');await page.getByRole('button',{name:'ذخیره کار',exact:true}).click();await expect(page.locator('.account-ribbon')).toContainText('تداخل نسخه‌ها');expect(mock.rows.get(a)!.data.tasks.length).toBe(1);
 const dl=page.waitForEvent('download');await page.getByRole('button',{name:'پشتیبان این نسخه',exact:true}).click();expect((await dl).suggestedFilename()).toContain('DailyPad-account');await page.locator('.account-ribbon').getByRole('button',{name:'تازه‌سازی',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'تأیید',exact:true}).click();await expect(page.locator('.task-row')).toHaveCount(1);await expect(page.locator('.account-ribbon')).toContainText('ذخیره‌شده در ابر');
 const legacy=JSON.parse(JSON.stringify(mock.rows.get(a)!.data));legacy.tasks[0].id='legacy-task';legacy.tasks[0].title='کار نسخه قبلی';await page.evaluate(d=>localStorage.setItem('dailypad-v1',JSON.stringify(d)),legacy);await page.reload();await page.locator('.sidebar nav').getByRole('button',{name:'تنظیمات',exact:true}).click();await page.getByRole('button',{name:'انتقال اطلاعات محلی',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:'تأیید',exact:true}).click();await expect(page.locator('.account-ribbon')).toContainText('ذخیره‌شده در ابر');await expect.poll(()=>mock.rows.get(a)!.data.tasks.length).toBe(2);expect(await page.evaluate(()=>!!localStorage.getItem('dailypad-v1'))).toBe(true);
});

test('unconfigured auth gives setup instructions and working local fallback',async({page})=>{
 await page.goto('http://localhost:5273');await expect(page.getByText('اتصال حساب کاربری هنوز تنظیم نشده')).toBeVisible();await expect(page.getByRole('button',{name:'ورود به دیلی‌پد',exact:true})).toBeDisabled();await page.getByRole('button',{name:'ورود به فضای محلی',exact:true}).click();await page.getByRole('button',{name:'کار جدید',exact:true}).click();await page.getByLabel('عنوان کار',{exact:true}).fill('کار محلی');await page.getByRole('button',{name:'ذخیره کار',exact:true}).click();await page.reload();await expect(page.locator('.task-title').first()).toHaveText('کار محلی');
});


test('recovery email return opens password reset rather than workspace (mock API)',async({page})=>{
 const mock=mockServer();await mock.attach(page);const session=mock.session(mock.users.get('a@example.com').user);
 const fragment=new URLSearchParams({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:'3600',token_type:'bearer',type:'recovery'});
 await page.goto(base+'/?mode=recovery#'+fragment.toString());await expect(page.getByRole('heading',{name:'رمز جدیدت را انتخاب کن'})).toBeVisible();
 await page.getByLabel('رمز عبور',{exact:true}).fill('RecoveredPassword123');await page.getByLabel('تکرار رمز عبور',{exact:true}).fill('RecoveredPassword123');await page.getByRole('button',{name:'ذخیره رمز جدید',exact:true}).click();
 await expect(page.locator('.account-ribbon')).toContainText('ذخیره‌شده در ابر');expect(mock.users.get('a@example.com').password).toBe('RecoveredPassword123');expect(page.url()).not.toContain('mode=recovery');
});
