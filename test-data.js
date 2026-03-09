// Script para adicionar dados de teste ao localStorage
// Execute isso no console do DevTools para testar

const testExpenses = [
    {
        description: 'Almoço no restaurante',
        amount: 45.50,
        category: 'Essencial',
        date: '2026-02-20'
    },
    {
        description: 'Compras no mercado',
        amount: 120.00,
        category: 'Essencial',
        date: '2026-02-20'
    },
    {
        description: 'Cinema com amigos',
        amount: 60.00,
        category: 'Pessoal',
        date: '2026-02-19'
    },
    {
        description: 'Livro',
        amount: 35.90,
        category: 'Pessoal',
        date: '2026-02-19'
    },
    {
        description: 'Conta de água',
        amount: 85.00,
        category: 'Essencial',
        date: '2026-02-18'
    },
    {
        description: 'Presente',
        amount: 150.00,
        category: 'Outros',
        date: '2026-02-18'
    }
];

// Adiciona ao Storage
testExpenses.forEach(expense => {
    const fullExpense = {
        ...expense,
        id: Date.now() + Math.random(),
        createdAt: new Date().toISOString()
    };
    Storage.addExpense(fullExpense);
});

console.log('✅ Dados de teste adicionados!');
console.log('📊 Total de despesas:', Storage.getExpenses().length);
