// Elementos do DOM
const sidebar = document.getElementById('sidebar');
const toggleBtns = document.querySelectorAll('.toggle-btn');
const navItems = document.querySelectorAll('.nav-item.sidebar-item');
const pageTitle = document.querySelector('.page-title');
const pages = document.querySelectorAll('.page');
const body = document.body;

// Formulário de gastos
const expenseForm = document.getElementById('expenseForm');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const dateInput = document.getElementById('date');
const expensesList = document.getElementById('expensesList');

// Gráfico
let chart = null;
let barChart = null;

// Estado do dashboard
let dashboardState = {
    currentPeriod: 'month',
    allExpenses: [],
    filteredExpenses: []
};

// Animação de carregamento
function addLoadingState(element) {
    element.style.opacity = '0.6';
    element.style.pointerEvents = 'none';
}

function removeLoadingState(element) {
    element.style.opacity = '1';
    element.style.pointerEvents = 'auto';
}

// ==================== SIDEBAR ====================
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('show');
        if (sidebar.classList.contains('show')) {
            playHaptic();
        }
    } else {
        sidebar.classList.toggle('collapsed');
        playHaptic();
    }
}

toggleBtns.forEach(btn => {
    btn.addEventListener('click', toggleSidebar);
});

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        !e.target.classList.contains('toggle-btn')) {
        sidebar.classList.remove('show');
    }
});

window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('show');
    }
});

// Feedback tátil (vibração)
function playHaptic() {
    if (navigator.vibrate) {
        navigator.vibrate(15);
    }
}

// ==================== NAVEGAÇÃO ====================
function showPage(pageName) {
    console.log('📄 Mudando para página:', pageName);
    // Esconde todas as páginas com animação
    pages.forEach(page => {
        page.classList.remove('active');
    });

    // Mostra a página selecionada
    const selectedPage = document.getElementById(`page-${pageName}`);
    if (selectedPage) {
        selectedPage.classList.add('active');
    }

    // Atualiza nav items
    navItems.forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`[data-page="${pageName}"]`);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    // Atualiza título
    const titles = {
        registrar: 'Registrar Gastos',
        entradas: 'Entradas / Receitas',
        dashboard: 'Dashboard',
        config: 'Configurações',
        perfil: 'Meu Perfil',
        conexoes: 'Conexões'
    };
    pageTitle.textContent = titles[pageName] || 'Manager Finance';

    // Fecha sidebar em mobile
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('show');
    }

    // Atualiza dados se necessário
    if (pageName === 'dashboard') {
        setTimeout(() => updateDashboard(), 100);
    }
    if (pageName === 'conexoes') {
        loadConexoes();
    }
    if (pageName === 'perfil') {
        loadProfile();
    }
    if (pageName === 'entradas') {
        renderIncomesList();
    }
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const pageName = item.getAttribute('data-page');
        showPage(pageName);
        playHaptic();
    });
});

// ==================== FORMULÁRIO DE GASTOS ====================
function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
}

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const subcatEl = document.getElementById('subcategory');
    const subcatVal = subcatEl ? subcatEl.value : '';

    const expense = {
        description: descriptionInput.value,
        amount: parseFloat(amountInput.value),
        category: categoryInput.value,
        subcategory: subcatVal || categoryInput.value,
        date: dateInput.value
    };

    Storage.addExpense(expense);

    // Limpa o formulário
    expenseForm.reset();
    setDefaultDate();
    // Reset subcategory dropdown
    const subGroup = document.getElementById('subcategoryGroup');
    if (subGroup) subGroup.style.display = 'none';
    if (subcatEl) subcatEl.innerHTML = '<option value="">Selecione...</option>';

    // Atualiza a lista
    renderExpensesList();

    // Atualiza o gráfico se está visível
    if (document.getElementById('page-dashboard').classList.contains('active')) {
        updateDashboard();
    }

    // Mostra feedback
    showNotification('Gasto adicionado com sucesso!', 'success');
});

// Subcategorias por categoria principal
const SUBCATEGORIES = {
    Lazer: [
        'Restaurante', 'iFood / Delivery', 'Cinema / Teatro', 'Academia',
        'Bar / Balada', 'Viagem', 'Jogos / Streaming', 'Comprar Roupas',
        'Sair com amigos', 'Passeio', 'Outros Lazer'
    ],
    Fixo: [
        'Aluguel', 'Conta de Luz', 'Conta de Água', 'Internet',
        'Gás', 'Condomínio', 'Plano de Saúde', 'Escola / Faculdade',
        'Feira do Mês', 'Transporte / Combustível', 'Outros Fixo'
    ],
    Outros: [
        'Shopee', 'Mercado Livre', 'Amazon', 'AliExpress',
        'Farmácia', 'Presente / Presente', 'Manutenção / Reparo',
        'Veterinário', 'Médico / Dentista', 'Outros Avulso'
    ]
};

function updateSubcategories() {
    const catEl = document.getElementById('category');
    const subEl = document.getElementById('subcategory');
    const subGrp = document.getElementById('subcategoryGroup');
    if (!catEl || !subEl || !subGrp) return;

    const cat = catEl.value;
    const subs = SUBCATEGORIES[cat] || [];

    if (subs.length === 0) {
        subGrp.style.display = 'none';
        subEl.innerHTML = '<option value="">Selecione...</option>';
        return;
    }

    subEl.innerHTML = '<option value="">Selecione...</option>' +
        subs.map(s => `<option value="${s}">${s}</option>`).join('');
    subGrp.style.display = 'block';
}

// ==================== ENTRADAS / RECEITAS ====================

const incomeForm = document.getElementById('incomeForm');
const incomeDescEl = document.getElementById('incomeDescription');
const incomeAmtEl = document.getElementById('incomeAmount');
const incomeCatEl = document.getElementById('incomeCategory');
const incomeDateEl = document.getElementById('incomeDate');
const incomesListEl = document.getElementById('incomesList');

// Preenche a data de hoje no campo de data de entrada
(function setDefaultIncomeDate() {
    if (incomeDateEl) {
        const today = new Date().toISOString().split('T')[0];
        incomeDateEl.value = today;
    }
})();

if (incomeForm) {
    incomeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const description = incomeDescEl ? incomeDescEl.value.trim() : '';
        const amount = incomeAmtEl ? parseFloat(incomeAmtEl.value) : 0;
        const category = incomeCatEl ? incomeCatEl.value : 'Outros';
        const date = incomeDateEl ? incomeDateEl.value : '';

        if (!description) { showNotification('Informe a descrição.', 'danger'); return; }
        if (!amount || amount <= 0) { showNotification('Informe um valor válido.', 'danger'); return; }
        if (!date) { showNotification('Selecione a data.', 'danger'); return; }

        Storage.addIncome({ description, amount, category, date });

        // Limpa formulário
        if (incomeDescEl) incomeDescEl.value = '';
        if (incomeAmtEl) incomeAmtEl.value = '';
        if (incomeCatEl) incomeCatEl.value = 'Salário';
        const today = new Date().toISOString().split('T')[0];
        if (incomeDateEl) incomeDateEl.value = today;

        renderIncomesList();
        // Atualiza dashboard se estiver visível
        if (document.getElementById('page-dashboard') &&
            document.getElementById('page-dashboard').classList.contains('active')) {
            updateDashboard();
        }
        showNotification('Entrada registrada com sucesso!', 'success');
        playHaptic();
    });
}

function renderIncomesList() {
    if (!incomesListEl) return;
    const incomes = Storage.getIncomes();
    if (incomes.length === 0) {
        incomesListEl.innerHTML = '<p class="empty-state">Nenhuma entrada registrada</p>';
        return;
    }
    const sorted = [...incomes].sort((a, b) => new Date(b.date) - new Date(a.date));
    incomesListEl.innerHTML = sorted.map(income => {
        const formatted = Storage.formatCurrency(income.amount);
        const date = new Date(income.date + 'T12:00:00').toLocaleDateString('pt-BR');
        return `
        <div class="expense-item income-item">
            <div class="expense-info">
                <span class="expense-description">${escHtml(income.description)}</span>
                <span class="expense-category">${escHtml(income.category || 'Outros')}</span>
                <span class="expense-date">${date}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <span class="expense-amount">+${formatted}</span>
                <button class="delete-btn" onclick="deleteIncome(${income.id})" title="Remover">×</button>
            </div>
        </div>`;
    }).join('');
}

function deleteIncome(id) {
    if (confirm('Remover esta entrada?')) {
        Storage.removeIncome(id);
        renderIncomesList();
        if (document.getElementById('page-dashboard').classList.contains('active')) {
            updateDashboard();
        }
        showNotification('Entrada removida.', 'danger');
    }
}

function renderExpensesList() {
    const expenses = Storage.getExpenses();
    expensesList.innerHTML = '';

    if (expenses.length === 0) {
        expensesList.innerHTML = '<p class="empty-state">Nenhum gasto registrado</p>';
        return;
    }

    // Ordena por data (mais recente primeiro)
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(expense => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        const catLabel = expense.subcategory && expense.subcategory !== expense.category
            ? `${expense.category} › ${expense.subcategory}`
            : expense.category;
        item.innerHTML = `
            <div class="expense-info">
                <h4>${expense.description}</h4>
                <p class="expense-category">${catLabel}</p>
                <p class="expense-date">${new Date(expense.date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div class="expense-amount">${Storage.formatCurrency(expense.amount)}</div>
            <button class="btn-delete" onclick="deleteExpense(${expense.id})">✕</button>
        `;
        expensesList.appendChild(item);
    });
}

function deleteExpense(id) {
    if (confirm('Remover este gasto?')) {
        Storage.removeExpense(id);
        renderExpensesList();
        if (document.getElementById('page-dashboard').classList.contains('active')) {
            updateDashboard();
        }
        showNotification('Gasto removido!', 'danger');
    }
}

// ==================== DASHBOARD ====================

// Filtra despesas por período
function getExpensesByPeriod(period) {
    const expenses = Storage.getExpenses();
    const now = new Date();

    let filteredExpenses = [];

    switch (period) {
        case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            filteredExpenses = expenses.filter(e => new Date(e.date) >= weekAgo);
            break;
        case 'month':
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            filteredExpenses = expenses.filter(e => new Date(e.date) >= monthAgo);
            break;
        case 'year':
            const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            filteredExpenses = expenses.filter(e => new Date(e.date) >= yearAgo);
            break;
        default: // 'all'
            filteredExpenses = expenses;
    }

    return filteredExpenses;
}

// Calcula estatísticas por categoria (Fixo, Lazer, Outros)
function calculateCategoryStats(expenses) {
    const stats = { Fixo: 0, Lazer: 0, Outros: 0 };
    expenses.forEach(e => {
        const cat = e.category;
        // Mapeia categorias antigas para as novas (retrocompatível)
        if (cat === 'Fixo' || cat === 'Essencial') stats.Fixo += parseFloat(e.amount);
        else if (cat === 'Lazer' || cat === 'Pessoal') stats.Lazer += parseFloat(e.amount);
        else stats.Outros += parseFloat(e.amount);
    });
    return stats;
}

// Agrupa gastos por dia
function groupByDay(expenses) {
    const grouped = {};

    expenses.forEach(expense => {
        const date = expense.date;
        if (!grouped[date]) {
            grouped[date] = 0;
        }
        grouped[date] += parseFloat(expense.amount);
    });

    return grouped;
}

// Retorna o período anterior equivalente para comparação de tendências
function getPreviousPeriodExpenses(period) {
    const expenses = Storage.getExpenses();
    const now = new Date();

    switch (period) {
        case 'week': {
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return expenses.filter(e => new Date(e.date) >= twoWeeksAgo && new Date(e.date) < oneWeekAgo);
        }
        case 'month': {
            const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
            const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            return expenses.filter(e => new Date(e.date) >= twoMonthsAgo && new Date(e.date) < oneMonthAgo);
        }
        case 'year': {
            const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            return expenses.filter(e => new Date(e.date) >= twoYearsAgo && new Date(e.date) < oneYearAgo);
        }
        default:
            return [];
    }
}

// Formata tendência em texto
function formatTrend(current, previous) {
    if (previous === 0) return current > 0 ? '↗ Novo' : '—';
    const diff = ((current - previous) / previous) * 100;
    const sign = diff >= 0 ? '+' : '';
    const arrow = diff >= 0 ? '↗' : '↘';
    return `${arrow} ${sign}${Math.round(diff)}%`;
}

function updateDashboard() {
    const period = dashboardState.currentPeriod;
    const filteredExpenses = getExpensesByPeriod(period);
    const prevExpenses = getPreviousPeriodExpenses(period);
    const stats = calculateCategoryStats(filteredExpenses);
    const prevStats = calculateCategoryStats(prevExpenses);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    const prevTotal = Object.values(prevStats).reduce((a, b) => a + b, 0);

    // Calcula percentuais
    const percentages = total > 0 ? {
        Fixo: (stats.Fixo / total) * 100,
        Lazer: (stats.Lazer / total) * 100,
        Outros: (stats.Outros / total) * 100
    } : { Fixo: 0, Lazer: 0, Outros: 0 };

    // Atualiza cards de estatísticas
    document.getElementById('totalExpense').textContent = Storage.formatCurrency(total);
    document.getElementById('essentialAmount').textContent = Storage.formatCurrency(stats.Fixo);
    document.getElementById('personalAmount').textContent = Storage.formatCurrency(stats.Lazer);
    document.getElementById('othersAmount').textContent = Storage.formatCurrency(stats.Outros);

    // Atualiza tendências reais
    if (period !== 'all') {
        document.getElementById('totalTrend').textContent = formatTrend(total, prevTotal);
        document.getElementById('essentialTrend').textContent = formatTrend(stats.Fixo, prevStats.Fixo);
        document.getElementById('personalTrend').textContent = formatTrend(stats.Lazer, prevStats.Lazer);
        document.getElementById('othersTrend').textContent = formatTrend(stats.Outros, prevStats.Outros);
    } else {
        ['totalTrend', 'essentialTrend', 'personalTrend', 'othersTrend'].forEach(id => {
            document.getElementById(id).textContent = '—';
        });
    }

    // Atualiza comparativos de percentual
    const essPercent = total > 0 ? Math.round((stats.Fixo / total) * 100) : 0;
    const pesPercent = total > 0 ? Math.round((stats.Lazer / total) * 100) : 0;
    const outPercent = total > 0 ? Math.round((stats.Outros / total) * 100) : 0;

    document.getElementById('essentialComparison').textContent = `${essPercent}% do total`;
    document.getElementById('personalComparison').textContent = `${pesPercent}% do total`;
    document.getElementById('othersComparison').textContent = `${outPercent}% do total`;

    // Atualiza receitas e saldo do período
    const filteredIncomes = Storage.getIncomesByPeriod(dashboardState.currentPeriod);
    const totalIncome = filteredIncomes.reduce((s, i) => s + parseFloat(i.amount), 0);
    const balance = totalIncome - total;

    const incomeEl = document.getElementById('totalIncomeDisplay');
    const balanceEl = document.getElementById('balanceDisplay');
    const incomeCompEl = document.getElementById('incomeComparison');
    const balanceCompEl = document.getElementById('balanceComparison');

    if (incomeEl) incomeEl.textContent = Storage.formatCurrency(totalIncome);
    if (incomeCompEl) incomeCompEl.textContent = `${filteredIncomes.length} entrada${filteredIncomes.length !== 1 ? 's' : ''}`;
    if (balanceEl) {
        balanceEl.textContent = Storage.formatCurrency(Math.abs(balance));
        balanceEl.className = 'stat-value ' + (balance >= 0 ? 'positive' : 'negative');
    }
    if (balanceCompEl) {
        balanceCompEl.textContent = balance >= 0
            ? `✅ Superávit de ${Storage.formatCurrency(balance)}`
            : `⚠️ Déficit de ${Storage.formatCurrency(Math.abs(balance))}`;
    }

    // Atualiza insights
    updateInsights(filteredExpenses);

    // Mostra/esconde mensagem vazia e gráficos
    const emptyChart = document.getElementById('emptyChart');
    const emptyBarChart = document.getElementById('emptyBarChart');
    const chartContainer = document.getElementById('chartContainer');
    const barChartContainer = document.getElementById('barChart').parentElement;

    if (filteredExpenses.length === 0) {
        if (emptyChart) emptyChart.style.display = 'block';
        if (chartContainer) chartContainer.style.display = 'none';
        if (emptyBarChart) emptyBarChart.style.display = 'block';
        if (barChartContainer) barChartContainer.style.display = 'none';
        return;
    } else {
        if (emptyChart) emptyChart.style.display = 'none';
        if (chartContainer) chartContainer.style.display = 'block';
        if (emptyBarChart) emptyBarChart.style.display = 'none';
        if (barChartContainer) barChartContainer.style.display = 'block';
    }

    // Atualiza gráficos
    setTimeout(() => {
        updateChart(percentages);
        updateBarChart(groupByDay(filteredExpenses));
    }, 100);
}

// Atualiza insights
function updateInsights(expenses) {
    if (expenses.length === 0) {
        document.getElementById('largestExpense').textContent = '-';
        document.getElementById('topCategory').textContent = '-';
        document.getElementById('averageExpense').textContent = '-';
        document.getElementById('totalTransactions').textContent = '0';
        return;
    }

    // Maior gasto
    const largest = Math.max(...expenses.map(e => e.amount));
    document.getElementById('largestExpense').textContent = Storage.formatCurrency(largest);

    // Categoria top
    const stats = calculateCategoryStats(expenses);
    const topCat = Object.entries(stats).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    document.getElementById('topCategory').textContent = topCat;

    // Ticket médio
    const average = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0) / expenses.length;
    document.getElementById('averageExpense').textContent = Storage.formatCurrency(average);

    // Total de transações
    document.getElementById('totalTransactions').textContent = expenses.length;
}

function updateChart(percentages) {
    const ctx = document.getElementById('donut');

    // Verifica se o canvas existe e se está visível
    if (!ctx) {
        console.warn('Canvas donut não encontrado');
        return;
    }

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Fixo', 'Lazer', 'Outros'],
            datasets: [{
                data: [
                    percentages.Fixo || 0,
                    percentages.Lazer || 0,
                    percentages.Outros || 0
                ],
                backgroundColor: ["#6366f1", "#f59e0b", "#22d3ee"],
                borderWidth: 2,
                borderColor: getComputedStyle(document.body).backgroundColor,
                hoverOffset: 12,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.3,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(45, 52, 54, 0.9)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    borderColor: '#0081A7',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const value = Math.round(context.parsed);
                            return value + '%';
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const i = elements[0].index;
                    const label = chart.data.labels[i];
                    const percentage = Math.round(chart.data.datasets[0].data[i]);
                    showNotification(`${label}: ${percentage}%`, 'info');
                    playHaptic();
                }
            }
        }
    });
}

// Gráfico de barras (gastos por dia)
function updateBarChart(dailyData) {
    const ctx = document.getElementById('barChart');

    if (!ctx) {
        console.warn('Canvas barChart não encontrado');
        return;
    }

    if (barChart) {
        barChart.destroy();
    }

    // Ordena os dias
    const sortedDates = Object.keys(dailyData).sort();
    const labels = sortedDates.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
    });
    const data = sortedDates.map(date => dailyData[date]);

    // Paleta de cores dinâmica — funciona para qualquer quantidade de barras
    const palette = [
        [244, 124, 114],
        [54, 212, 203],
        [0, 122, 155],
        [255, 193, 7],
        [156, 39, 176],
        [76, 175, 80],
        [255, 87, 34],
        [33, 150, 243],
        [233, 30, 99],
        [0, 188, 212]
    ];
    const bgColors = data.map((_, i) => {
        const [r, g, b] = palette[i % palette.length];
        return `rgba(${r}, ${g}, ${b}, 0.7)`;
    });
    const borderColors = data.map((_, i) => {
        const [r, g, b] = palette[i % palette.length];
        return `rgba(${r}, ${g}, ${b}, 1)`;
    });
    const hoverColors = data.map((_, i) => {
        const [r, g, b] = palette[i % palette.length];
        return `rgba(${r}, ${g}, ${b}, 0.9)`;
    });

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos por Dia',
                data: data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 8,
                hoverBackgroundColor: hoverColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'x',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(45, 52, 54, 0.9)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    borderColor: '#0081A7',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            return Storage.formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return Storage.formatCurrency(value);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ==================== FILTROS DO DASHBOARD ====================
const periodBtns = document.querySelectorAll('.period-btn');
periodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        periodBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        dashboardState.currentPeriod = e.target.getAttribute('data-period');
        updateDashboard();
    });
});

// Botão de exportar
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        const expenses = getExpensesByPeriod(dashboardState.currentPeriod);
        const csv = convertToCSV(expenses);
        downloadCSV(csv, 'despesas.csv');
        showNotification('Dados exportados com sucesso!', 'success');
    });
}

function convertToCSV(expenses) {
    const headers = ['Descrição', 'Valor', 'Categoria', 'Data'];
    const rows = expenses.map(e => [
        e.description,
        e.amount,
        e.category,
        new Date(e.date).toLocaleDateString('pt-BR')
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==================== CONFIGURAÇÕES ====================
const currencySelect = document.getElementById('currencySelect');
const themeButtons = document.querySelectorAll('.theme-btn');
const clearDataBtn = document.getElementById('clearData');

function loadConfig() {
    const config = Storage.getConfig();
    currencySelect.value = config.currency;

    themeButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-theme="${config.theme}"]`).classList.add('active');
}

currencySelect.addEventListener('change', (e) => {
    Storage.updateConfig({ currency: e.target.value });
    Storage.invalidateCache();
    renderExpensesList();
    updateDashboard();
    showNotification('Moeda atualizada!', 'success');
});

themeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const theme = e.target.getAttribute('data-theme');
        Storage.updateConfig({ theme });

        themeButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        document.body.setAttribute('data-theme', theme);
        showNotification(`Tema ${theme === 'dark' ? 'escuro' : 'claro'} ativado!`, 'success');
    });
});

clearDataBtn.addEventListener('click', () => {
    if (confirm('⚠️ Tem certeza? Isto deletará TODOS os gastos!')) {
        Storage.clearExpenses();
        renderExpensesList();
        showNotification('Todos os dados foram removidos!', 'danger');
        if (chart) updateChart({ Essencial: 0, Pessoal: 0, Outros: 0 });
    }
});

// ==================== PERFIL ====================

let perfilAvatarDataUrl = null;

// Elementos do DOM
const perfilAvatarPreview = document.getElementById('perfilAvatarPreview');
const perfilAvatarInput = document.getElementById('perfilAvatarInput');
const perfilNomeInput = document.getElementById('perfilNome');
const perfilEmailInput = document.getElementById('perfilEmail');
const perfilMetaInput = document.getElementById('perfilMeta');
const perfilSaveBtn = document.getElementById('perfilSaveBtn');
const perfilClearBtn = document.getElementById('perfilClearDataBtn');
const sidebarAvatar = document.getElementById('sidebarAvatar');
const sidebarUsername = document.getElementById('sidebarUsername');
const sidebarAvatarBtn = document.getElementById('sidebarAvatarBtn');

// Navega para o perfil ao clicar no avatar da sidebar
if (sidebarAvatarBtn) {
    sidebarAvatarBtn.addEventListener('click', () => {
        showPage('perfil');
        playHaptic();
    });
}

function syncSidebarProfile(profile) {
    // Avatar
    const avatarSrc = profile.avatarDataUrl || './avatar.png';
    if (sidebarAvatar) sidebarAvatar.src = avatarSrc;
    if (perfilAvatarPreview) perfilAvatarPreview.src = avatarSrc;

    // Nome e e-mail na prévia do card
    const nameEl = document.getElementById('perfilAvatarName');
    const emailEl = document.getElementById('perfilAvatarEmail');
    const displayName = profile.name || 'Usuário';
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = profile.email || '—';
    if (sidebarUsername) sidebarUsername.textContent = displayName;
}

function loadProfile() {
    const profile = Storage.getProfile();
    perfilAvatarDataUrl = profile.avatarDataUrl || null;

    if (perfilNomeInput) perfilNomeInput.value = profile.name || '';
    if (perfilEmailInput) perfilEmailInput.value = profile.email || '';
    if (perfilMetaInput) perfilMetaInput.value = profile.monthlyBudget > 0 ? profile.monthlyBudget : '';

    syncSidebarProfile(profile);
    updateBudgetBar(profile.monthlyBudget);
}

function updateBudgetBar(budget) {
    const wrapper = document.getElementById('perfilMetaBarWrapper');
    const fillEl = document.getElementById('perfilMetaBarFill');
    const percentEl = document.getElementById('perfilMetaBarPercent');
    const valuesEl = document.getElementById('perfilMetaBarValues');

    if (!wrapper) return;
    if (!budget || budget <= 0) {
        wrapper.style.display = 'none';
        return;
    }

    // Calcula gasto do mês atual
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const expenses = Storage.getExpenses();
    const spentThisMonth = expenses
        .filter(e => new Date(e.date) >= firstOfMonth)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const pct = Math.min((spentThisMonth / budget) * 100, 100);
    const overBudget = spentThisMonth > budget;

    wrapper.style.display = 'block';
    fillEl.style.width = pct + '%';
    fillEl.className = 'perfil-meta-bar-fill' + (overBudget ? ' danger' : pct >= 80 ? ' warning' : '');
    percentEl.textContent = Math.round(pct) + '%';
    valuesEl.textContent = `${Storage.formatCurrency(spentThisMonth)} de ${Storage.formatCurrency(budget)}`;
}

// Upload de avatar
if (perfilAvatarInput) {
    perfilAvatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showNotification('Arquivo inválido. Use uma imagem.', 'danger');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            perfilAvatarDataUrl = ev.target.result;
            if (perfilAvatarPreview) perfilAvatarPreview.src = perfilAvatarDataUrl;
        };
        reader.readAsDataURL(file);
    });
}

// Salvar perfil
if (perfilSaveBtn) {
    perfilSaveBtn.addEventListener('click', () => {
        const name = perfilNomeInput ? perfilNomeInput.value.trim() : '';
        const email = perfilEmailInput ? perfilEmailInput.value.trim() : '';
        const budget = perfilMetaInput ? parseFloat(perfilMetaInput.value) || 0 : 0;

        // Valida e-mail se preenchido
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            showNotification('E-mail inválido.', 'danger');
            return;
        }

        const profileData = {
            name,
            email,
            monthlyBudget: budget,
            avatarDataUrl: perfilAvatarDataUrl
        };

        Storage.saveProfile(profileData);
        syncSidebarProfile(profileData);
        updateBudgetBar(budget);
        showNotification('Perfil salvo com sucesso!', 'success');
        playHaptic();
    });
}

// Limpar dados (botão da página de perfil)
if (perfilClearBtn) {
    perfilClearBtn.addEventListener('click', () => {
        if (confirm('⚠️ Tem certeza? Isto deletará TODOS os gastos!')) {
            Storage.clearExpenses();
            renderExpensesList();
            updateBudgetBar(Storage.getProfile().monthlyBudget);
            showNotification('Todos os dados foram removidos!', 'danger');
            if (chart) updateChart({ Fixo: 0, Lazer: 0, Outros: 0 });
        }
    });
}

// Logout
const perfilLogoutBtn = document.getElementById('perfilLogoutBtn');
if (perfilLogoutBtn) {
    perfilLogoutBtn.addEventListener('click', () => {
        if (confirm('Deseja sair da sua conta?')) {
            Storage.logoutUser();
            window.location.replace('auth.html');
        }
    });
}

// ==================== CONEXÕES ====================

function updateConexoesBadge() {
    const session = Storage.getSession();
    if (!session) return;
    const connPending = Storage.getPendingRequests(session.userId).length;
    const prCount = Storage.getPurchaseRequestsBadgeCount(session.userId);
    const total = connPending + prCount;
    const badge = document.getElementById('conexoesBadge');
    if (!badge) return;
    if (total > 0) {
        badge.textContent = total;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// ==================== PAINEL DE NOTIFICAÇÕES ====================

function updateNotifBadge() {
    const session = Storage.getSession();
    if (!session) return;
    const count = Storage.getUnreadNotifCount(session.userId);
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    const overlay = document.getElementById('notifOverlay');
    const isOpen = panel && panel.classList.contains('open');
    if (isOpen) {
        closeNotifPanel();
    } else {
        if (!panel || !overlay) return;
        renderNotifications();
        panel.classList.add('open');
        overlay.classList.add('open');
        lucide.createIcons();
    }
}

function closeNotifPanel() {
    const panel = document.getElementById('notifPanel');
    const overlay = document.getElementById('notifOverlay');
    if (panel) panel.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

function renderNotifications() {
    const session = Storage.getSession();
    const container = document.getElementById('notifList');
    if (!container || !session) return;

    const notifs = Storage.getNotifications(session.userId);

    if (notifs.length === 0) {
        container.innerHTML = '<div class="notif-empty">Nenhuma notificação ainda.</div>';
        return;
    }

    container.innerHTML = notifs.map(n => {
        const iconMap = {
            pending: '🛒',
            approved: '✅',
            final_approved: '✅',
            rejected: '❌',
            final_rejected: '🚫',
            replied: '↩️',
        };
        return `
        <div class="notif-item ${n.read ? '' : 'unread'}">
            <div class="notif-icon ${n.type}">${iconMap[n.type] || '🔔'}</div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-body">${n.body}</div>
                <div class="notif-meta">${n.time}</div>
            </div>
        </div>`;
    }).join('');
}

function markAllNotifRead() {
    const session = Storage.getSession();
    if (!session) return;
    const reqs = Storage._getPurchaseRequests();
    let changed = false;
    reqs.forEach(r => {
        if (r.fromUserId === session.userId && !r.seenByRequester) {
            r.seenByRequester = true;
            changed = true;
        }
    });
    if (changed) Storage._savePurchaseRequests(reqs);
    renderNotifications();
    updateNotifBadge();
    updateConexoesBadge();
}

// ==================== SOLICITAÇÕES DE COMPRA ====================

function loadPurchaseRequests() {
    const session = Storage.getSession();
    if (!session) return;
    renderReceivedPR(session);
    renderSentPR(session);
    updateConexoesBadge();
    updateNotifBadge();
}

/* Recebidas — cards para o revisor (pending / replied) */
function renderReceivedPR(session) {
    const container = document.getElementById('prReceivedList');
    const badge = document.getElementById('prReceivedBadge');
    if (!container) return;

    const all = Storage._getPurchaseRequests();
    const received = all.filter(r =>
        r.toUserId === session.userId &&
        (r.status === 'pending' || r.status === 'replied')
    );

    if (badge) {
        badge.textContent = received.length;
        badge.style.display = received.length > 0 ? 'inline-flex' : 'none';
    }

    if (!received.length) {
        container.innerHTML = '<div class="cx-empty">Nenhuma solicitação aguardando sua análise.</div>';
        return;
    }

    container.innerHTML = received.map(r => {
        const letter = r.fromUserName ? r.fromUserName[0].toUpperCase() : '?';
        const isReply = r.status === 'replied';
        const priceStr = Storage.formatCurrency(r.amount);
        return `
        <div class="pr-card pr-card-review">
            <div class="pr-card-top">
                <div class="cx-user-avatar" style="flex-shrink:0">${letter}</div>
                <div class="pr-card-info">
                    <div class="pr-card-title">${escHtml(r.purchase)}</div>
                    <div class="pr-card-meta">
                        <span class="pr-amount">${priceStr}</span>
                        <span class="pr-sep">·</span>
                        <span>${escHtml(r.paymentMethod)}</span>
                        <span class="pr-sep">·</span>
                        <span>${escHtml(r.category)}</span>
                    </div>
                    <div class="pr-card-from">De: <strong>${escHtml(r.fromUserName)}</strong> · ${timeAgo(r.createdAt)}</div>
                </div>
                ${isReply ? '<span class="pr-status-badge pr-badge-reply">Réplica</span>' : ''}
            </div>
            <div class="pr-detail-block">
                <div class="pr-detail-row"><span class="pr-detail-label">Motivo:</span> <span>${escHtml(r.reason)}</span></div>
                ${isReply && r.replyJustification ? `<div class="pr-detail-row pr-reply-row"><span class="pr-detail-label">Réplica:</span> <span>${escHtml(r.replyJustification)}</span></div>` : ''}
                ${r.rejectionReason ? `<div class="pr-detail-row pr-rejected-row"><span class="pr-detail-label">Sua reprovação:</span> <span>${escHtml(r.rejectionReason)}</span></div>` : ''}
            </div>
            <div class="pr-card-actions">
                <button class="btn btn-success cx-btn-sm" onclick="approvePR('${r.id}')">
                    <i data-lucide="check"></i> Aprovar
                </button>
                <button class="btn btn-danger cx-btn-sm" onclick="openRejectModal('${r.id}', '${isReply ? 'final' : 'reject'}')">
                    <i data-lucide="x"></i> ${isReply ? 'Reprovar Definitivo' : 'Reprovar'}
                </button>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

/* Enviadas — cards para o solicitante */
function renderSentPR(session) {
    const container = document.getElementById('prSentList');
    if (!container) return;

    const all = Storage._getPurchaseRequests();
    const sent = all.filter(r => r.fromUserId === session.userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!sent.length) {
        container.innerHTML = '<div class="cx-empty">Você ainda não enviou solicitações.</div>';
        return;
    }

    // Marca como vistas (limpa badge)
    sent.forEach(r => {
        if (!r.seenByRequester &&
            ['approved', 'rejected', 'final_approved', 'final_rejected'].includes(r.status)) {
            Storage.markPurchaseRequestSeen(r.id);
        }
    });

    const statusMap = {
        pending: { label: 'Aguardando', cls: 'pr-badge-pending' },
        approved: { label: '✓ Aprovado', cls: 'pr-badge-approved' },
        rejected: { label: 'Reprovado', cls: 'pr-badge-rejected' },
        replied: { label: 'Réplica Enviada', cls: 'pr-badge-reply' },
        final_approved: { label: '✓ Aprovado', cls: 'pr-badge-approved' },
        final_rejected: { label: '✗ Reprovado Final', cls: 'pr-badge-final' }
    };

    container.innerHTML = sent.map(r => {
        const st = statusMap[r.status] || { label: r.status, cls: '' };
        const priceStr = Storage.formatCurrency(r.amount);
        const canReply = r.status === 'rejected';

        const extraInfo = (() => {
            if (r.status === 'rejected')
                return `<div class="pr-detail-row pr-rejected-row"><span class="pr-detail-label">Motivo:</span> <span>${escHtml(r.rejectionReason)}</span></div>`;
            if (r.status === 'final_rejected')
                return `<div class="pr-detail-row pr-rejected-row"><span class="pr-detail-label">Motivo final:</span> <span>${escHtml(r.finalRejectionReason)}</span></div>`;
            if (['approved', 'final_approved'].includes(r.status))
                return `<div class="pr-detail-row pr-approved-row"><span class="pr-detail-label">Gasto registrado:</span> <span>O valor foi adicionado aos seus registros</span></div>`;
            if (r.status === 'replied')
                return `<div class="pr-detail-row"><span class="pr-detail-label">Sua réplica:</span> <span>${escHtml(r.replyJustification)}</span></div>`;
            return '';
        })();

        return `
        <div class="pr-card">
            <div class="pr-card-top">
                <div class="pr-card-info">
                    <div class="pr-card-title">${escHtml(r.purchase)}</div>
                    <div class="pr-card-meta">
                        <span class="pr-amount">${priceStr}</span>
                        <span class="pr-sep">·</span>
                        <span>${escHtml(r.paymentMethod)}</span>
                        <span class="pr-sep">·</span>
                        <span>${escHtml(r.category)}</span>
                    </div>
                    <div class="pr-card-from">Para: <strong>${escHtml(r.toUserName)}</strong> · ${timeAgo(r.createdAt)}</div>
                </div>
                <span class="pr-status-badge ${st.cls}">${st.label}</span>
            </div>
            ${extraInfo ? `<div class="pr-detail-block">${extraInfo}</div>` : ''}
            ${canReply ? `
            <div class="pr-card-actions">
                <button class="btn btn-primary cx-btn-sm" onclick="openReplyModal('${r.id}')">
                    <i data-lucide="reply"></i> Enviar Réplica
                </button>
            </div>` : ''}
        </div>`;
    }).join('');
    lucide.createIcons();
    updateConexoesBadge();
}

/* ── Modais ────────────────────────────────────── */

function openPurchaseModal(toUserId, toUserName) {
    document.getElementById('prTargetId').value = toUserId;
    document.getElementById('prTargetName').textContent = toUserName;
    // Limpa os campos manualmente (prNewForm é um div, não um form)
    ['prPurchase', 'prAmount', 'prReason', 'prPayment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('prNewModal').style.display = 'flex';
    lucide.createIcons();
}

function openRejectModal(requestId, type) {
    // type: 'reject' | 'final'
    const isFinal = type === 'final';
    document.getElementById('prActionRequestId').value = requestId;
    document.getElementById('prActionType').value = type;
    document.getElementById('prActionTitle').textContent = isFinal ? 'Reprovação Definitiva' : 'Reprovar Solicitação';
    document.getElementById('prActionSub').textContent = isFinal
        ? 'Esta é a decisão final. O solicitante será notificado e não poderá mais enviar réplicas.'
        : 'Informe o motivo da reprovação. O solicitante poderá enviar uma réplica.';
    document.getElementById('prActionLabel').textContent = 'Motivo da reprovação *';
    document.getElementById('prActionText').value = '';
    document.getElementById('prActionConfirmBtn').textContent = isFinal ? 'Reprovar Definitivamente' : 'Reprovar';
    document.getElementById('prActionConfirmBtn').className = 'btn btn-danger';
    document.getElementById('prActionConfirmBtn').onclick = confirmPRAction;
    document.getElementById('prActionModal').style.display = 'flex';
}

function openReplyModal(requestId) {
    document.getElementById('prActionRequestId').value = requestId;
    document.getElementById('prActionType').value = 'reply';
    document.getElementById('prActionTitle').textContent = 'Enviar Réplica';
    document.getElementById('prActionSub').textContent = 'Esta é sua única oportunidade de réplica. Justifique novamente sua solicitação.';
    document.getElementById('prActionLabel').textContent = 'Nova justificativa';
    document.getElementById('prActionText').value = '';
    document.getElementById('prActionConfirmBtn').textContent = 'Enviar Réplica';
    document.getElementById('prActionConfirmBtn').className = 'btn btn-primary';
    document.getElementById('prActionConfirmBtn').onclick = confirmPRAction;
    document.getElementById('prActionModal').style.display = 'flex';
    lucide.createIcons();
}

function closePRModals(e) {
    if (e && e.target !== e.currentTarget) return; // clique fora do card
    document.getElementById('prNewModal').style.display = 'none';
    document.getElementById('prActionModal').style.display = 'none';
}

/* ── Ações ─────────────────────────────────────── */

function approvePR(requestId) {
    if (!confirm('Aprovar esta solicitação? O gasto será registrado automaticamente.')) return;
    try {
        Storage.approvePurchaseRequest(requestId);
        const session = Storage.getSession();
        renderReceivedPR(session);
        renderSentPR(session);
        renderExpensesList();          // atualiza lista de gastos
        showNotification('Solicitação aprovada! Gasto registrado.', 'success');
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

function confirmPRAction() {
    const requestId = document.getElementById('prActionRequestId').value;
    const type = document.getElementById('prActionType').value;
    const text = document.getElementById('prActionText').value.trim();

    if ((type === 'reject' || type === 'final') && !text) {
        document.getElementById('prActionText').focus();
        showNotification('Informe o motivo.', 'danger');
        return;
    }

    try {
        if (type === 'reject') {
            Storage.rejectPurchaseRequest(requestId, text);
            showNotification('Solicitação reprovada.', 'info');
        } else if (type === 'final') {
            Storage.finalRejectPurchaseRequest(requestId, text);
            showNotification('Reprovação definitiva enviada.', 'info');
        } else if (type === 'reply') {
            if (!text) { showNotification('Escreva sua réplica.', 'danger'); return; }
            Storage.replyToPurchaseRequest(requestId, text);
            showNotification('Réplica enviada!', 'success');
        }
        closePRModals();
        const session = Storage.getSession();
        renderReceivedPR(session);
        renderSentPR(session);
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

/* ── Submit do formulário de nova solicitação ──── */
function submitPurchaseRequest() {
    const toUserId = document.getElementById('prTargetId').value;
    const purchase = document.getElementById('prPurchase').value.trim();
    const amount = parseFloat(document.getElementById('prAmount').value);
    const reason = document.getElementById('prReason').value.trim();
    const paymentMethod = document.getElementById('prPayment').value;
    const category = document.getElementById('prCategory').value;

    if (!purchase) { showNotification('Informe o que deseja comprar.', 'danger'); return; }
    if (!amount || amount <= 0) { showNotification('Informe um valor válido.', 'danger'); return; }
    if (!reason) { showNotification('Informe o motivo da compra.', 'danger'); return; }
    if (!paymentMethod) { showNotification('Selecione a forma de pagamento.', 'danger'); return; }

    try {
        Storage.sendPurchaseRequest({ toUserId, purchase, amount, reason, paymentMethod, category });
        // Limpa os campos
        ['prPurchase', 'prAmount', 'prReason', 'prPayment'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        closePRModals();
        const session = Storage.getSession();
        renderSentPR(session);
        showNotification('Solicitação enviada com sucesso!', 'success');
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}


function loadConexoes() {
    const session = Storage.getSession();
    if (!session) return;

    // Meu ID
    const myIdEl = document.getElementById('myConnectionId');
    if (myIdEl) myIdEl.textContent = session.userId;

    renderPendingRequests(session);
    renderConnections(session);
    renderSentRequests(session);
    loadPurchaseRequests();
    updateConexoesBadge();
}

function renderPendingRequests(session) {
    const container = document.getElementById('pendingRequestsList');
    const badge = document.getElementById('pendingBadge');
    if (!container) return;

    const pending = Storage.getPendingRequests(session.userId);

    if (badge) {
        badge.textContent = pending.length;
        badge.style.display = pending.length > 0 ? 'inline-flex' : 'none';
    }

    if (!pending.length) {
        container.innerHTML = '<div class="cx-empty">Nenhuma solicitação pendente.</div>';
        return;
    }

    container.innerHTML = pending.map(req => {
        const letter = req.fromUserName ? req.fromUserName[0].toUpperCase() : '?';
        const ago = timeAgo(req.createdAt);
        return `
        <div class="cx-request-card" id="req-${req.id}">
            <div class="cx-user-avatar">${letter}</div>
            <div class="cx-user-info">
                <strong>${escHtml(req.fromUserName)}</strong>
                <span>${escHtml(req.fromUserEmail)}</span>
                <small>Solicitou ${ago}</small>
            </div>
            <div class="cx-request-actions">
                <button class="btn btn-success cx-btn-sm" onclick="acceptRequest('${req.id}')">
                    <i data-lucide="check"></i> Aceitar
                </button>
                <button class="btn btn-danger cx-btn-sm" onclick="rejectRequest('${req.id}')">
                    <i data-lucide="x"></i> Recusar
                </button>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function renderConnections(session) {
    const container = document.getElementById('connectionsList');
    const count = document.getElementById('connectionCount');
    if (!container) return;

    const connected = Storage.getConnectedUsers(session.userId);

    if (count) count.textContent = connected.length > 0 ? `${connected.length} conexão${connected.length !== 1 ? 'ões' : ''}` : '';

    if (!connected.length) {
        container.innerHTML = '<div class="cx-empty">Você ainda não tem conexões.</div>';
        return;
    }

    container.innerHTML = connected.map(user => {
        const letter = user.name ? user.name[0].toUpperCase() : '?';
        const since = timeAgo(user.connectedAt);
        return `
        <div class="cx-connection-card">
            <div class="cx-user-avatar cx-avatar-green">${letter}</div>
            <div class="cx-user-info">
                <strong>${escHtml(user.name)}</strong>
                <span>${escHtml(user.email)}</span>
                <small class="cx-connected-since"><i data-lucide="link"></i> Conectados ${since}</small>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
                <button class="btn btn-primary cx-btn-sm" title="Solicitar compra"
                    onclick="openPurchaseModal('${user.id}', '${escHtml(user.name)}')"
                    style="white-space:nowrap">
                    <i data-lucide="shopping-cart"></i> Solicitar
                </button>
                <button class="btn btn-outline-sm cx-btn-disconnect" title="Desconectar"
                    onclick="disconnectUser('${user.id}')">
                    <i data-lucide="user-x"></i>
                </button>
            </div>
        </div>`;
    }).join('');
    lucide.createIcons();
}

function renderSentRequests(session) {
    const container = document.getElementById('sentRequestsList');
    if (!container) return;

    const sent = Storage.getSentRequests(session.userId);
    if (!sent.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `<div class="cx-sent-header">Solicitações enviadas aguardando resposta:</div>` +
        sent.map(req => `
        <div class="cx-sent-item">
            <i data-lucide="clock"></i>
            <span>Aguardando <strong>${escHtml(req.toUserName)}</strong> (${escHtml(req.toUserEmail)})</span>
        </div>`).join('');
    lucide.createIcons();
}

function acceptRequest(reqId) {
    try {
        Storage.acceptConnectionRequest(reqId);
        const session = Storage.getSession();
        renderPendingRequests(session);
        renderConnections(session);
        updateConexoesBadge();
        showNotification('Conexão aceita!', 'success');
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

function rejectRequest(reqId) {
    Storage.rejectConnectionRequest(reqId);
    const session = Storage.getSession();
    renderPendingRequests(session);
    updateConexoesBadge();
    showNotification('Solicitação recusada.', 'info');
}

function disconnectUser(targetUserId) {
    if (!confirm('Desconectar este usuário?')) return;
    const session = Storage.getSession();
    Storage.removeConnection(session.userId, targetUserId);
    renderConnections(session);
    showNotification('Conexão removida.', 'info');
}

// Wires do painel de conexões
const sendConnectionBtn = document.getElementById('sendConnectionBtn');
if (sendConnectionBtn) {
    sendConnectionBtn.addEventListener('click', () => {
        const input = document.getElementById('connectTargetId');
        const targetId = input ? input.value.trim() : '';
        if (!targetId) {
            showNotification('Cole o ID do usuário.', 'danger');
            return;
        }
        try {
            Storage.sendConnectionRequest(targetId);
            if (input) input.value = '';
            const session = Storage.getSession();
            renderSentRequests(session);
            showNotification('Solicitação enviada! Aguarde aceitar.', 'success');
        } catch (err) {
            showNotification(err.message, 'danger');
        }
    });
}

const copyIdBtn = document.getElementById('copyIdBtn');
if (copyIdBtn) {
    copyIdBtn.addEventListener('click', () => {
        const session = Storage.getSession();
        if (!session) return;
        navigator.clipboard.writeText(session.userId).then(() => {
            showNotification('ID copiado!', 'success');
        }).catch(() => {
            const el = document.createElement('textarea');
            el.value = session.userId;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            showNotification('ID copiado!', 'success');
        });
    });
}

function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'agora mesmo';
    if (diff < 3600000) return `há ${Math.floor(diff / 60000)}min`;
    if (diff < 86400000) return `há ${Math.floor(diff / 3600000)}h`;
    if (diff < 86400000 * 7) return `há ${Math.floor(diff / 86400000)}d`;
    return new Date(iso).toLocaleDateString('pt-BR');
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== NOTIFICAÇÕES ====================
function showNotification(message, type = 'info') {
    playHaptic();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Adicionar ícone baseado no tipo
    const icons = {
        success: '✓',
        danger: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || '•';
    iconSpan.style.marginRight = '10px';
    iconSpan.style.fontWeight = 'bold';
    iconSpan.style.fontSize = '16px';

    notification.insertBefore(iconSpan, notification.firstChild);
    document.body.appendChild(notification);

    // Animação de entrada
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Remove automaticamente
    const timeout = type === 'danger' ? 3500 : 2500;
    const hideTimeout = setTimeout(() => {
        notification.classList.remove('show');
        const removeTimeout = setTimeout(() => {
            notification.remove();
        }, 350);
    }, timeout);
}

// ==================== INICIALIZAÇÃO ====================
window.addEventListener('load', () => {
    // Animação de entrada suave
    document.querySelectorAll('.page').forEach((page, index) => {
        page.style.animationDelay = `${index * 50}ms`;
    });

    setDefaultDate();
    loadConfig();
    loadProfile();
    renderExpensesList();
    updateConexoesBadge();
    updateNotifBadge();
    showPage('registrar');

    // Renderiza ícones do Lucide
    lucide.createIcons();

    // Log de inicialização
    console.log('💰 Manager Finance iniciado com sucesso!');
});