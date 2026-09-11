import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'**/*.spec.ts',timeout:60000,workers:1,
 use:{headless:true,viewport:{width:1280,height:900}},
 webServer:[
  {command:'npm run dev -- --port 5273 --strictPort',url:'http://localhost:5273',timeout:60000,reuseExistingServer:false,env:{VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',VITE_SUPABASE_ANON_KEY:''}},
  {command:'npm run dev -- --port 5274 --strictPort',url:'http://localhost:5274',timeout:60000,reuseExistingServer:false,env:{VITE_SUPABASE_URL:'https://dailypad-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only_not_a_real_key',VITE_SUPABASE_ANON_KEY:''}}
 ]
});
