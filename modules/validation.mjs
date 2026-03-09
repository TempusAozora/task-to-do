import { sql_queries, sql_pool } from "./sql_handler.mjs";
import { MS_TO_DAY } from './constants.mjs';
import { randomBytes } from 'crypto';
import { hash, compare } from 'bcrypt';

const min_username_length = 3;
const max_username_length = 20;
const min_password_length = 8;

const salt_rounds = 12;
const SESSION_ID_VALIDITY = 3 // days

function getCookie(cookies, name) {
    const value = `; ${cookies}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function getUserData(req, next) {
    try {
        const session_id = getCookie(req.headers.cookie, "SESSION_ID");
        const userdata = (await sql_pool.query(sql_queries.getUserData, [session_id])).rows[0];
        if (userdata) {
            const last_login = new Date(userdata.last_login);
            const now = new Date();
            const diffDays = Math.floor(Math.abs(now - last_login) / MS_TO_DAY);
            
            return (diffDays < SESSION_ID_VALIDITY) ? [true, userdata] : [false, null]
        } else {
            return [false, null]
        }
    } catch (err) {
        next(err);
        return [false, null, true]
    }   
}

async function Authenticate(req, res, next) {
    const [valid_session_id, userdata, err] = await getUserData(req, next);
    if (err) return;
    return (valid_session_id) ? (req.userdata = userdata, next()) : res.redirect('/login')
}

async function redirectIfAuth(req, res, next) {
    const [valid_session_id, userdata, err] = await getUserData(req, next);
    if (err) return;
    return (valid_session_id) ? (req.userdata = userdata, res.redirect('/home')) : next()
}

function inputLength(req, res, next) {
    if (req.body.username.length < min_username_length || req.body.username.length > max_username_length) {
        return res.status(400).json({success: false, message: "Username must have a length of 3 to 20 characters."});
    } else if (req.body.password.length < min_password_length) {
        return res.status(400).json({success: false, message: "Password must have a length of 8 or more characters."});
    } else {
        return next();
    }
}
    
async function usernameTaken(req, res, next) {
    try {
        let username_exists = (await sql_pool.query(sql_queries.checkUsername, [req.body.username])).rows[0];
        return (username_exists) ? res.status(400).json({success: false, message: "Username already exists."}) : next();
    } catch(err) {
        next(err);
    }
}

async function register(req, res, next) {
    try {
        let hashed_password = await hash(req.body.password, salt_rounds);
        await sql_pool.query(sql_queries.registerUser, [req.body.username, hashed_password]);
        next()
    } catch(err) {
        next(err);
    }
}

async function login(req, res, next) {
    try {
        const userdata = (await sql_pool.query(sql_queries.getPasswordHashed, [req.body.username])).rows[0];
        if (!userdata) return res.status(400).json({success: false, message: "Incorrect username or password."});

        let db_hashed_password = Object.values(userdata)[0];
        let user_id = Object.values(userdata)[1];

        let is_matched = await compare(req.body.password, db_hashed_password);
        if (!is_matched) return res.status(400).json({success: false, message: "Incorrect username or password."});

        let session_id = randomBytes(48).toString('base64'); // 64 characters
        await sql_pool.query(sql_queries.updateSessionID, [session_id, user_id]);

        const expireDate = new Date();
        const time = expireDate.getTime();
        const expireTime = time + MS_TO_DAY * SESSION_ID_VALIDITY;
        expireDate.setTime(expireTime);

        req.session_id = session_id
        req.validity_duration = expireDate.toUTCString()
        next()
    } catch(err) {
        next(err);
    }
}

export default {
    getUserData, 
    Authenticate,
    redirectIfAuth,
    inputLength, 
    usernameTaken,
    login,
    register,

    SESSION_ID_VALIDITY,
    salt_rounds
}
