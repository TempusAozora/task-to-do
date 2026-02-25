const express = require('express');
const mysql2 = require('mysql2/promise')

const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const WebSocket = require('ws');

// require('dotenv').config()

const MS_TO_DAY = 86400000; // convert day to milliseconds

const salt_rounds = 12;

const min_username_length = 3;
const max_username_length = 20;
const min_password_length = 8;

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "public")));

// setup view engine
app.set("view engine", "pug");

// 500 Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
});

// Connect app to sql database
const sql_connection = mysql2.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,

    multipleStatements: true,
    database: process.env.DB_DBNAME,
    ssl: { rejectUnauthorized: false }
});

function getCookie(cookies, name) {
    const value = `; ${cookies}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function CheckSessionID(req) {
    try {
        const session_id = getCookie(req.headers.cookie, "SESSION_ID");
        const get_userdata_query = "SELECT * FROM users WHERE session_id = ?;";
        const [[userdata]] = await sql_connection.query(get_userdata_query, [session_id]);
        
        if (!userdata) return [false, null]

        const last_login = new Date(userdata.last_login);
        const now = new Date();

        const diffTime = Math.abs(now - last_login);
        const diffDays = Math.floor(diffTime / MS_TO_DAY); // convert millisecond to day

        if (diffDays < 1) {
            return [true, userdata];
        }

        return [false, null];
    } catch (err) {
        next(err);
    }   
}

function Authenticate(authentication_type) {
    return async function (req, res, next) {
        try {
            const [is_session_id_valid, userdata] = await CheckSessionID(req)

            if (!is_session_id_valid && authentication_type === "enter_info") { // invalid, logging in
                return next();
            } else if (is_session_id_valid && authentication_type === "enter_info") { // valid, logging in
                return res.redirect(`/home`);
            } else if (!is_session_id_valid && authentication_type !== "enter_info") { // invalid, not logging in
                return res.redirect(`/login`);
            } else { // valid, not logging in
                req.userdata = userdata;
                return next();
            }
        } catch(err) {
            next(err);
        }
    }
}

function check_user_input_length(req, res, next) {
    try {
        if (req.body.username.length < min_username_length || req.body.username.length  > max_username_length) {
            return res.status(400).json({success: false, message: "Username must have a length of 3 to 20 characters."});
        } else if (req.body.password.length < min_password_length) {
            return res.status(400).json({success: false, message: "Password must have a length of 8 or more characters."});
        }
        return next();
    } catch(err) {
        next(err);
    }
}
    
async function check_if_username_taken(req, res, next) {
    try {
        let [[username_exists]] = await sql_connection.query("SELECT user_id FROM users WHERE username = ?;", [req.body.username]);
        if (username_exists) {
            return res.status(400).json({success: false, message: "Username already exists."});
        }
        return next();
    } catch(err) {
        next(err);
    }
}

// Connect app to client
// GET
app.get('/', Authenticate(), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.redirect(`/home`);
});

app.get('/login', Authenticate("enter_info"), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'login.html'))
});

app.get('/register', Authenticate("enter_info"), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/home', Authenticate(), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.render('home', {user: req.userdata.username});
});

// POST
app.post('/register', check_user_input_length, check_if_username_taken, async (req, res, next) => {
    try {
        let hashed_password = await bcrypt.hash(req.body.password, salt_rounds);
        let register = "INSERT INTO users (username, password) VALUES (?, ?);"
        await sql_connection.query(register, [req.body.username, hashed_password]);

        res.status(200).json({success: true});
    } catch(err) {
        next(err);
    }
})

app.post('/login', check_user_input_length, async (req, res, next) => {
    try {
        const get_password = "SELECT password, user_id FROM users WHERE username = ?;" // get password
        const [[user_data]] = await sql_connection.query(get_password, [req.body.username])
        if (!user_data) {
            return res.status(400).json({success: false, message: "Incorrect username or password."});
        }

        let db_hashed_password = Object.values(user_data)[0];
        let user_id = Object.values(user_data)[1];

        let is_matched = await bcrypt.compare(req.body.password, db_hashed_password);

        if (is_matched) {
            let session_id = crypto.randomBytes(48).toString('base64'); // 64 characters
            await sql_connection.query("UPDATE users SET session_id = ?, last_login = NOW() WHERE user_id = ?;", [session_id, user_id]);
            res.status(200).json({success: true, cookie: session_id});
        } else {
            res.status(400).json({success: false, message: "Incorrect username or password."});
        }
    } catch(err) {
        next(err);
    }
});

// 404 not found page.
app.all('/*catchall', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "not_found.html"));;
});

// LISTEN
const server = app.listen(process.env.HTTP_PORT, "0.0.0.0", () => {
    console.log(`app is running on port ${process.env.HTTP_PORT}`);
});

// Web socket
const wss = new WebSocket.Server({noServer: true});

wss.on('connection', function(ws, req) {
    ws.on('error', console.error);

    console.log(req.userdata.username + " client connected");
    ws.on('message', msg => {
        console.log(msg.toString() + " from " + req.userdata.username);
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