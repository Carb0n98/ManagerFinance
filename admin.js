// =====================================================
//  ADMIN.JS — Manager Finance Admin Panel
// =====================================================

let currentPage = 'dashboard';

// ── Inicialização ──────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const session = Storage.getSession();
    if (!session) return; // guard já redirecionou

    // Preenche informações do admin na sidebar
    const first = session.name ? session.name[0].toUpperCase() : 'A';
    document.getElementById('adminAvatar').textContent = first;
    document.getElementById('adminName').textContent = session.name || 'Admin';
    document.getElementById('adminEmail').textContent = session.email || '';

    showPage('dashboard');
});

// ── Navegação ──────────────────────────────────────
function showPage(page) {
    currentPage = page;

    // Oculta todas as páginas
    document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Atualiza nav
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Atualiza cabeçalho
    const titles = {
        dashboard: { title: 'Dashboard', sub: 'Visão geral do sistema' },
        usuarios: { title: 'Usuários', sub: 'Gerenciar contas de usuários' },
        codigos: { title: 'Códigos de Registro', sub: 'Gerar e gerenciar convites' }
    };
    const t = titles[page] || { title: page, sub: '' };
    document.getElementById('adminPageTitle').textContent = t.title;
    document.getElementById('adminPageSub').textContent = t.sub;

    // Renderiza a página
    if (page === 'dashboard') renderDashboard();
    if (page === 'usuarios') renderUsers();
    if (page === 'codigos') renderCodes();
}

// ── Dashboard ──────────────────────────────────────
function renderDashboard() {
    const users = Storage.getUsers().filter(u => u.role !== 'admin');
    const codes = Storage.getRegCodes();
    const avail = codes.filter(c => c.active && !c.usedBy).length;
    const used = codes.filter(c => !c.active || c.usedBy).length;
    const history = Storage.getLoginHistory().filter(h => h.role !== 'admin');

    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statCodesTotal').textContent = codes.length;
    document.getElementById('statCodesAvail').textContent = avail;
    document.getElementById('statCodesUsed').textContent = used;

    // Registros recentes (ordenados por createdAt)
    const sortedUsers = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderActivityList('recentRegistrations', sortedUsers.slice(0, 6), u => ({
        name: u.name, email: u.email, time: formatDate(u.createdAt)
    }));

    // Últimos logins
    renderActivityList('recentLogins', history.slice(0, 6), h => ({
        name: h.name, email: h.email, time: formatDate(h.loginTime)
    }));
}

function renderActivityList(containerId, items, mapFn) {
    const container = document.getElementById(containerId);
    if (!items.length) {
        container.innerHTML = '<div class="activity-empty">Nenhum registro ainda.</div>';
        return;
    }
    container.innerHTML = items.map(item => {
        const { name, email, time } = mapFn(item);
        const letter = name ? name[0].toUpperCase() : '?';
        return `
            <div class="activity-item">
                <div class="activity-avatar">${letter}</div>
                <div class="activity-info">
                    <div class="activity-name">${esc(name)}</div>
                    <div class="activity-email">${esc(email)}</div>
                </div>
                <div class="activity-time">${time}</div>
            </div>`;
    }).join('');
}

// ── Usuários ───────────────────────────────────────
function renderUsers() {
    const users = Storage.getUsers();
    const tbody = document.getElementById('usersTableBody');
    document.getElementById('userCount').textContent = `${users.length} usuário${users.length !== 1 ? 's' : ''}`;

    if (!users.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#888;padding:32px">Nenhum usuário cadastrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => {
        const letter = u.name ? u.name[0].toUpperCase() : '?';
        const isAdmin = u.role === 'admin';
        const badgeCls = isAdmin ? 'badge-admin' : 'badge-user';
        const badgeTxt = isAdmin ? 'Admin' : 'Usuário';
        const session = Storage.getSession();
        const isCurrentUser = session && session.userId === u.id;
        const deleteBtn = isCurrentUser
            ? `<span style="color:#bbb;font-size:12px">Você</span>`
            : `<button class="btn-icon danger" onclick="deleteUser('${u.id}')" title="Deletar usuário">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
               </button>`;

        return `<tr>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${letter}</div>
                    <span class="user-cell-name">${esc(u.name)}</span>
                </div>
            </td>
            <td style="color:#555">${esc(u.email)}</td>
            <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
            <td style="color:#888">${formatDate(u.createdAt)}</td>
            <td style="color:#888">${u.lastLogin ? formatDate(u.lastLogin) : '—'}</td>
            <td><div class="tbl-actions">${deleteBtn}</div></td>
        </tr>`;
    }).join('');
}

function deleteUser(userId) {
    const users = Storage.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (!confirm(`Deletar o usuário "${user.name}" (${user.email})?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
        Storage.deleteUser(userId);
        renderUsers();
        renderDashboard();
        toast(`Usuário "${user.name}" removido.`, 'danger');
    } catch (err) {
        toast(err.message, 'danger');
    }
}

// ── Códigos ────────────────────────────────────────
function renderCodes() {
    const codes = Storage.getRegCodes().slice().reverse(); // mais recentes primeiro
    const tbody = document.getElementById('codesTableBody');
    const empty = document.getElementById('codesEmpty');

    if (!codes.length) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = codes.map(c => {
        const avail = c.active && !c.usedBy;
        const badgeCls = avail ? 'badge-avail' : 'badge-used';
        const statusTxt = avail ? 'Disponível' : 'Utilizado';

        const actions = avail
            ? `<button class="btn-icon copy"  onclick="copyCode('${c.code}')" title="Copiar código">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
               </button>
               <button class="btn-icon danger" onclick="deleteCode('${c.code}')" title="Deletar código">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4h6v2"/></svg>
               </button>`
            : `<button class="btn-icon copy" onclick="copyCode('${c.code}')" title="Copiar código">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
               </button>`;

        return `<tr>
            <td><span class="code-mono">${esc(c.code)}</span></td>
            <td><span class="badge ${badgeCls}">${statusTxt}</span></td>
            <td style="color:#888">${formatDate(c.createdAt)}</td>
            <td style="color:#555">${esc(c.createdBy || '—')}</td>
            <td style="color:#555">${c.usedBy ? esc(c.usedBy) : '—'}</td>
            <td><div class="tbl-actions">${actions}</div></td>
        </tr>`;
    }).join('');
}

function generateCodes() {
    const count = parseInt(document.getElementById('codeCountSelect').value, 10) || 1;
    try {
        const created = Storage.createRegCodes(count);
        renderCodes();
        if (currentPage === 'dashboard') renderDashboard();
        toast(`${created.length} código${created.length !== 1 ? 's' : ''} gerado${created.length !== 1 ? 's' : ''}!`, 'success');
    } catch (err) {
        toast(err.message, 'danger');
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        toast(`Código ${code} copiado!`, 'success');
    }).catch(() => {
        // Fallback
        const el = document.createElement('textarea');
        el.value = code;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast(`Código ${code} copiado!`, 'success');
    });
}

function deleteCode(code) {
    if (!confirm(`Deletar o código "${code}"?`)) return;
    Storage.deleteRegCode(code);
    renderCodes();
    renderDashboard();
    toast(`Código ${code} removido.`, 'danger');
}

// ── Logout ─────────────────────────────────────────
function adminLogout() {
    if (confirm('Deseja sair do painel admin?')) {
        Storage.logoutUser();
        window.location.replace('auth.html');
    }
}

// ── Helpers ────────────────────────────────────────
function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'agora mesmo';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}d atrás`;

    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let toastTimer;
function toast(msg, type = 'info') {
    const el = document.getElementById('adminToast');
    const icons = { success: '✓', danger: '✕', info: 'ℹ' };
    el.innerHTML = `<strong>${icons[type] || '•'}</strong> ${msg}`;
    el.className = `admin-toast show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
