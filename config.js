// Supabase 프로젝트 설정값을 붙여 넣는 파일입니다.
// Project Settings > API에서 Project URL과 Publishable key를 확인하세요.
const SUPABASE_URL = "https://frekludmgfeioigjhwsx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY ="sb_publishable_-ShtsyjfUH5v5ebuOqh1hg_QjIQx7Hk";

// 브라우저에서 사용할 Supabase 클라이언트입니다.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
