// node modules
import express, { json, urlencoded } from 'express';
import path, { join } from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { hash, compare } from 'bcrypt';
import { WebSocketServer } from 'ws';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const public_dir = join(__dirname, "public")

// other modules
import { CheckSessionID, 
         Authenticate, 
         check_user_input_length, 
         check_if_username_taken, 
         SESSION_ID_VALIDITY,
         salt_rounds
        } from './modules/validation.mjs';

import { MS_TO_DAY } from './modules/constants.mjs';
import { sql_queries, sql_pool } from './modules/sql_handler.mjs';
import { create } from 'domain';

const app = express();

app.use(json());
app.use(urlencoded({extended: true}));
app.use(express.static('public')); // get static files
app.set("view engine", "pug"); // setup view/dynamic files

// 500 Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
});

// GET
app.get('/', Authenticate(), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.redirect(`/home`);
});

app.get('/login', Authenticate("enter_info"), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile('login.html', {root: public_dir})
});

app.get('/register', Authenticate("enter_info"), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile('register.html', {root: public_dir});
});

app.get('/home', Authenticate(), async (req, res) => {
    res.set('Cache-Control', 'no-store');

    let [task_data] = await sql_pool.query(sql_queries.getTaskData, [req.userdata.user_id]);
    res.render('home', {user: req.userdata.username, task_data: task_data});
});

// POST
app.post('/register', check_user_input_length, check_if_username_taken, async (req, res, next) => {
    try {
        let hashed_password = await hash(req.body.password, salt_rounds);
        await sql_pool.query(sql_queries.registerUser, [req.body.username, hashed_password]);

        res.status(200).json({success: true});
    } catch(err) {
        next(err);
    }
})

app.post('/login', check_user_input_length, async (req, res, next) => {
    try {
        const [[user_data]] = await sql_pool.query(sql_queries.getPasswordHashed, [req.body.username])
        if (!user_data) {
            return res.status(400).json({success: false, message: "Incorrect username or password."});
        }

        let db_hashed_password = Object.values(user_data)[0];
        let user_id = Object.values(user_data)[1];

        let is_matched = await compare(req.body.password, db_hashed_password);

        if (is_matched) {
            let session_id = randomBytes(48).toString('base64'); // 64 characters
            await sql_pool.query(sql_queries.updateSessionID, [session_id, user_id]);

            const expireDate = new Date();
            const time = expireDate.getTime();
            const expireTime = time + MS_TO_DAY * SESSION_ID_VALIDITY; // Milliseconds * seconds * minutes * hours * days
            expireDate.setTime(expireTime);

            console.log(expireDate.toUTCString())

            res.status(200).json({success: true, cookie: session_id, validity_duration: expireDate.toUTCString()});
        } else {
            res.status(400).json({success: false, message: "Incorrect username or password."});
        }
    } catch(err) {
        next(err);
    }
});

// 404 not found page.
app.all('/*catchall', (req, res) => {
    res.status(404).sendFile("not_found.html", {root: public_dir});;
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
    const [is_session_id_valid, userdata] = await CheckSessionID(req)

    if (is_session_id_valid) { // if session id is valid and at home page
        wss.handleUpgrade(req, socket, head, (ws) => {
            req.userdata = userdata
            wss.emit('connection', ws, req); // accept connection
        });
    } else {
        socket.destroy()
    }
})