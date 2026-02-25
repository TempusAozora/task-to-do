const loc = window.location;
let new_uri = (loc.protocol === "https:") ? "wss:" : "ws:"

new_uri += "//" + loc.host + loc.pathname;
const socket = new WebSocket(new_uri);

function logout() {
    document.cookie = "SESSION_ID=; expires=" + new Date(0).toUTCString() + "; path=/;";
    window.location.href = '/login'
}

function createTask() {
    document.getElementById("overlay").style.display = "flex";
}

function closeForm() {
    document.getElementById("overlay").style.display = "none";
}

let TaskIDArray = []

class Task {
    #elementCreator(type, className, textContent)  {
        const e = document.createElement(type)
        e.className = className
        if (textContent) {e.textContent = textContent}
        return e
    }

    constructor(title, desc, time=0) {
        const container = document.getElementById('taskContainer');
        this.div = this.#elementCreator('div', 'task');
        
        const title_ = this.#elementCreator('h1', 'taskTitle', title)
        const description = this.#elementCreator('p', 'taskDescript', desc)
        const elapsed_time = this.#elementCreator('p', 'taskTime', time)

        this.div.appendChild(title_);
        this.div.appendChild(description);
        this.div.appendChild(elapsed_time);
        container.appendChild(this.div);
    }

    serialize() {
        const childElements = this.div.children;

        let obj = {}
        for (const element of childElements) {
            obj[element.className] = element.innerText;
        }

        return obj
    }
}

document.getElementById("taskForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const name = document.getElementById("taskName").value;
    const desc = document.getElementById("taskDesc").value;
    const time = document.getElementById("taskTime").value;

    const new_task = new Task(name, desc, time);
    const new_task_data = new_task.serialize()

    socket.send("Task created")
    
    document.getElementById("taskForm").reset();

    closeForm();
})