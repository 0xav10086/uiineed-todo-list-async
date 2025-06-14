// 调用 fetch 方法从 localStorage 获取数据
        var fetchedTodos = todoStorage.fetch();
        // 在控制台打印获取到的数据
        // console.log("Stored Todos:", fetchedTodos);
        const handleClickDownload = () => {
            const todosText = JSON.stringify(todoStorage.fetch(), null, 2);
            const date = new Date().toISOString().replace(/-|:|\.\d+/g, '');
            const fileName = `todos-${date.slice(0, 8)}-${date.slice(9, 15)}.txt`;

            const element = document.createElement('a');
            element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(todosText);
            element.download = fileName;

            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        };

        // 导入文件
        let tempFileInput = null; // 用于存储动态创建的文件输入元素
        document.getElementById('import').addEventListener('click', function() {
            if (!tempFileInput) {
                // 如果不存在，则创建一个新的文件输入元素
                tempFileInput = document.createElement('input');
                tempFileInput.type = 'file';
                tempFileInput.accept = '.txt,.json';
                tempFileInput.style.display = 'none';
                // 将新创建的文件输入元素添加到DOM中
                // 这里选择添加到导入按钮的父元素内作为示例
                this.parentNode.appendChild(tempFileInput);

                // 为文件输入元素添加change事件监听器
                tempFileInput.addEventListener('change', function(event) {
                    var file = event.target.files[0];
                    if (!file) return alert('没有选择文件！', '错误');
                    var reader = new FileReader();
                    reader.onload = function(e) {
                        var content = e.target.result;
                        try {
                            var importedData;
                            if (file.type === 'application/json') {
                                // 如果是JSON文件，直接解析
                                importedData = JSON.parse(content);

                            } else if (file.type === 'text/plain') {
                                // 如果是TXT文件，尝试将其解析为JSON（假设TXT文件内容格式正确）

                                importedData = JSON.parse(content.trim());
                            } else {
                                throw new Error('不支持的文件类型');
                            }
                            // 从localStorage获取当前数据
                            var currentTodos = todoStorage.fetch() || [];
                            // 获取当前数据的数量，用于生成新的唯一id
                            var nextIdIndex = currentTodos.length;
                            // 遍历importedData，更新每一项的id
                            importedData.forEach((item, index) => {
                                item.id = nextIdIndex + index;
                            });
                            // 将新导入的数据追加到现有数据中
                            var updatedTodos = currentTodos.concat(importedData);
                            // 更新localStorage
                            todoStorage.save(updatedTodos);
                            // 更新页面内容
                            updatePageContent(updatedTodos);
                            alert('文件导入成功，数据已追加！');
                        } catch (error) {
                            alert('文件解析错误，请确保文件格式正确：' + error.message, '错误');
                        }
                    };
                    reader.onerror = function(e) {
                        alert('读取文件时发生错误：' + e.target.error.name, '错误');
                    };
                    reader.readAsText(file);
                    this.parentNode.removeChild(tempFileInput);
                     tempFileInput = null; // 重置变量以备后用
                });
            };
            // 触发文件选择对话框
            tempFileInput.click();
        });
        // 更新页面内容函数
        function updatePageContent(data) {
            // app.todos.push(data);
            app.todos = data;
            // function logAllIds(data) {
            //     data.forEach(item => {
            //         console.log("更新的数据ID:", item.id);
            //     });
            // }
            // logAllIds(data);
        }