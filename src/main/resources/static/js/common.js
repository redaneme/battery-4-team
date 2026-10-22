const COUNTRY_LABEL = {KOREA: '한국', CHINA: '중국', JAPAN: '일본', VIETNAM: '베트남', INDONESIA: '인도네시아'};
const FACTORY_ORDER = ['CHINA', 'JAPAN', 'VIETNAM', 'INDONESIA'];

/** 천 단위 쉼표 */
const fmt = n => Number(n).toLocaleString('ko-KR');

/** 원 → 억원(소수 2자리) */
const eok = won => (won / 1e8).toFixed(2);

/** HTML 에 넣을 문자열의 특수문자를 바꾼다. */
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch =>
	({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));

/** JSON 요청. 실패하면 서버가 준 이유(error)를 담은 Error 를 던진다. 로그인이 풀렸으면(401) 로그인 화면으로 보낸다. */
async function requestJson(url, options) {
	const res = await fetch(url, options);
	let data = null;
	try {
		data = await res.json();
	} catch (e) { /* 본문 없음 */ }
	if (res.status === 401) {
		location.href = '/login';
		throw new Error('로그인이 필요합니다');
	}
	if (!res.ok) {
		const err = new Error((data && data.error) || '요청에 실패했습니다');
		err.conflict = !!(data && data.conflict);
		err.messages = (data && data.messages) || null;
		throw err;
	}
	return data;
}

const getJson = url => requestJson(url, {cache: 'no-store'});

const postJson = (url, body) => requestJson(url, {
	method: 'POST',
	headers: {'Content-Type': 'application/json'},
	body: JSON.stringify(body)
});

/** 모든 화면 상단의 메뉴와 로그인한 아이디. <header class="topbar" data-active="orders"> 안을 채운다. */
(function () {
	const header = document.querySelector('header.topbar');
	if (!header) return;
	const active = header.dataset.active;
	const link = (key, href, label) =>
		`<a href="${href}"${active === key ? ' class="active"' : ''}>${label}</a>`;
	header.innerHTML = `
		<a class="brand" href="/orders">배터리 주문 관리</a>
		<nav>${link('orders', '/orders', '주문 목록')}${link('new', '/orders/new', '주문 추가')}${link('master', '/master', '마스터 데이터')}</nav>
		<div class="user">
			<span></span>
			<button type="button" class="link">로그아웃</button>
		</div>`;
	header.querySelector('button').addEventListener('click', async () => {
		try {
			await postJson('/api/logout', {});
		} catch (e) { /* 이미 로그아웃된 상태여도 로그인 화면으로 간다 */ }
		location.href = '/login';
	});
	getJson('/api/me').then(me => {
		header.querySelector('.user span').textContent = me.username;
	}).catch(() => { /* 401 이면 requestJson 이 로그인 화면으로 보낸다 */ });
})();
