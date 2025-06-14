var app = new Vue({
    el: '#todo-app',
    data: function () {
        return {
            todos: [], // Initialize as empty array
            newTodoTitle: '',
            editedTodo: null,
            intention: 'all',
            checkEmpty: false,
            recycleBin: [],
            dragIndex: '',
            enterIndex: '',
            show: true,
            delayTime: '1',
            isShow: false,
            shortCut: '开✨',
            popShow: true,
            windowWidth: document.documentElement.clientWidth,
            slogan: this.getSlogan(),
            isEditing: false,
            originalSlogan: ""
        }
    },
    created: async function () {
        this.todos = await todoStorage.fetch();
    },
    watch: {
        windowWidth (val) {
            let that = this;
            console.log("实时屏幕宽度：", val);
        },
        todos: {
            handler: async function (todos) {
                await todoStorage.save(todos);
            },
            deep: true
        }
    },
    methods: {
                editText() {
                    this.originalSlogan = this.slogan;
                    this.isEditing = true;
                    this.$nextTick(() => {
                        this.$refs.sloganInput.focus();
                    });
                },
                saveText() {
                    this.isEditing = false;
                    localStorage.setItem('uiineed-slogan', this.slogan);
                },
                cancelText() {
                    this.slogan = this.originalSlogan;
                    this.isEditing = false;
                },
                getSlogan() {
                    return localStorage.getItem('uiineed-slogan') || "今日事今日毕，勿将今事待明日!.☕";
                },
                contorlScreen:function(){
                    if(this.windowWidth < 768){
                        this.isShow = !this.isShow;
                        return this.shortCut = 'Filter'
                    }
                },
                togglePop: function(){
                    this.popShow = !this.popShow;//取反
                },
                shortCutAction: function(){
                    this.isShow = !this.isShow;
                    if(this.isShow){
                        return this.shortCut = '关'
                    }else{
                        return this.shortCut = '开✨'
                    }

                },
                shuffle: function () {
                    this.filteredTodos = _.shuffle(this.filteredTodos);
                },
                addTodo: function (e) {
                    if (this.newTodoTitle === '') {
                        this.checkEmpty = true;
                        return
                    }else{
                    }
                    this.todos.unshift({
                        id: todoStorage.uid++,
                        title: this.newTodoTitle,
                        completed: false,
                        removed: false,
                    });
                    this.newTodoTitle = '';
                    this.checkEmpty = false;
                    this.delayTime = '0';


                },
                markAsCompleted: function (todo) {
                    todo.completed = true;
                },
                markAsUncompleted: function (todo) {
                    todo.completed = false
                },
                markAllAsCompleted: function () {
                    confirm('确认一键勾选完成全部待办事项？').then((confirmed) => {
                        if (confirmed) {
                            this.todos.map(function (todo) {
                                if (!todo.completed) todo.completed = true;
                            })
                        }
                    });
                },
                removeTodo: function (todo) {
                    let removedTodo = this.todos.splice(this.todos.indexOf(todo), 1)[0];
                    removedTodo.removed = true;
                    this.recycleBin.unshift(removedTodo);
                    let pos = this.todos.indexOf(todo);
                },
                restoreTodo: function (todo) {
                    todo.removed = false;
                    this.todos.unshift(todo);
                    let pos = this.recycleBin.indexOf(todo);
                    this.recycleBin.splice(pos, 1);
                },
                editdTodo: function (todo) {
                    this.editedTodo = {
                        id: todo.id,
                        title: todo.title
                    }

                },
                lineFeed: function(event) {
                    if (event.keyCode == 13 && event.ctrlKey ){
                            this.newTodoTitle = this.newTodoTitle + '\n';
                        } else {
                            //event.preventDefault();
                            if (this.newTodoTitle === '') {
                                    this.checkEmpty = true;
                                    return
                                }else{
                                }
                                this.todos.unshift({
                                    id: todoStorage.uid++,
                                    title: this.newTodoTitle,
                                    completed: false,
                                    removed: false,
                                });
                                this.newTodoTitle = '';
                                this.checkEmpty = false;
                                this.delayTime = '0';

                        }
                    // this.newTodoTitle = this.newTodoTitle + '\n';
                },
                editDone: function (todo) {
                    if (todo.title === '') {
                        this.removeTodo(todo)
                    }
                    this.editedTodo = null;
                },
                cancelEdit: function (todo) {
                    todo.title = this.editedTodo.title;
                    this.editedTodo = null
                },
                clearCompleted: function () {
                    confirm('确认清除全部已完成的代办事项?').then((confirmed) => {
                        if (confirmed) {
                            this.completedTodos.map(todo => todo.removed = true);
                            this.recycleBin.unshift(...this.completedTodos);
                            this.todos = this.leftTodos;
                        }
                    });
                },
                clearAll: function () {
                    confirm('确认清除全部待办事项?').then((confirmed) => {
                        if (confirmed) {
                            this.todos.map(todo => todo.removed = true);
                            this.recycleBin.unshift(...this.todos);
                            this.todos = []
                        }
                    });
                },
                //拖拽 ------------------
                dragstart: function (index) {
                    this.dragIndex = index;
                },
                dragenter: function (e, index) {
                    e.preventDefault();
                    // 避免源对象触发自身的dragenter事件
                    if (this.dragIndex !== index) {
                        const source = this.filteredTodos[this.dragIndex];
                        this.filteredTodos.splice(this.dragIndex, 1);
                        this.filteredTodos.splice(index, 0, source);
                        // 排序变化后目标对象的索引变成源对象的索引
                        this.dragIndex = index;
                    }
                },
                dragover: function (e, index) {
                    e.preventDefault();
                },
                // JS钩子 加载动画
                beforeEnter(dom) {
                    dom.classList.add('drag-enter-active');
                },
                enter(dom, done) {
                    let delay = dom.dataset.delay;
                    setTimeout(() => {
                        this.delayTime = '1';
                        dom.classList.remove('drag-enter-active');
                        dom.classList.add('drag-enter-to');
                        let transitionend = window.ontransitionend ? "transitionend" :"webkitTransitionEnd";
                        dom.addEventListener(transitionend, function onEnd() {
                            dom.removeEventListener(transitionend, onEnd);
                            done();
                            //调用done() 告诉vue动画已完成，以触发 afterEnter 钩子
                        })
                    }, delay);
                },
                afterEnter(dom) {
                    dom.classList.remove('drag-enter-to');
                },
                saveLanguage(lang) {
                    localStorage.setItem('uiineed-todos-lang', lang);
                }
            },
            mounted() {
                this.show = true;
                var that = this;
                this.contorlScreen();
                   // <!--把window.onresize事件挂在到mounted函数上-->
                window.onresize = () => {
                    return (() => {
                    window.fullWidth = document.documentElement.clientWidth;
                    that.windowWidth = window.fullWidth; // 宽
                    })()
                };
            },
            directives: {
                focus: {
                    inserted: function (el) {
                        el.focus()
                    }
                }
            },
            computed: {
                emptyChecked: function () {
                    return this.newTodoTitle.length === 0 && this.checkEmpty
                },
                leftTodos: function () {
                    return this.todos.filter(function (todo) {
                        return !todo.completed
                    })
                },
                leftTodosCount: function () {
                    return this.leftTodos.length
                },

                hasRemovedTodo: function () {
                    return !!this.removedTodo
                },
                completedTodos: function () {
                    return this.todos.filter(function (todo) {
                        return todo.completed
                    })
                },
                completedTodosCount: function () {
                    return this.completedTodos.length
                },
                filteredTodos: function () {
                    if (this.intention === 'ongoing') {
                        return this.leftTodos
                    } else if (this.intention === 'completed') {
                        return this.completedTodos
                    } else if (this.intention === 'removed') {
                        return this.recycleBin
                    } else {
                        return this.todos
                    }
                },
                showEmptyTips() {
                    return this.filteredTodos.length === 0 && this.intention !== 'removed';
                },
            },
        })