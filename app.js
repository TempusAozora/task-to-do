// node modules
import express, { json, urlencoded } from 'express';
import path, { join } from 'path';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';

// other modules
import validation from './modules/validation.mjs';
import { sql_queries, sql_pool } from './modules/sql_handler.mjs';

// get public directory
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const public_dir = join(__dirname, "public")

const app = express();

app.use(json());
app.use(urlencoded({extended: true}));
app.use(express.static('public')); // get static files
app.set("view engine", "pug"); // setup view/dynamic files

// cache-control, no-store
app.use((req, res, next) => {
  if (req.method === 'GET') {res.set('Cache-Control', 'no-store');}
  next();
});

// GET
app.get('/', validation.Authenticate, (req, res) => {
    res.redirect(`/home`);
});

app.get('/login', validation.redirectIfAuth, (req, res) => {
    res.sendFile('login.html', {root: public_dir})
});

app.get('/register', validation.redirectIfAuth, (req, res) => {
    res.sendFile('register.html', {root: public_dir});
});

app.get('/home', validation.Authenticate, async (req, res) => {
    try {
        let [task_data] = await sql_pool.query(sql_queries.getTaskData, [req.userdata.user_id]);
        res.render('home', {user: req.userdata.username, task_data: task_data});
    } catch(err) {
        next(err);
    }
});

// POST
app.post('/register', validation.inputLength, validation.usernameTaken, validation.register, async (req, res, next) => {
    res.status(200).json({success: true});
})

app.post('/login', validation.inputLength, validation.login, async (req, res, next) => {
    res.status(200).json({success: true, cookie: req.session_id, validity_duration: req.validity_duration});
});

// 404 not found page.
app.all('/*catchall', (req, res) => {
    res.status(404).sendFile("not_found.html", {root: public_dir});;
});

// 500 Error handler
app.use((err, req, res, next) => {
    console.error(`TIMESTAMP (UTC): ${(new Date()).toUTCString()}`, err.stack);
    res.status(500).sendFile('error_page.html', {root: public_dir});
});

// LISTEN
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});

// Web socket
const wss = new WebSocketServer({noServer: true});
function create_response(type, payload) {
    return JSON.stringify({type, payload})
}

wss.on('connection', function(ws, req) {
    ws.on('error', console.error);

    console.log(req.userdata.username + " client connected");
    
    ws.on('message', async function(data) {
        const {type, payload} = JSON.parse(data.toString())

        // If type is valid
        const valid_types = {createTask: true, toggleTask: true}
        if (!valid_types[type]) {
            const response = create_response("error", {message: "websocket message is not valid"})
            return ws.send(response);
        }

        let response;
        
        // check for mysql queries error wip
        if (type === "createTask") {
            // validate name and description (WIP)
            const uuid = randomUUID()
            await sql_pool.query(sql_queries.createTask, [req.userdata.user_id, req.userdata.user_id, payload.name, payload.description, uuid])
            response = create_response(type, {status: 200, uuid: uuid, name: payload.name, description: payload.description})

        } else if (type === "toggleTask") {
            // reduce request (WIP)
            await sql_pool.query(sql_queries.toggleTask, [payload.uuid])
            response = create_response(type, {status: 200, uuid: payload.uuid})
        }

        ws.send(response)
    })
})

server.on('upgrade', async function(req, socket, head) {
    const [is_session_id_valid, userdata] = await validation.getUserData(req)

    if (is_session_id_valid) { // if session id is valid and at home page
        wss.handleUpgrade(req, socket, head, (ws) => {
            req.userdata = userdata
            wss.emit('connection', ws, req); // accept connection
        });
    } else {
        socket.destroy()
    }
})