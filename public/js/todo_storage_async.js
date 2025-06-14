// localStorage 存储数据
var STORAGE_KEY = 'uiineed-todos';
var todoStorage = {
    fetch: async function () {
        try {
            const response = await fetch('http://localhost:63343/api/get-todos');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const todos = await response.json();
            todos.forEach(function (todo, index) {
                todo.id = index;
            });
            todoStorage.uid = todos.length;
            return todos;
        } catch (error) {
            console.error('Error fetching todos:', error);
            // Fallback to localStorage if server fetch fails
            var todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            todos.forEach(function (todo, index) {
                todo.id = index;
            });
            todoStorage.uid = todos.length;
            return todos;
        }
    },
    save: async function (todos) {
        try {
            const response = await fetch('http://localhost:63343/api/save-todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(todos),
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Save to localStorage as a backup
            localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        } catch (error) {
            console.error('Error saving todos:', error);
            // Save to localStorage even if server save fails
            localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        }
    }
}