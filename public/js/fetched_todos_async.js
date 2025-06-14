const handleClickDownload = async () => {
    const todos = await todoStorage.fetch();
    const todosText = JSON.stringify(todos, null, 2);
    const date = new Date().toISOString().replace(/-|:|\.\d+/g, '');
    const fileName = `todos-${date.slice(0, 8)}-${date.slice(9, 15)}.txt`;

    const element = document.createElement('a');
    element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(todosText);
    element.download = fileName;

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};