// node modules
import express, { json, urlencoded } from 'express';
import path, { join } from 'path';

// other modules
import validation from './modules/validation.mjs';
import { sql_queries, sql_pool } from './modules/sql_handler.mjs';
import connectSocket from './modules/socket.mjs';

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

app.get('/home', validation.Authenticate, async (req, res, next) => {
    try {
        let task_data = (await sql_pool.query(sql_queries.getTaskData, [req.userdata.user_id])).rows;
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

// Connect to web socket
connectSocket(server)