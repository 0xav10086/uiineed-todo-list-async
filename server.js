const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// API：保存待办事项
app.post('/api/save-todos', async (req, res) => {
    try {
        const todos = req.body;
        // 格式化为 JavaScript 文件内容
        const fileContent = `export const todos = ${JSON.stringify(todos, null, 2)};`;
        // 写入 /public/js/list_storage.json
        await fs.writeFile(path.join(__dirname, 'public/js/list_storage.json'), fileContent);
        res.status(200).json({ message: 'Todos saved successfully' });
    } catch (error) {
        console.error('Error saving todos:', error);
        res.status(500).json({ error: 'Failed to save todos' });
    }
});
// API：获取待办事项
app.get('/api/get-todos', async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public/js/list_storage.json');
        const data = await fs.readFile(filePath, 'utf8');
        // 解析文件内容，去除 "export const todos = " 和末尾的分号
        const todos = JSON.parse(data.replace('export const todos = ', '').replace(';', ''));
        res.status(200).json(todos);
    } catch (error) {
        console.error('Error reading todos:', error);
        res.status(500).json({ error: 'Failed to read todos' });
    }
});
// 启动服务器
const PORT = 63343;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});