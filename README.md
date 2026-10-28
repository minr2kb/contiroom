# 콘티룸 (contiroom)

곡과 콘티를 편집하고 라이브 가사 화면을 운영하는 Next.js 앱입니다.

## 로컬 실행

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

`.env.local`에는 Supabase 프로젝트 URL과 **publishable** 키를 설정합니다. 서버 비밀 키는 앱에 사용하지 않습니다. 이 저장소의 실제 `.env.local`은 Git에서 제외됩니다.

## 패드 오디오

패드 오디오 파일은 공개 저장소에 포함되지 않습니다. 현재 패드 기능은 `public/pads/pad_{키}.mp3` 파일을 요청하므로, Supabase Storage로 이전하기 전까지는 별도 오디오 파일을 준비해야 사용할 수 있습니다.

## Supabase

- 프로젝트: `contiroom` (`opsfbuuwdsaqffjietmv`)
- 리전: 서울 (`ap-northeast-2`)
- 스키마: [초기 마이그레이션](supabase/migrations/20261023014736_create_contiroom_schema.sql), [소유자·공개 권한](supabase/migrations/20261023030000_public_visibility_and_owner_access.sql), [핸들](supabase/migrations/20261023040000_profiles.sql), [제작 정보](supabase/migrations/20261023041000_song_metadata.sql), [저장·복제](supabase/migrations/20261023042000_saved_songs.sql), [공개 콘티 보정](supabase/migrations/20261023043000_guard_public_conti_publish.sql), [콘티 플레이리스트 주소](supabase/migrations/20261027020637_conti_youtube_playlist.sql), [공개 콘티의 비공개 곡](supabase/migrations/20261028043347_public_conti_private_owner_songs.sql)
- 데이터: `profiles`, `songs`, `saved_songs`, `contis`, `live_sessions`

앱은 Supabase Auth의 이메일과 비밀번호로 로그인합니다. 로그인 페이지에는 신규 가입이나 비밀번호 재설정 기능이 없습니다. 로그인한 사용자는 자신이 소유한 곡과 콘티를 만들고 수정하고 삭제할 수 있습니다. 모든 행의 `visibility` 기본값은 `private`이며, `public`으로 지정한 곡과 콘티는 로그인하지 않아도 읽을 수 있습니다. 공개 콘티에는 공개 곡과 콘티 소유자의 비공개 곡을 담을 수 있습니다. 콘티에 담긴 비공개 곡은 해당 콘티에서 읽을 수 있습니다.

로그인 후 핸들이 없는 계정은 `/onboarding`에서 고유한 핸들을 등록합니다. `@`는 화면에만 붙고 DB에는 1~30자의 소문자·숫자·밑줄 값을 저장합니다. 곡과 콘티의 제작자는 Auth 사용자 ID로 기록하고 핸들로 표시합니다. 곡은 아티스트(연주 팀), 제작일, 공개 범위를 기록합니다. 기존 곡과 콘티의 제작자는 현재 소유자로 채웁니다.

홈은 공개 곡 탐색입니다. **저장**은 원곡을 가리키는 읽기 전용 즐겨찾기이며, 저장한 공개 곡을 콘티에 넣을 수 있습니다. **복제**는 새로운 비공개 곡을 만들고 복제한 사용자를 제작자로 기록한 뒤 편집 화면을 엽니다. 복제본에는 출처 곡 ID가 남습니다. 원곡이 비공개로 바뀌거나 삭제되면 저장 항목과 콘티 참조는 ‘사용할 수 없는 곡’으로 남습니다.

새 Supabase 프로젝트에는 위 마이그레이션을 파일명 순서대로 적용하세요. 이전 관리자 설정용 `app_admins` 테이블은 데이터 보존을 위해 남기되 접근 권한과 정책을 제거합니다. 앱은 이 테이블을 사용하지 않습니다. 사용자 계정은 Supabase Auth에서 관리합니다. 가입을 제한하려면 Supabase Dashboard의 Authentication 설정에서 **Allow new users to sign up**을 끄세요.

현재 연결된 프로젝트의 초기 마이그레이션 이력은 `20261023015103_create_contiroom_schema`로 기록되어 있습니다. 저장소의 초기 파일명은 `20261023014736_create_contiroom_schema.sql`이므로, 이 프로젝트에서 `supabase db push`를 사용하기 전에는 이력을 맞춰야 합니다. 이미 적용된 마이그레이션은 중복 실행하지 마세요.

연결된 프로젝트에는 소유자·공개 권한 마이그레이션이 `20261023025534_public_visibility_and_owner_access`로 적용되어 있습니다.
핸들, 제작 정보, 저장·복제 마이그레이션도 각각 `20261023074346_profiles`, `20261023074354_song_metadata`, `20261023074405_saved_songs`로 적용되어 있습니다.
공개 콘티 보정은 `20261023074852_guard_public_conti_publish`로 적용되어 있습니다.

콘티 상세에서 슬라이드를 열면 `/live/{콘티 ID}`가 새 탭에 표시됩니다. 각 탭의 진행 위치와 화면 설정은 해당 탭 안에서만 유지됩니다. F 키로 전체화면을 전환하고 Esc 키로 종료합니다. 기존 마이그레이션의 `live_sessions` 테이블은 데이터 보존을 위해 남아 있으며 앱에서는 사용하지 않습니다.
