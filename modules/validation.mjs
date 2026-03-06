import { sql_queries, sql_pool } from "./sql_handler.mjs";
import { MS_TO_DAY } from './constants.mjs';

const min_username_length = 3;
const max_username_length = 20;
const min_password_length = 8;

export const salt_rounds = 12;
export const SESSION_ID_VALIDITY = 3 // days

function getCookie(cookies, name) {
    const value = `; ${cookies}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

export async function CheckSessionID(req) {
    try {
        const session_id = getCookie(req.headers.cookie, "SESSION_ID");
        const [[userdata]] = await sql_pool.query(sql_queries.getUserData, [session_id]);
        if (!userdata) return [false, null]

        const last_login = new Date(userdata.last_login);
        const now = new Date();

        const diffTime = Math.abs(now - last_login);
        const diffDays = Math.floor(diffTime / MS_TO_DAY); // convert millisecond to day

        if (diffDays < SESSION_ID_VALIDITY) {
            return [true, userdata];
        }

        return [false, null];
    } catch (err) {
        console.log(err);
    }   
}

export function Authenticate(authentication_type) {
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

export function check_user_input_length(req, res, next) {
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
    
export async function check_if_username_taken(req, res, next) {
    try {
        let [[username_exists]] = await sql_pool.query(sql_queries.checkUsername, [req.body.username]);
        if (username_exists) {
            return res.status(400).json({success: false, message: "Username already exists."});
        }
        return next();
    } catch(err) {
        next(err);
    }
}
