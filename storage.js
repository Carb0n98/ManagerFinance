// Sistema de armazenamento de dados com localStorage

const Storage = {
    // Chaves do localStorage
    EXPENSES_KEY: 'expenses',
    INCOMES_KEY: 'incomes',
    CONFIG_KEY: 'config',
    PROFILE_KEY: 'profile',
    USERS_KEY: 'users',
    SESSION_KEY: 'session',
    CODES_KEY: 'reg_codes',
    PURCHASE_REQUESTS_KEY: 'purchase_requests',

    // Configuração padrão
    defaultConfig: {
        currency: 'BRL',
        theme: 'light'
    },

    // Perfil padrão
    defaultProfile: {
        name: '',
        email: '',
        monthlyBudget: 0,
        avatarDataUrl: null
    },

    // Inicializa o armazenamento
    init() {
        if (!localStorage.getItem(this.CONFIG_KEY)) {
            localStorage.setItem(this.CONFIG_KEY, JSON.stringify(this.defaultConfig));
        }
        if (!localStorage.getItem(this.EXPENSES_KEY)) {
            localStorage.setItem(this.EXPENSES_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.INCOMES_KEY)) {
            localStorage.setItem(this.INCOMES_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.PROFILE_KEY)) {
            localStorage.setItem(this.PROFILE_KEY, JSON.stringify(this.defaultProfile));
        }
    },

    // ==================== AUTH ====================

    // Hash SHA-256 (async)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Todos os usuários cadastrados
    getUsers() {
        const users = localStorage.getItem(this.USERS_KEY);
        return users ? JSON.parse(users) : [];
    },

    // Verifica se existe ao menos um usuário cadastrado
    hasUsers() {
        return this.getUsers().length > 0;
    },

    // Registra novo usuário
    // isFirstAdmin: true → primeira conta (sem código), role='admin'
    async registerUser({ name, email, password, regCode = null, isFirstAdmin = false }) {
        const users = this.getUsers();
        const emailLower = email.toLowerCase().trim();

        if (users.find(u => u.email === emailLower)) {
            throw new Error('E-mail já cadastrado.');
        }

        // Usuários normais precisam de código de registro
        if (!isFirstAdmin) {
            if (!regCode || !regCode.trim()) throw new Error('Código de registro obrigatório.');
            this.validateRegCode(regCode); // lança erro se inválido
        }

        const hash = await this.hashPassword(password);
        const role = isFirstAdmin ? 'admin' : 'user';

        const user = {
            id: Date.now().toString(),
            name: name.trim(),
            email: emailLower,
            passwordHash: hash,
            role,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(user);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

        // Marca código como usado (apenas para usuários normais)
        if (!isFirstAdmin && regCode) {
            this.useRegCode(regCode.toUpperCase().trim(), user.id, user.email);
        }

        this._saveSession(user);
        this.saveProfile({ name: user.name, email: user.email });
        this.addLoginHistory(user);
        return user;
    },

    // Login
    async loginUser({ email, password }) {
        const users = this.getUsers();
        const emailLower = email.toLowerCase().trim();
        const userIndex = users.findIndex(u => u.email === emailLower);

        if (userIndex === -1) throw new Error('E-mail não encontrado.');

        const hash = await this.hashPassword(password);
        if (hash !== users[userIndex].passwordHash) throw new Error('Senha incorreta.');

        // Registra último login
        users[userIndex].lastLogin = new Date().toISOString();
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));

        const user = users[userIndex];
        this._saveSession(user);
        this.addLoginHistory(user);
        return user;
    },

    // Deleta usuário pelo ID
    deleteUser(userId) {
        const session = this.getSession();
        if (session && session.userId === userId) throw new Error('Não é possível deletar o usuário logado.');
        const users = this.getUsers().filter(u => u.id !== userId);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Salva sessão no localStorage (inclui role)
    _saveSession(user) {
        const session = {
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role || 'user',
            loggedIn: true,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    },

    // Retorna sessão atual ou null
    getSession() {
        const session = localStorage.getItem(this.SESSION_KEY);
        return session ? JSON.parse(session) : null;
    },

    // Verifica se há sessão ativa
    isLoggedIn() {
        const session = this.getSession();
        return !!(session && session.loggedIn);
    },

    // Verifica se o usuário logado é admin
    isAdmin() {
        const session = this.getSession();
        return !!(session && session.loggedIn && session.role === 'admin');
    },

    // Logout — limpa sessão
    logoutUser() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    // ==================== HISTÓRICO DE LOGIN ====================

    addLoginHistory(user) {
        const history = this.getLoginHistory();
        history.unshift({
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role || 'user',
            loginTime: new Date().toISOString()
        });
        // Mantém no máximo 50 entradas
        localStorage.setItem('login_history', JSON.stringify(history.slice(0, 50)));
    },

    getLoginHistory() {
        const h = localStorage.getItem('login_history');
        return h ? JSON.parse(h) : [];
    },

    // ==================== CÓDIGOS DE REGISTRO ====================

    // Gera string aleatória no formato XXXX-XXXX
    _randomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `${part()}-${part()}`;
    },

    // Cria N códigos de registro
    createRegCodes(count = 1) {
        const codes = this.getRegCodes();
        const session = this.getSession();
        const created = [];

        for (let i = 0; i < count; i++) {
            let code;
            let tries = 0;
            do { code = this._randomCode(); tries++; }
            while (codes.find(c => c.code === code) && tries < 100);

            const entry = {
                code,
                createdAt: new Date().toISOString(),
                createdBy: session ? session.email : 'admin',
                usedBy: null,
                usedAt: null,
                active: true
            };
            codes.push(entry);
            created.push(entry);
        }

        localStorage.setItem(this.CODES_KEY, JSON.stringify(codes));
        return created;
    },

    // Retorna todos os códigos
    getRegCodes() {
        const codes = localStorage.getItem(this.CODES_KEY);
        return codes ? JSON.parse(codes) : [];
    },

    // Valida se um código é válido e não foi usado (lança Error se inválido)
    validateRegCode(code) {
        const codes = this.getRegCodes();
        const entry = codes.find(c => c.code === code.toUpperCase().trim());
        if (!entry) throw new Error('Código de registro inválido.');
        if (!entry.active || entry.usedBy) throw new Error('Código já foi utilizado.');
        return entry;
    },

    // Marca código como usado
    useRegCode(code, userId, userEmail) {
        const codes = this.getRegCodes();
        const idx = codes.findIndex(c => c.code === code);
        if (idx === -1) return;
        codes[idx].usedBy = userEmail;
        codes[idx].usedAt = new Date().toISOString();
        codes[idx].active = false;
        localStorage.setItem(this.CODES_KEY, JSON.stringify(codes));
    },

    // Deleta um código (apenas não-usados)
    deleteRegCode(code) {
        const codes = this.getRegCodes().filter(c => c.code !== code);
        localStorage.setItem(this.CODES_KEY, JSON.stringify(codes));
    },

    // ==================== PERFIL ====================

    // Retorna a chave de perfil do usuário atual (isolada por userId)
    _profileKey() {
        const session = this.getSession();
        return session ? `${this.PROFILE_KEY}_${session.userId}` : this.PROFILE_KEY;
    },

    // Obtém perfil do usuário atual.
    // Ordem de precedência:
    //   1. Dados salvos na chave por usuário (profile_<userId>)
    //   2. Dados da chave antiga compartilhada (profile) — migração
    //   3. Nome/e-mail do cadastro do usuário como fallback
    getProfile() {
        const perUserKey = this._profileKey();
        const raw = localStorage.getItem(perUserKey);
        if (raw) {
            return { ...this.defaultProfile, ...JSON.parse(raw) };
        }

        const session = this.getSession();

        // Tenta migrar da chave antiga compartilhada 'profile'
        const oldRaw = localStorage.getItem(this.PROFILE_KEY);
        if (oldRaw) {
            const oldProfile = JSON.parse(oldRaw);
            // Só migra se o nome bater com o do usuário logado (evita puxar dados de outro)
            const user = session ? this.getUsers().find(u => u.id === session.userId) : null;
            if (!user || !oldProfile.name || oldProfile.name === user.name || !oldProfile.name) {
                localStorage.setItem(perUserKey, oldRaw);
                return { ...this.defaultProfile, ...oldProfile };
            }
        }

        // Sem perfil salvo – semeia com dados do cadastro
        if (session) {
            const user = this.getUsers().find(u => u.id === session.userId);
            if (user) {
                return { ...this.defaultProfile, name: user.name, email: user.email };
            }
        }

        return { ...this.defaultProfile };
    },

    // Salva perfil do usuário atual
    saveProfile(profileData) {
        const existing = this.getProfile();
        const updated = { ...existing, ...profileData };
        localStorage.setItem(this._profileKey(), JSON.stringify(updated));
        return updated;
    },

    // ==================== GASTOS ====================

    // Adiciona um novo gasto (atribui ao usuário da sessão atual, ou ao userId passado)
    addExpense(expense) {
        const expenses = this._getAllExpenses();
        expense.id = Date.now();
        expense.createdAt = new Date().toISOString();
        // Se não foi passado um userId explícito, usa o da sessão atual
        if (!expense.userId) {
            const session = this.getSession();
            if (session) expense.userId = session.userId;
        }
        expenses.push(expense);
        localStorage.setItem(this.EXPENSES_KEY, JSON.stringify(expenses));
        return expense;
    },

    // Obtém TODOS os gastos (uso interno)
    _getAllExpenses() {
        const expenses = localStorage.getItem(this.EXPENSES_KEY);
        return expenses ? JSON.parse(expenses) : [];
    },

    // Obtém gastos do usuário da sessão atual
    getExpenses() {
        const session = this.getSession();
        const all = this._getAllExpenses();
        if (!session) return all;
        // Filtra por userId — gastos sem userId (legados) pertencem ao primeiro usuário cadastrado
        return all.filter(e => !e.userId || e.userId === session.userId);
    },

    // Remove um gasto
    removeExpense(id) {
        const expenses = this._getAllExpenses();
        const filtered = expenses.filter(e => e.id !== id);
        localStorage.setItem(this.EXPENSES_KEY, JSON.stringify(filtered));
    },

    // Limpa todos os gastos
    clearExpenses() {
        localStorage.setItem(this.EXPENSES_KEY, JSON.stringify([]));
    },

    // ==================== RECEITAS / ENTRADAS ====================

    // Adiciona uma entrada de receita (atribuída ao usuário atual ou ao userId passado)
    addIncome(income) {
        const all = this._getAllIncomes();
        income.id = Date.now();
        income.createdAt = new Date().toISOString();
        if (!income.userId) {
            const session = this.getSession();
            if (session) income.userId = session.userId;
        }
        all.push(income);
        localStorage.setItem(this.INCOMES_KEY, JSON.stringify(all));
        return income;
    },

    // Todos os registros de receita (uso interno)
    _getAllIncomes() {
        const raw = localStorage.getItem(this.INCOMES_KEY);
        return raw ? JSON.parse(raw) : [];
    },

    // Receitas do usuário da sessão atual
    getIncomes() {
        const session = this.getSession();
        const all = this._getAllIncomes();
        if (!session) return all;
        return all.filter(i => !i.userId || i.userId === session.userId);
    },

    // Remove uma receita por id
    removeIncome(id) {
        const all = this._getAllIncomes();
        localStorage.setItem(this.INCOMES_KEY, JSON.stringify(all.filter(i => i.id !== id)));
    },

    // Receitas do usuário filtradas por período (mesmo padrão dos gastos)
    getIncomesByPeriod(period) {
        const incomes = this.getIncomes();
        const now = new Date();
        switch (period) {
            case 'week': {
                const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return incomes.filter(i => new Date(i.date) >= start);
            }
            case 'month': {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                return incomes.filter(i => new Date(i.date) >= start);
            }
            case 'year': {
                const start = new Date(now.getFullYear(), 0, 1);
                return incomes.filter(i => new Date(i.date) >= start);
            }
            default:
                return incomes;
        }
    },

    getConfig() {
        const config = localStorage.getItem(this.CONFIG_KEY);
        return config ? JSON.parse(config) : this.defaultConfig;
    },

    // Atualiza configurações
    updateConfig(newConfig) {
        const config = this.getConfig();
        Object.assign(config, newConfig);
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    },

    // Calcula totais por categoria
    calculateTotals() {
        const expenses = this.getExpenses();
        const totals = {
            total: 0,
            Essencial: 0,
            Pessoal: 0,
            Outros: 0
        };

        expenses.forEach(expense => {
            totals.total += parseFloat(expense.amount);
            if (totals.hasOwnProperty(expense.category)) {
                totals[expense.category] += parseFloat(expense.amount);
            }
        });

        return totals;
    },

    // Calcula percentuais
    calculatePercentages() {
        const totals = this.calculateTotals();
        const total = totals.total > 0 ? totals.total : 1;

        // Se não há gastos, retorna 0 para todas as categorias
        if (totals.total === 0) {
            return {
                Essencial: 0,
                Pessoal: 0,
                Outros: 0
            };
        }

        return {
            Essencial: (totals.Essencial / total) * 100,
            Pessoal: (totals.Pessoal / total) * 100,
            Outros: (totals.Outros / total) * 100
        };
    },

    // Formata valor em moeda (usa cache para evitar múltiplas leituras do localStorage)
    formatCurrency(value) {
        if (!this._cachedConfig) {
            this._cachedConfig = this.getConfig();
        }
        const config = this._cachedConfig;
        const currencies = {
            BRL: { symbol: 'R$', locale: 'pt-BR' },
            USD: { symbol: 'US$', locale: 'en-US' },
            EUR: { symbol: '€', locale: 'de-DE' }
        };

        const curr = currencies[config.currency] || currencies.BRL;
        return new Intl.NumberFormat(curr.locale, {
            style: 'currency',
            currency: config.currency
        }).format(value);
    },

    // ==================== CONEXÕES ====================

    // Envia solicitação de conexão para outro usuário pelo ID
    sendConnectionRequest(targetUserId) {
        const session = this.getSession();
        if (!session) throw new Error('Você precisa estar logado.');
        if (session.userId === targetUserId) throw new Error('Você não pode se conectar com você mesmo.');

        const targetUser = this.getUsers().find(u => u.id === targetUserId);
        if (!targetUser) throw new Error('Usuário com este ID não encontrado.');
        if (targetUser.role === 'admin') throw new Error('Não é possível conectar com a conta admin.');

        const requests = this.getConnectionRequests();

        // Verifica se já existe conexão ou pedido
        const alreadyConnected = this.getConnections(session.userId).some(
            c => c.users.includes(targetUserId)
        );
        if (alreadyConnected) throw new Error('Vocês já estão conectados.');

        const existingReq = requests.find(r =>
            ((r.fromUserId === session.userId && r.toUserId === targetUserId) ||
                (r.fromUserId === targetUserId && r.toUserId === session.userId)) &&
            r.status === 'pending'
        );
        if (existingReq) throw new Error('Já existe uma solicitação pendente entre vocês.');

        const req = {
            id: Date.now().toString(),
            fromUserId: session.userId,
            fromUserName: session.name,
            fromUserEmail: session.email,
            toUserId: targetUserId,
            toUserName: targetUser.name,
            toUserEmail: targetUser.email,
            status: 'pending',
            createdAt: new Date().toISOString(),
            respondedAt: null
        };

        requests.push(req);
        localStorage.setItem('connection_requests', JSON.stringify(requests));
        return req;
    },

    // Retorna todas as solicitações
    getConnectionRequests() {
        const r = localStorage.getItem('connection_requests');
        return r ? JSON.parse(r) : [];
    },

    // Solicitações recebidas pelo usuário logado (pendentes)
    getPendingRequests(userId) {
        return this.getConnectionRequests().filter(r => r.toUserId === userId && r.status === 'pending');
    },

    // Solicitações enviadas pelo usuário logado
    getSentRequests(userId) {
        return this.getConnectionRequests().filter(r => r.fromUserId === userId && r.status === 'pending');
    },

    // Aceita uma solicitação e cria a conexão
    acceptConnectionRequest(requestId) {
        const requests = this.getConnectionRequests();
        const idx = requests.findIndex(r => r.id === requestId);
        if (idx === -1) throw new Error('Solicitação não encontrada.');

        requests[idx].status = 'accepted';
        requests[idx].respondedAt = new Date().toISOString();
        localStorage.setItem('connection_requests', JSON.stringify(requests));

        const req = requests[idx];
        const connections = this.getConnectionsRaw();
        connections.push({
            id: Date.now().toString(),
            users: [req.fromUserId, req.toUserId],
            connectedAt: new Date().toISOString()
        });
        localStorage.setItem('connections', JSON.stringify(connections));
    },

    // Rejeita uma solicitação
    rejectConnectionRequest(requestId) {
        const requests = this.getConnectionRequests();
        const idx = requests.findIndex(r => r.id === requestId);
        if (idx === -1) return;
        requests[idx].status = 'rejected';
        requests[idx].respondedAt = new Date().toISOString();
        localStorage.setItem('connection_requests', JSON.stringify(requests));
    },

    // Lista bruta de conexões
    getConnectionsRaw() {
        const c = localStorage.getItem('connections');
        return c ? JSON.parse(c) : [];
    },

    // Conexões de um usuário (objetos de conexão)
    getConnections(userId) {
        return this.getConnectionsRaw().filter(c => c.users.includes(userId));
    },

    // Retorna perfis dos usuários conectados
    getConnectedUsers(userId) {
        const connections = this.getConnections(userId);
        const allUsers = this.getUsers();
        return connections.map(conn => {
            const otherId = conn.users.find(id => id !== userId);
            const user = allUsers.find(u => u.id === otherId);
            return user ? { ...user, connectionId: conn.id, connectedAt: conn.connectedAt } : null;
        }).filter(Boolean);
    },

    // Remove conexão entre dois usuários
    removeConnection(userId, targetUserId) {
        const connections = this.getConnectionsRaw().filter(
            c => !(c.users.includes(userId) && c.users.includes(targetUserId))
        );
        localStorage.setItem('connections', JSON.stringify(connections));
        // Marca os pedidos entre eles como rejeitados
        const requests = this.getConnectionRequests().map(r => {
            if ((r.fromUserId === userId && r.toUserId === targetUserId) ||
                (r.fromUserId === targetUserId && r.toUserId === userId)) {
                return { ...r, status: 'removed' };
            }
            return r;
        });
        localStorage.setItem('connection_requests', JSON.stringify(requests));
    },

    // ==================== SOLICITAÇÕES DE COMPRA ====================

    _getPurchaseRequests() {
        const r = localStorage.getItem(this.PURCHASE_REQUESTS_KEY);
        return r ? JSON.parse(r) : [];
    },

    _savePurchaseRequests(reqs) {
        localStorage.setItem(this.PURCHASE_REQUESTS_KEY, JSON.stringify(reqs));
    },

    // Envia uma nova solicitação de compra para um usuário conectado
    sendPurchaseRequest({ toUserId, purchase, amount, reason, paymentMethod, category }) {
        const session = this.getSession();
        if (!session) throw new Error('Você precisa estar logado.');

        // Verifica se estão conectados
        const connected = this.getConnectedUsers(session.userId);
        if (!connected.find(u => u.id === toUserId)) {
            throw new Error('Você não está conectado com este usuário.');
        }

        const targetUser = this.getUsers().find(u => u.id === toUserId);
        if (!targetUser) throw new Error('Usuário não encontrado.');

        const req = {
            id: Date.now().toString(),
            fromUserId: session.userId,
            fromUserName: session.name,
            toUserId,
            toUserName: targetUser.name,
            // Questionário
            purchase: purchase.trim(),
            amount: parseFloat(amount),
            reason: reason.trim(),
            paymentMethod,
            category: category || 'Pessoal',
            // Ciclo de vida: pending → approved|rejected → replied → final_approved|final_rejected
            status: 'pending',
            rejectionReason: null,
            replyJustification: null,
            finalRejectionReason: null,
            // Timestamps
            createdAt: new Date().toISOString(),
            reviewedAt: null,
            repliedAt: null,
            finalReviewedAt: null,
            // Gasto criado ao aprovar
            expenseId: null,
            // Controle de leitura (para badge do solicitante)
            seenByRequester: false
        };

        const reqs = this._getPurchaseRequests();
        reqs.push(req);
        this._savePurchaseRequests(reqs);
        return req;
    },

    // Aprova a solicitação e cria o gasto automaticamente
    approvePurchaseRequest(requestId) {
        const reqs = this._getPurchaseRequests();
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx === -1) throw new Error('Solicitação não encontrada.');

        const req = reqs[idx];
        const isFinalReview = req.status === 'replied';

        reqs[idx].status = isFinalReview ? 'final_approved' : 'approved';
        reqs[idx].reviewedAt = new Date().toISOString();
        reqs[idx].seenByRequester = false;

        // Cria o gasto atribuído ao SOLICITANTE (fromUserId), não ao aprovador
        const expense = this.addExpense({
            description: req.purchase,
            amount: req.amount,
            category: req.category,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: req.paymentMethod,
            source: 'purchase_request',
            requestId: req.id,
            userId: req.fromUserId   // ← atribuído ao solicitante
        });

        reqs[idx].expenseId = expense.id;
        this._savePurchaseRequests(reqs);
        return expense;
    },

    // Reprova na primeira análise (exige motivo)
    rejectPurchaseRequest(requestId, reason) {
        const reqs = this._getPurchaseRequests();
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx === -1) throw new Error('Solicitação não encontrada.');

        reqs[idx].status = 'rejected';
        reqs[idx].rejectionReason = reason.trim();
        reqs[idx].reviewedAt = new Date().toISOString();
        reqs[idx].seenByRequester = false;
        this._savePurchaseRequests(reqs);
    },

    // Solicitante envia réplica após reprovação
    replyToPurchaseRequest(requestId, justification) {
        const reqs = this._getPurchaseRequests();
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx === -1) throw new Error('Solicitação não encontrada.');
        if (reqs[idx].status !== 'rejected') throw new Error('Réplica não disponível para esta solicitação.');

        reqs[idx].status = 'replied';
        reqs[idx].replyJustification = justification.trim();
        reqs[idx].repliedAt = new Date().toISOString();
        this._savePurchaseRequests(reqs);
    },

    // Reprovação final (após réplica) — sem mais recursos
    finalRejectPurchaseRequest(requestId, reason) {
        const reqs = this._getPurchaseRequests();
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx === -1) throw new Error('Solicitação não encontrada.');

        reqs[idx].status = 'final_rejected';
        reqs[idx].finalRejectionReason = reason.trim();
        reqs[idx].finalReviewedAt = new Date().toISOString();
        reqs[idx].seenByRequester = false;
        this._savePurchaseRequests(reqs);
    },

    // Marca solicitação como vista pelo solicitante (limpa badge)
    markPurchaseRequestSeen(requestId) {
        const reqs = this._getPurchaseRequests();
        const idx = reqs.findIndex(r => r.id === requestId);
        if (idx !== -1) {
            reqs[idx].seenByRequester = true;
            this._savePurchaseRequests(reqs);
        }
    },

    // Contagem de itens que exigem ação do usuário atual (para badge)
    getPurchaseRequestsBadgeCount(userId) {
        const reqs = this._getPurchaseRequests();
        // Como revisor: aguardando minha análise
        const toReview = reqs.filter(r =>
            r.toUserId === userId &&
            (r.status === 'pending' || r.status === 'replied')
        ).length;
        // Como solicitante: resultado não visto ainda
        const toSee = reqs.filter(r =>
            r.fromUserId === userId &&
            !r.seenByRequester &&
            ['approved', 'rejected', 'final_approved', 'final_rejected'].includes(r.status)
        ).length;
        return toReview + toSee;
    },

    // Invalida o cache quando a config é atualizada
    invalidateCache() {
        this._cachedConfig = null;
    },

    // ==================== NOTIFICAÇÕES ====================

    // Retorna lista de notificações para o usuário (baseadas em PurchaseRequests)
    getNotifications(userId) {
        const reqs = this._getPurchaseRequests();
        const users = this.getUsers();
        const userName = id => { const u = users.find(u => u.id === id); return u ? u.name : 'Usuário'; };
        const fmt = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

        const notifications = [];

        reqs.forEach(r => {
            // --- NOTIFICAÇÕES PARA O REVISOR (toUserId) ---
            if (r.toUserId === userId) {
                // Nova solicitação recebida
                if (r.status === 'pending') {
                    notifications.push({
                        id: `${r.id}_pending`,
                        requestId: r.id,
                        type: 'pending',
                        icon: '🛒',
                        title: `Solicitação de ${userName(r.fromUserId)}`,
                        body: `${r.purchase} — ${this.formatCurrency(r.amount)}`,
                        time: fmt(r.createdAt),
                        ts: r.createdAt,
                        read: false,
                    });
                }
                // Réplica recebida após rejeição
                if (r.status === 'replied') {
                    notifications.push({
                        id: `${r.id}_replied`,
                        requestId: r.id,
                        type: 'replied',
                        icon: '↩️',
                        title: `Réplica de ${userName(r.fromUserId)}`,
                        body: r.replyJustification ? `"${r.replyJustification.slice(0, 60)}${r.replyJustification.length > 60 ? '…' : ''}"` : r.purchase,
                        time: fmt(r.repliedAt),
                        ts: r.repliedAt,
                        read: false,
                    });
                }
            }

            // --- NOTIFICAÇÕES PARA O SOLICITANTE (fromUserId) ---
            if (r.fromUserId === userId) {
                const isRead = r.seenByRequester;
                if (r.status === 'approved' || r.status === 'final_approved') {
                    notifications.push({
                        id: `${r.id}_approved`,
                        requestId: r.id,
                        type: r.status,
                        icon: '✅',
                        title: 'Solicitação aprovada!',
                        body: `${r.purchase} — ${this.formatCurrency(r.amount)} foi aprovado por ${userName(r.toUserId)}.`,
                        time: fmt(r.reviewedAt),
                        ts: r.reviewedAt,
                        read: isRead,
                    });
                }
                if (r.status === 'rejected') {
                    notifications.push({
                        id: `${r.id}_rejected`,
                        requestId: r.id,
                        type: 'rejected',
                        icon: '❌',
                        title: 'Solicitação reprovada',
                        body: r.rejectionReason ? `Motivo: "${r.rejectionReason.slice(0, 60)}${r.rejectionReason.length > 60 ? '…' : ''}"` : `${r.purchase} foi reprovado.`,
                        time: fmt(r.reviewedAt),
                        ts: r.reviewedAt,
                        read: isRead,
                    });
                }
                if (r.status === 'final_rejected') {
                    notifications.push({
                        id: `${r.id}_final_rejected`,
                        requestId: r.id,
                        type: 'final_rejected',
                        icon: '🚫',
                        title: 'Reprovação definitiva',
                        body: r.finalRejectionReason ? `"${r.finalRejectionReason.slice(0, 60)}${r.finalRejectionReason.length > 60 ? '…' : ''}"` : `${r.purchase} foi definitivamente reprovado.`,
                        time: fmt(r.finalReviewedAt || r.reviewedAt),
                        ts: r.finalReviewedAt || r.reviewedAt,
                        read: isRead,
                    });
                }
            }
        });

        // Ordena: não lidas primeiro, depois mais recentes
        notifications.sort((a, b) => {
            if (a.read !== b.read) return a.read ? 1 : -1;
            return new Date(b.ts || 0) - new Date(a.ts || 0);
        });

        return notifications;
    },

    // Conta notificações não lidas do usuário
    getUnreadNotifCount(userId) {
        return this.getNotifications(userId).filter(n => !n.read).length;
    }
};

// Inicializa ao carregar
Storage.init();
