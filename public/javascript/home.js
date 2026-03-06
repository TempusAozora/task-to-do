class web_socket {
    #socket;
    #callbacks;
    
    constructor(uri) {
        this.#socket = new WebSocket(uri);
        this.#callbacks = {};

        this.#socket.onopen = () => console.log("Connected to websocket");
        this.#socket.onclose = () => console.log("Disconnected to websocket");
        this.#socket.onerror = (err) => console.error("Error:", err);
        this.#socket.onmessage = (event) => {
            const { type, payload } = JSON.parse(event.data);
            if (this.#callbacks[type]) {
                this.#callbacks[type].forEach(fn => fn(payload))
            }
        }
    }

    onmessage(type, callback) {
        if (!this.#callbacks[type]) this.#callbacks[type] = [];
        this.#callbacks[type].push(callback)
    }

    send(type, payload) {
        if (this.#socket?.readyState === WebSocket.OPEN) {
            this.#socket.send(JSON.stringify({type, payload}));
        } else {
            console.error("failed to send in websocket.\nType: " + type + "\nsocket ready state: " + this.#socket?.readyState)
        }
    }
}

class StopWatch {
    #timestampTime;
    #elapsed;
    #activated;
    #timer;
    #startTime;

    constructor(set_time=0) {
        this.#timestampTime = set_time // changes when stopwatch is stopped
        this.#elapsed = 0; // updates every .1 seconds from current date - time when stopwatch is started
        this.#activated = false;
    }

    toggle(fn) {
        this.#activated = !this.#activated;
        if (this.#activated) {
            this.#start(fn)
        } else {
            this.#stop()
        }
    }

    getCurrentTime(decimals=0) {
        if (decimals <= 0) {
            return Math.floor(this.#timestampTime + this.#elapsed)
        } else {
            return Math.floor((this.#timestampTime + this.#elapsed) * (10 ** decimals) ) / (10 ** decimals)
        }
    }

    #start(fn) {
        this.#startTime = new Date()
        this.#timer = window.setInterval(() => {
            this.#elapsed = ((new Date())-this.#startTime)/1000;
            fn()
        }, 100)
    }

    #stop() {
        this.#timestampTime += this.#elapsed
            this.#elapsed = 0;
        window.clearInterval(this.#timer)
    }
}

class Task {
    #elementCreator(type, className, textContent)  {
        const e = document.createElement(type)
        
        if (className !== null) {e.className = className}
        if (textContent !== null) {e.textContent = textContent}

        return e
    }

    #append(children, parent) {
        children.forEach(child => {
            parent.appendChild(child);
        })
    }

    #setupHTML(name, desc, time) {
        const container = document.getElementById('taskContainer');
        this.div = this.#elementCreator('div', 'task');

        const name_ = this.#elementCreator('h1', 'taskTitle truncate', name)
        const description = this.#elementCreator('p', 'taskDescription truncate', desc)
        const progress_bar = this.#elementCreator('p', 'progress')
        const taskTime = this.#elementCreator('div', 'taskTime')

        this.elapsedTime = this.#elementCreator('div', null, timeToStr(Math.floor(time)))
        this.play_button = this.#elementCreator('i', "fa-solid")

        this.#append([name_, description, progress_bar, taskTime], this.div)
        this.#append([this.play_button, this.elapsedTime], taskTime)
        container.appendChild(this.div);
    };

    constructor(name, desc, time=0, uuid, is_running=false) {
        this.uuid = uuid;

        this.#setupHTML(name, desc, time)

        this.stopwatch = new StopWatch(time)
        this.play_button.classList.toggle("fa-play")
        if (is_running) {
            this.toggle();
        }
        
        this.play_button.addEventListener("click", ()=>{
            socket.send("toggleTask", {uuid: this.uuid})
        });
    };

    toggle() {
        this.play_button.classList.toggle("fa-play")
        this.play_button.classList.toggle("fa-pause")

        this.stopwatch.toggle(() => {
            this.elapsedTime.innerText = timeToStr(this.stopwatch.getCurrentTime());
        })
    };
};

function logout() {
    document.cookie = "SESSION_ID=; expires=" + new Date(0).toUTCString() + "; path=/;";
    window.location.href = '/login';
};

function createTask() {
    document.getElementById("overlay").style.display = "flex";
};

function closeForm() {
    document.getElementById("overlay").style.display = "none";
};

function timeToStr(time) {
    let second = time % 60;
    time = Math.floor(time / 60);

    let minute = time % 60;
    time = Math.floor(time / 60);

    let hour = time % 24;

    const hrStr = String(hour).padStart(2, "0");
    const minStr = String(minute).padStart(2, "0");
    const secStr = String(second).padStart(2, "0");

    return `${hrStr}:${minStr}:${secStr}`;
};

function OnSubmit(e) {
    e.preventDefault();

    const name = document.getElementById("taskName").value;
    const desc = document.getElementById("taskDesc").value;

    if (name.length > 20) {
        alert("TITLE to long max length: 20 character");
    } else if (name.trim() === "") {
        alert("Please input the fields")
    } else {
        socket.send("createTask", {name: name, description: desc})
    };

    document.getElementById("taskForm").reset();
    closeForm();
};

const task_dictionary = {};

const loc = window.location;
let new_uri = (loc.protocol === "https:") ? "wss:" : "ws:";
new_uri += "//" + loc.host + loc.pathname;

const socket = new web_socket(new_uri);

socket.onmessage("createTask", (payload) => {
    console.log("CREATE NEW TASKS")
    const newTask = new Task(payload.name, payload.description, 0, payload.uuid);
    task_dictionary[payload.uuid] = newTask;
});

socket.onmessage("toggleTask", (payload) => {
    const task = task_dictionary[payload.uuid];
    task.toggle();
});

socket.onmessage("error", (payload) => {
    console.error(payload.error);
})

// load tasks
window.task_data.forEach(task => {
    const newTask = new Task(task.task_name, task.task_description, task.task_time, task.task_uuid, task.is_running);
    task_dictionary[task.task_uuid] = newTask
});

document.getElementById("taskForm").addEventListener("submit", function(e) {
    OnSubmit(e);
});