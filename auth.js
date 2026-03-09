// =====================================================
//  AUTH.JS — Manager Finance
//  Lógica de Login e Registro
// =====================================================

let currentTab = 'login';
let _isFirstAdmin = false; // sem usuários = setup admin

// ── Inicialização ──────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    // Se já há sessão ativa, redireciona conforme o papel
    if (Storage.isLoggedIn()) {
        redirectByRole();
        return;
    }

    _isFirstAdmin = !Storage.hasUsers();

    if (_isFirstAdmin) {
        // Primeiro acesso → modo admin
        document.getElementById('adminSetupBanner').style.display = 'flex';
        document.getElementById('regCodeGroup').style.display = 'none';
        switchTab('register');
    } else {
        // Usuários existem → exige código de registro
        document.getElementById('adminSetupBanner').style.display = 'none';
        document.getElementById('regCodeGroup').style.display = 'block';
        switchTab('login');
    }

    document.getElementById('formLogin').addEventListener('submit', handleLogin);
    document.getElementById('formRegister').addEventListener('submit', handleRegister);
});

// ── Alternância de tabs ────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    const loginForm = document.getElementById('formLogin');
    const regForm = document.getElementById('formRegister');
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const indicator = document.getElementById('tabIndicator');
    hideAlert();

    if (tab === 'login') {
        loginForm.classList.add('active');
        regForm.classList.remove('active');
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        indicator.classList.remove('right');
    } else {
        regForm.classList.add('active');
        loginForm.classList.remove('active');
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        indicator.classList.add('right');
    }
    clearErrors();
}

// ── Redirecionamento por papel ─────────────────────
function redirectByRole() {
    const session = Storage.getSession();
    if (session && session.role === 'admin') {
        window.location.replace('admin.html');
    } else {
        window.location.replace('index.html');
    }
}

// ── Login ──────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    hideAlert();
    clearErrors();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showAlert('Preencha todos os campos.', 'error');
        return;
    }

    setLoading('loginBtn', true);
    try {
        const user = await Storage.loginUser({ email, password });
        showAlert('Login realizado! Redirecionando...', 'success');
        setTimeout(() => {
            if (user.role === 'admin') {
                window.location.replace('admin.html');
            } else {
                window.location.replace('index.html');
            }
        }, 500);
    } catch (err) {
        showAlert(err.message, 'error');
        markError('loginEmail');
        markError('loginPassword');
    } finally {
        setLoading('loginBtn', false);
    }
}

// ── Registro ───────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    hideAlert();
    clearErrors();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    const regCode = document.getElementById('regCode')
        ? document.getElementById('regCode').value.trim().toUpperCase()
        : '';

    // Validações básicas
    if (!name || !email || !password || !confirm) {
        showAlert('Preencha todos os campos.', 'error');
        return;
    }
    if (!isValidEmail(email)) {
        showAlert('E-mail inválido.', 'error');
        markError('regEmail');
        return;
    }
    if (password.length < 6) {
        showAlert('A senha deve ter no mínimo 6 caracteres.', 'error');
        markError('regPassword');
        return;
    }
    if (password !== confirm) {
        showAlert('As senhas não coincidem.', 'error');
        markError('regConfirm');
        return;
    }
    if (!_isFirstAdmin && !regCode) {
        showAlert('Informe o código de registro.', 'error');
        markError('regCode');
        return;
    }

    setLoading('registerBtn', true);
    try {
        const user = await Storage.registerUser({
            name, email, password,
            regCode: _isFirstAdmin ? null : regCode,
            isFirstAdmin: _isFirstAdmin
        });
        showAlert(
            _isFirstAdmin
                ? 'Conta admin criada! Abrindo painel...'
                : 'Conta criada! Redirecionando...',
            'success'
        );
        setTimeout(() => {
            if (user.role === 'admin') {
                window.location.replace('admin.html');
            } else {
                window.location.replace('index.html');
            }
        }, 700);
    } catch (err) {
        showAlert(err.message, 'error');
        if (err.message.includes('E-mail')) markError('regEmail');
        if (err.message.includes('Código')) markError('regCode');
    } finally {
        setLoading('registerBtn', false);
    }
}

// ── Força da senha ─────────────────────────────────
function updateStrength(pwd) {
    const wrapper = document.getElementById('strengthWrapper');
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');

    if (!pwd) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = 'flex';

    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    const levels = [
        { cls: 'strength-bad', text: 'Muito fraca', color: '#e74c3c' },
        { cls: 'strength-weak', text: 'Fraca', color: '#f39c12' },
        { cls: 'strength-good', text: 'Boa', color: '#27ae60' },
        { cls: 'strength-good', text: 'Boa', color: '#27ae60' },
        { cls: 'strength-strong', text: 'Forte', color: '#1abc9c' },
        { cls: 'strength-strong', text: 'Muito forte', color: '#1abc9c' },
    ];
    const lvl = levels[Math.min(score, levels.length - 1)];
    fill.className = `strength-bar-fill ${lvl.cls}`;
    label.textContent = lvl.text;
    label.style.color = lvl.color;
}

// ── Mostrar / Ocultar senha ────────────────────────
function togglePwd(inputId, btn) {
    const input = document.getElementById(inputId);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.style.opacity = isText ? '1' : '0.55';
}

// ── Helpers ────────────────────────────────────────
function showAlert(msg, type) {
    const el = document.getElementById('authAlert');
    el.innerHTML = `<strong>${type === 'error' ? '✕' : '✓'}</strong> ${msg}`;
    el.className = `auth-alert ${type}`;
    el.style.display = 'flex';
}
function hideAlert() {
    document.getElementById('authAlert').style.display = 'none';
}
function markError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('error');
}
function clearErrors() {
    document.querySelectorAll('.input-wrapper input').forEach(el => el.classList.remove('error'));
}
function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    btn.querySelector('.btn-text').style.display = loading ? 'none' : 'inline';
    btn.querySelector('.btn-spinner').style.display = loading ? 'inline' : 'none';
    btn.disabled = loading;
}
function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
